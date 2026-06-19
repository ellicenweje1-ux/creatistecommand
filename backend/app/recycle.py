"""Recycle bin — self-service recovery of deleted workspace items.

When a chef deletes a workspace item (recipe, client, list, …) the whole row is
snapshotted into deleted_items instead of being lost, so they can restore it themselves
within config.RECYCLE_RETENTION_DAYS. After that it's auto-purged (by the scheduler and
opportunistically when the bin is read). Snapshot-based, so existing list/get queries are
untouched — there's no risk of a "deleted" row leaking back into normal views."""
import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import config
from .auth import require_active
from .database import get_db
from .models import (
    Appointment, Client, DeletedItem, Design, Idea, InventoryItem, Menu, OnlineOrder,
    PackingList, Recipe, RoutePlan, ShoppingList, Supplier, SupplierPrice, Task,
)
from .utils import entity_label, to_dict, ws_id

log = logging.getLogger("recycle")

# Everything built on the crud_router factory — i.e. every item a chef can delete + restore.
RECOVERABLE = [
    Recipe, Menu, InventoryItem, Client, Idea, Design, OnlineOrder, ShoppingList,
    Task, RoutePlan, Appointment, PackingList, Supplier, SupplierPrice,
]
REGISTRY = {m.__tablename__: m for m in RECOVERABLE}

# Friendly type names for the "Recently deleted" list.
FRIENDLY = {
    Recipe.__tablename__: "Recipe",
    Menu.__tablename__: "Menu",
    InventoryItem.__tablename__: "Inventory item",
    Client.__tablename__: "Client",
    Idea.__tablename__: "Note",
    Design.__tablename__: "Design",
    OnlineOrder.__tablename__: "Order",
    ShoppingList.__tablename__: "Shopping list",
    Task.__tablename__: "Task",
    RoutePlan.__tablename__: "Route",
    Appointment.__tablename__: "Appointment",
    PackingList.__tablename__: "Packing list",
    Supplier.__tablename__: "Supplier",
    SupplierPrice.__tablename__: "Supplier price",
}


def _now() -> datetime:
    # SQLite stores naive datetimes; compare in naive-UTC to match the read-back values.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _as_naive(dt: datetime | None) -> datetime:
    if not dt:
        return _now()
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _days_left(item: DeletedItem) -> int:
    age = (_now() - _as_naive(item.deleted_at)).days
    return max(0, config.RECYCLE_RETENTION_DAYS - age)


def snapshot_deletion(db: Session, user, obj) -> None:
    """Record a row in the recycle bin just before it's deleted. Best-effort — a snapshot
    failure must never block the delete the chef actually asked for."""
    if obj.__tablename__ not in REGISTRY:
        return
    try:
        db.add(DeletedItem(
            user_id=ws_id(user),
            actor_id=user.id,
            actor_name=user.name or user.email,
            table_name=obj.__tablename__,
            entity_type=type(obj).__name__,
            label=entity_label(obj),
            payload=to_dict(obj),
        ))
    except Exception as exc:  # noqa: BLE001 — never let the bin break a delete
        log.warning("recycle snapshot failed for %s: %s", obj.__tablename__, exc)


def purge_expired(db: Session) -> int:
    """Delete bin entries past the retention window. Returns how many were purged."""
    cutoff = _now() - timedelta(days=config.RECYCLE_RETENTION_DAYS)
    q = db.query(DeletedItem).filter(DeletedItem.deleted_at < cutoff)
    n = q.count()
    if n:
        q.delete(synchronize_session=False)
        db.commit()
    return n


def _coerce(col, value):
    """Turn a JSON-snapshot value back into the right Python type for its column."""
    if value is None:
        return None
    kind = col.type.__class__.__name__
    if kind == "DateTime" and isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    if kind == "Date" and isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return value


def restore_item(db: Session, item: DeletedItem):
    """Re-insert a snapshotted row into its original table, then drop the bin entry.
    Keeps the original id when it's still free (so references survive); otherwise the DB
    assigns a fresh one. Returns the restored ORM object."""
    model = REGISTRY.get(item.table_name)
    if not model:
        raise HTTPException(400, "This type of item can no longer be restored.")
    payload = dict(item.payload or {})
    item_id, ws = item.id, item.user_id
    cols = {c.name: c for c in model.__table__.columns}

    def build(include_id: bool):
        obj = model()
        for name, value in payload.items():
            if name == "id" and not include_id:
                continue
            col = cols.get(name)
            if col is not None:
                setattr(obj, name, _coerce(col, value))
        obj.user_id = ws  # always restore into the owning workspace
        return obj

    orig_id = payload.get("id")
    # Reuse the original id only if nothing has taken it since (preserves links); the
    # try/except is a belt-and-braces guard against a rare concurrent insert.
    keep_id = orig_id is not None and db.get(model, orig_id) is None
    obj = build(include_id=keep_id)
    db.add(obj)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        obj = build(include_id=False)
        db.add(obj)
        db.flush()
    db.query(DeletedItem).filter(DeletedItem.id == item_id).delete(synchronize_session=False)
    db.commit()
    db.refresh(obj)
    return obj


# --- API ----------------------------------------------------------------------------------
router = APIRouter(prefix="/recycle", tags=["recycle"])


@router.get("")
def list_deleted(db: Session = Depends(get_db), user=Depends(require_active)):
    purge_expired(db)
    rows = (
        db.query(DeletedItem)
        .filter(DeletedItem.user_id == ws_id(user))
        .order_by(DeletedItem.deleted_at.desc())
        .all()
    )
    return {
        "retention_days": config.RECYCLE_RETENTION_DAYS,
        "items": [
            {
                "id": r.id,
                "kind": FRIENDLY.get(r.table_name, r.entity_type or "Item"),
                "label": r.label or f"#{r.id}",
                "deleted_at": r.deleted_at.isoformat() if r.deleted_at else "",
                "deleted_by": r.actor_name,
                "days_left": _days_left(r),
                "restorable": r.table_name in REGISTRY,
            }
            for r in rows
        ],
    }


@router.post("/{item_id}/restore")
def restore(item_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
    item = db.get(DeletedItem, item_id)
    if not item or item.user_id != ws_id(user):
        raise HTTPException(404, "Not found")
    kind = FRIENDLY.get(item.table_name, item.entity_type or "Item")
    label = item.label
    obj = restore_item(db, item)
    return {"restored": True, "kind": kind, "label": label, "id": getattr(obj, "id", None)}


@router.delete("/{item_id}", status_code=204)
def delete_forever(item_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
    item = db.get(DeletedItem, item_id)
    if not item or item.user_id != ws_id(user):
        raise HTTPException(404, "Not found")
    db.delete(item)
    db.commit()


@router.delete("", status_code=204)
def empty_bin(db: Session = Depends(get_db), user=Depends(require_active)):
    db.query(DeletedItem).filter(DeletedItem.user_id == ws_id(user)).delete(synchronize_session=False)
    db.commit()
