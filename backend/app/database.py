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
            "calendar_token": "VARCHAR(64) DEFAULT ''",
            "trial_reminder_sent": "BOOLEAN DEFAULT 0",
            "is_founder": "BOOLEAN DEFAULT 0", "founder_number": "INTEGER",
            "founder_since": "VARCHAR(10) DEFAULT ''", "tour_done": "BOOLEAN DEFAULT 0",
            "onboarded_at": "VARCHAR(10) DEFAULT ''",
            "reset_token": "VARCHAR(64) DEFAULT ''", "reset_token_expires": "VARCHAR(40) DEFAULT ''",
            "business_description": "TEXT DEFAULT ''", "business_email": "VARCHAR(255) DEFAULT ''",
            "services": "JSON", "socials": "JSON", "gallery": "JSON",
            "contact_channel": "VARCHAR(10) DEFAULT 'both'", "contact_template": "TEXT DEFAULT ''",
            "feature_publicly": "BOOLEAN DEFAULT 0", "testimonial": "TEXT DEFAULT ''",
            "feature_status": "VARCHAR(10) DEFAULT 'none'", "testimonial_rating": "INTEGER DEFAULT 0",
            "invoice_prefix": "VARCHAR(12) DEFAULT 'INV'", "quote_prefix": "VARCHAR(12) DEFAULT 'Q'",
            "invoice_format": "VARCHAR(40) DEFAULT ''", "quote_format": "VARCHAR(40) DEFAULT ''",
            "service_charges": "JSON", "invoice_app_url": "VARCHAR(500) DEFAULT ''",
            "invoice_accent": "VARCHAR(20) DEFAULT ''",
            "invoice_payment_details": "TEXT DEFAULT ''", "invoice_footer": "VARCHAR(300) DEFAULT ''",
            "bank_account_name": "VARCHAR(160) DEFAULT ''", "bank_name": "VARCHAR(120) DEFAULT ''",
            "bank_sort_code": "VARCHAR(20) DEFAULT ''", "bank_account_number": "VARCHAR(40) DEFAULT ''",
            "invoice_payment_link": "VARCHAR(500) DEFAULT ''", "invoice_payment_link_label": "VARCHAR(80) DEFAULT ''",
            "invoice_notes_default": "TEXT DEFAULT ''", "invoice_deposit_percent": "INTEGER DEFAULT 0",
            "is_comp": "BOOLEAN DEFAULT 0",
        },
        "platform_settings": {"founders": "JSON"},
        "tasks": {"assignee_id": "INTEGER", "due_reminder_for": "VARCHAR(20) DEFAULT ''"},
        "bookings": {"menu_type": "VARCHAR(80) DEFAULT ''"},
        "onboarding_sessions": {
            "meeting_id": "VARCHAR(40) DEFAULT ''", "recording_url": "VARCHAR(500) DEFAULT ''",
        },
        # NB: keep every invoices column in this ONE entry — a second "invoices" key would
        # overwrite this one (dict literal: last key wins) and silently drop the migration.
        "invoices": {
            "file_url": "VARCHAR(500) DEFAULT ''", "file_name": "VARCHAR(255) DEFAULT ''",
            "public_token": "VARCHAR(64) DEFAULT ''",
            "deposit_type": "VARCHAR(10) DEFAULT ''", "deposit_value": "FLOAT DEFAULT 0",
        },
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
