import uuid
import re
import json
from openai import OpenAI
from sqlalchemy.orm import Session
from .database import DiffReasoningPair, Constraint, ChatSession, ChatMessage


def build_system_prompt(db: Session, file_paths: list[str]) -> str:
    parts = ["You are a coding assistant with full awareness of this project's history.\n"]

    constraints = db.query(Constraint).all()
    if constraints:
        parts.append("## Project Constraints (you decided these previously — follow them)")
        for c in constraints:
            parts.append(f"- {c.key}: {c.value}")
            if c.rationale:
                parts.append(f"  Rationale: {c.rationale}")
        parts.append("")

    if file_paths:
        parts.append("## Recent File History")
        for fp in file_paths:
            pairs = (
                db.query(DiffReasoningPair)
                .filter(DiffReasoningPair.file_path == fp)
                .order_by(DiffReasoningPair.timestamp.desc())
                .limit(5)
                .all()
            )
            if pairs:
                parts.append(f"\n### {fp}")
                for p in reversed(pairs):
                    parts.append(f"- Change: {p.agent_reasoning}")
                    if p.git_diff:
                        parts.append(f"  Diff: {p.git_diff[:200]}")

    parts.append("\nRespond concisely. State your reasoning before any code changes.")
    return "\n".join(parts)


EXTRACTION_PROMPT = """Extract technology decisions for this project from the conversation below.

EXTRACT when the user says things like:
- "Use Stripe for payments" → {{"key": "payments", "value": "Stripe", "rationale": "user chose it"}}
- "We need PostgreSQL" → {{"key": "database", "value": "PostgreSQL", "rationale": "user requirement"}}
- "Let's go with JWT auth" → {{"key": "auth", "value": "JWT", "rationale": "user decision"}}
- "Switch from X to Y" → {{"key": "...", "value": "Y", "rationale": "switched from X"}}

DO NOT EXTRACT:
- Boilerplate from code samples (port numbers, placeholder URLs, host 0.0.0.0)
- General knowledge or comparisons ("REST vs GraphQL pros and cons")
- Things the user is just asking about, not deciding

Return a JSON array. Max 5 items. If no decisions were made, return []

USER: {user_message}

RESPONSE: {agent_response}

JSON:"""


def extract_constraints_via_llm(
    user_message: str, agent_response: str, client: OpenAI, model: str
) -> list[dict]:
    try:
        prompt = EXTRACTION_PROMPT.format(
            user_message=user_message,
            agent_response=agent_response[:2000],
        )
        response = client.chat.completions.create(
            model=model,
            max_tokens=512,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"```\s*$", "", raw)
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [
                {"key": c["key"], "value": c["value"], "rationale": c.get("rationale", "")}
                for c in parsed[:5]
                if isinstance(c, dict) and "key" in c and "value" in c
            ]
    except Exception:
        pass
    return []


def store_constraints(db: Session, new_constraints: list[dict]):
    for c in new_constraints:
        existing = db.query(Constraint).filter(Constraint.key == c["key"]).first()
        if existing:
            existing.value = c["value"]
            existing.rationale = c["rationale"]
        else:
            db.add(Constraint(key=c["key"], value=c["value"], rationale=c["rationale"]))
    if new_constraints:
        db.commit()


def generate_title(text: str, client: OpenAI, model: str) -> str:
    try:
        response = client.chat.completions.create(
            model=model,
            max_tokens=20,
            temperature=0,
            messages=[{"role": "user", "content": f"Write a 3-5 word title for this question. Return ONLY the title, nothing else.\n\n{text}"}],
        )
        return response.choices[0].message.content.strip().strip('"')
    except Exception:
        return text[:40]


def single_shot(
    user_message: str,
    db: Session,
    api_key: str,
    base_url: str,
    model: str,
    file_paths: list[str] = None,
    session_id: str = None,
) -> dict:
    file_paths = file_paths or []
    client = OpenAI(base_url=base_url, api_key=api_key)

    is_new_session = session_id is None
    session_id = session_id or str(uuid.uuid4())

    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        session = ChatSession(id=session_id, title="New chat")
        db.add(session)
        db.commit()
        is_new_session = True

    db.add(ChatMessage(session_id=session_id, role="user", content=user_message, file_paths=",".join(file_paths)))
    db.commit()

    system_prompt = build_system_prompt(db, file_paths)

    response = client.chat.completions.create(
        model=model,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )

    reply = response.choices[0].message.content

    new_constraints = extract_constraints_via_llm(user_message, reply, client, model)
    store_constraints(db, new_constraints)

    context_tokens = len(system_prompt.split())
    db.add(ChatMessage(session_id=session_id, role="assistant", content=reply, context_tokens=context_tokens))
    db.commit()

    if is_new_session:
        session.title = generate_title(user_message, client, model)
        db.commit()

    pair = DiffReasoningPair(
        session_id=session_id,
        file_path=file_paths[0] if file_paths else "general",
        git_diff="",
        agent_reasoning=reply[:500],
        user_message=user_message,
    )
    db.add(pair)
    db.commit()

    return {
        "reply": reply,
        "session_id": session_id,
        "session_title": session.title,
        "context_tokens": context_tokens,
        "new_constraints": new_constraints,
    }
