from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import (
    get_registry_db, get_project_db, get_api_key,
    Project, DiffReasoningPair, Constraint, ChatSession, ChatMessage, STEERHEAD_HOME,
)
from .agent import single_shot

app = FastAPI(title="Steerhead", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProjectCreate(BaseModel):
    slug: str
    name: str
    base_url: str = "https://api.groq.com/openai/v1"
    model: str = "llama-3.3-70b-versatile"


class ChatRequest(BaseModel):
    message: str
    file_paths: list[str] = []
    session_id: str | None = None


class ConstraintRequest(BaseModel):
    key: str
    value: str
    rationale: str = ""


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.3.0"}


@app.get("/projects")
def list_projects(db: Session = Depends(get_registry_db)):
    projects = db.query(Project).all()
    return [
        {"slug": p.slug, "name": p.name, "base_url": p.base_url, "model": p.model}
        for p in projects
    ]


@app.post("/projects")
def create_project(req: ProjectCreate, db: Session = Depends(get_registry_db)):
    existing = db.query(Project).filter(Project.slug == req.slug).first()
    if existing:
        raise HTTPException(status_code=409, detail="Project already exists")
    project = Project(slug=req.slug, name=req.name, base_url=req.base_url, model=req.model)
    db.add(project)
    db.commit()
    list(get_project_db(req.slug))
    return {"status": "created", "slug": req.slug}


@app.delete("/projects/{slug}")
def delete_project(slug: str, db: Session = Depends(get_registry_db)):
    db.query(Project).filter(Project.slug == slug).delete()
    db.commit()
    return {"status": "deleted"}


def _get_project(slug: str, registry_db: Session) -> Project:
    project = registry_db.query(Project).filter(Project.slug == slug).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
    return project


@app.get("/projects/{slug}/sessions")
def list_sessions(slug: str):
    project_db = next(get_project_db(slug))
    try:
        sessions = (
            project_db.query(ChatSession)
            .order_by(ChatSession.updated_at.desc())
            .limit(50)
            .all()
        )
        return [
            {
                "id": s.id,
                "title": s.title,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat(),
            }
            for s in sessions
        ]
    finally:
        project_db.close()


@app.get("/projects/{slug}/sessions/{session_id}/messages")
def get_session_messages(slug: str, session_id: str):
    project_db = next(get_project_db(slug))
    try:
        messages = (
            project_db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.timestamp.asc())
            .all()
        )
        return [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "context_tokens": m.context_tokens,
                "timestamp": m.timestamp.isoformat(),
            }
            for m in messages
        ]
    finally:
        project_db.close()


@app.delete("/projects/{slug}/sessions/{session_id}")
def delete_session(slug: str, session_id: str):
    project_db = next(get_project_db(slug))
    try:
        project_db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
        project_db.query(ChatSession).filter(ChatSession.id == session_id).delete()
        project_db.commit()
        return {"status": "deleted"}
    finally:
        project_db.close()


@app.post("/projects/{slug}/chat")
def chat(slug: str, req: ChatRequest):
    registry_db = next(get_registry_db())
    project = _get_project(slug, registry_db)
    project_db = next(get_project_db(slug))
    try:
        api_key = get_api_key()
    except (FileNotFoundError, ValueError) as e:
        registry_db.close()
        project_db.close()
        raise HTTPException(status_code=400, detail=str(e))
    try:
        result = single_shot(
            user_message=req.message,
            db=project_db,
            api_key=api_key,
            base_url=project.base_url,
            model=project.model,
            file_paths=req.file_paths,
            session_id=req.session_id,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        project_db.close()
        registry_db.close()


@app.get("/projects/{slug}/constraints")
def get_constraints(slug: str):
    project_db = next(get_project_db(slug))
    try:
        return [
            {"id": c.id, "key": c.key, "value": c.value, "rationale": c.rationale}
            for c in project_db.query(Constraint).all()
        ]
    finally:
        project_db.close()


@app.post("/projects/{slug}/constraints")
def add_constraint(slug: str, req: ConstraintRequest):
    project_db = next(get_project_db(slug))
    try:
        existing = project_db.query(Constraint).filter(Constraint.key == req.key).first()
        if existing:
            existing.value = req.value
            existing.rationale = req.rationale
        else:
            project_db.add(Constraint(key=req.key, value=req.value, rationale=req.rationale))
        project_db.commit()
        return {"status": "saved"}
    finally:
        project_db.close()


@app.delete("/projects/{slug}/constraints")
def delete_constraint(slug: str, key: str = Query(...)):
    project_db = next(get_project_db(slug))
    try:
        project_db.query(Constraint).filter(Constraint.key == key).delete()
        project_db.commit()
        return {"status": "deleted"}
    finally:
        project_db.close()
