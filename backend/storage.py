"""Single-instance SQLite storage. Mount DATABASE_PATH on a persistent volume."""
import hashlib
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException


@contextmanager
def connection():
    path = Path(os.getenv("DATABASE_PATH", str(Path(__file__).parent / "data" / "interviews.sqlite3")))
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path, timeout=10) as db:
        db.row_factory = sqlite3.Row
        db.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (owner TEXT PRIMARY KEY, expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS interviews (
                id TEXT NOT NULL, owner TEXT NOT NULL, created REAL NOT NULL, updated REAL NOT NULL,
                payload TEXT NOT NULL, result TEXT, PRIMARY KEY (owner, id)
            );
            CREATE TABLE IF NOT EXISTS rate_limits (
                key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL
            );
        """)
        yield db


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session():
    token = secrets.token_urlsafe(32)
    with connection() as db:
        db.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
        db.execute("INSERT INTO sessions VALUES (?, ?)", (token_hash(token), time.time() + 30 * 86400))
    return token


def session_owner(token: str | None):
    if not token:
        return None
    owner = token_hash(token)
    with connection() as db:
        row = db.execute("SELECT owner FROM sessions WHERE owner=? AND expires>?", (owner, time.time())).fetchone()
    return row["owner"] if row else None


def rate_limit(key: str, limit: int, seconds: int = 60):
    window = int(time.time()) // seconds
    with connection() as db:
        db.execute("""INSERT INTO rate_limits VALUES (?, ?, 1)
            ON CONFLICT(key) DO UPDATE SET
              count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,
              window=excluded.window""", (key, window))
        count = db.execute("SELECT count FROM rate_limits WHERE key=?", (key,)).fetchone()["count"]
    if count > limit:
        raise HTTPException(429, "Too many requests. Please wait a minute and retry.")


def save_draft(owner: str, payload):
    now = time.time()
    with connection() as db:
        old = db.execute("SELECT payload, result FROM interviews WHERE owner=? AND id=?",
                         (owner, str(payload.interview_id))).fetchone()
        data = payload.model_dump_json()
        if old and old["result"]:
            if json.loads(old["payload"]) != json.loads(data):
                raise HTTPException(409, "A completed interview cannot be replaced.")
            return
        db.execute("""INSERT INTO interviews VALUES (?, ?, ?, ?, ?, NULL)
            ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload, updated=excluded.updated""",
                   (str(payload.interview_id), owner, now, now, data))


def save_result(owner: str, interview_id: str, result):
    with connection() as db:
        db.execute("UPDATE interviews SET result=?, updated=? WHERE owner=? AND id=?",
                   (result.model_dump_json(), time.time(), owner, interview_id))


def get_interview(owner: str, interview_id: str):
    with connection() as db:
        row = db.execute("SELECT * FROM interviews WHERE owner=? AND id=?", (owner, interview_id)).fetchone()
    if not row:
        raise HTTPException(404, "Interview not found.")
    return {"id": row["id"], "created_at": row["created"], "payload": json.loads(row["payload"]),
            "result": json.loads(row["result"]) if row["result"] else None}


def list_interviews(owner: str):
    with connection() as db:
        rows = db.execute("SELECT * FROM interviews WHERE owner=? ORDER BY updated DESC LIMIT 100", (owner,)).fetchall()
    output = []
    for row in rows:
        payload = json.loads(row["payload"])
        result = json.loads(row["result"]) if row["result"] else None
        output.append({
            "id": row["id"], "created_at": row["created"], "question_count": len(payload["questions"]),
            "overall_score": result["coaching"]["overall_score"] if result else None,
            "status": "complete" if result else "pending",
            "speech": result["speech"] if result else None,
        })
    return output


def delete_interview(owner: str, interview_id: str):
    with connection() as db:
        db.execute("DELETE FROM interviews WHERE owner=? AND id=?", (owner, interview_id))
