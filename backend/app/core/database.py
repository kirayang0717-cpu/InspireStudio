from pathlib import Path
from sqlalchemy import create_engine, event, text

ROOT = Path(__file__).resolve().parents[3]
DB_PATH = ROOT / "data" / "database" / "inspirestudio.db"
engine = create_engine(
    "sqlite:///" + DB_PATH.as_posix(),
    connect_args={"check_same_thread": False, "timeout": 10},
)

@event.listens_for(engine, "connect")
def configure_sqlite(connection, _):
    connection.execute("PRAGMA foreign_keys=ON")

def initialize_storage():
    for folder in ("database", "uploads", "assets", "exports", "temp"):
        (ROOT / "data" / folder).mkdir(parents=True, exist_ok=True)
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

def check_database():
    with engine.connect() as connection:
        return connection.execute(text("SELECT 1")).scalar_one() == 1

