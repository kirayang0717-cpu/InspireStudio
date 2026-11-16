from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from app.main import app
from app.core.database import engine
from sqlalchemy import text

def test_health():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "database": "connected"}
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1

def test_cors():
    with TestClient(app) as client:
        response = client.options("/api/health", headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        })
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
        denied = client.get("/api/health", headers={"Origin": "https://untrusted.example"})
        assert "access-control-allow-origin" not in denied.headers

def test_database_failure(monkeypatch):
    def fail():
        raise OperationalError("SELECT 1", {}, Exception("private detail"))
    monkeypatch.setattr("app.main.check_database", fail)
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 503
        assert response.json() == {"status": "error", "database": "unavailable"}

