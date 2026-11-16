from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import initialize_storage, check_database

@asynccontextmanager
async def lifespan(app):
    initialize_storage()
    yield

app = FastAPI(title="InspireStudio", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Content-Type"],
)

@app.get("/api/health")
def health():
    try:
        if not check_database():
            raise RuntimeError("Database check failed")
    except (SQLAlchemyError, RuntimeError):
        logging.exception("Database health check failed")
        return JSONResponse(status_code=503, content={"status": "error", "database": "unavailable"})
    return {"status": "ok", "database": "connected"}

