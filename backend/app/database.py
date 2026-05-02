from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

Base = declarative_base()

STEERHEAD_HOME = Path.home() / ".steerhead" / "projects"
STEERHEAD_ROOT = Path(__file__).resolve().parent.parent.parent


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    slug = Column(String, unique=True, index=True)
    name = Column(String)
    base_url = Column(String, default="https://api.groq.com/openai/v1")
    model = Column(String, default="llama-3.3-70b-versatile")
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String, primary_key=True)
    title = Column(String, default="New chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True)
    session_id = Column(String, index=True)
    role = Column(String)  # "user" or "assistant"
    content = Column(Text)
    file_paths = Column(Text, default="")
    context_tokens = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow)


class DiffReasoningPair(Base):
    __tablename__ = "diff_reasoning_pairs"
    id = Column(Integer, primary_key=True)
    session_id = Column(String, index=True)
    file_path = Column(String, index=True)
    git_diff = Column(Text)
    agent_reasoning = Column(Text)
    user_message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)


class Constraint(Base):
    __tablename__ = "constraints"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True)
    value = Column(Text)
    rationale = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)


def get_api_key() -> str:
    env_path = STEERHEAD_ROOT / ".env"
    if not env_path.exists():
        raise FileNotFoundError(f"No .env found at {env_path}")
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            if key.strip() == "STEERHEAD_API_KEY":
                return val.strip()
    raise ValueError(f"STEERHEAD_API_KEY not found in {env_path}")


_registry_engine = None
_registry_session = None


def get_registry_db():
    global _registry_engine, _registry_session
    if not _registry_engine:
        STEERHEAD_HOME.mkdir(parents=True, exist_ok=True)
        registry_path = STEERHEAD_HOME.parent / "registry.db"
        _registry_engine = create_engine(
            f"sqlite:///{registry_path}",
            connect_args={"check_same_thread": False},
        )
        Project.__table__.create(bind=_registry_engine, checkfirst=True)
        _registry_session = sessionmaker(bind=_registry_engine)
    db = _registry_session()
    try:
        yield db
    finally:
        db.close()


_project_engines = {}


def get_project_db(slug: str):
    if slug not in _project_engines:
        project_dir = STEERHEAD_HOME / slug
        project_dir.mkdir(parents=True, exist_ok=True)
        db_path = project_dir / "steerhead.db"
        engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
        )
        for table in [ChatSession, ChatMessage, DiffReasoningPair, Constraint]:
            table.__table__.create(bind=engine, checkfirst=True)
        _project_engines[slug] = sessionmaker(bind=engine)

    db = _project_engines[slug]()
    try:
        yield db
    finally:
        db.close()
