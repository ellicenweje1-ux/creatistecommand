from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from . import config


class Base(DeclarativeBase):
    pass


engine = create_engine(
    config.DATABASE_URL,
    connect_args={"check_same_thread": False} if config.DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_columns():
    """Additive migration: add columns introduced after v1 to existing databases."""
    import sqlalchemy as sa

    wanted = {
        "users": {
            "owner_id": "INTEGER", "job_title": "VARCHAR(120) DEFAULT ''",
            "enquiry_token": "VARCHAR(64) DEFAULT ''",
        },
        "tasks": {"assignee_id": "INTEGER"},
    }
    inspector = sa.inspect(engine)
    with engine.begin() as conn:
        for table, cols in wanted.items():
            if table not in inspector.get_table_names():
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in cols.items():
                if name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
