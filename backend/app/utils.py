"""Shared helpers: serialization, payload sanitising and a generic owner-scoped CRUD router."""
import json
import re
from datetime import date, datetime

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .auth import require_active
from .database import get_db

PROTECTED_FIELDS = {"id", "user_id", "created_at", "updated_at", "password_hash"}


def to_dict(obj, exclude=()):
    out = {}
    for col in obj.__table__.columns:
        if col.name in exclude:
            continue
        val = getattr(obj, col.name)
        if isinstance(val, (datetime, date)):
            val = val.isoformat()
        out[col.name] = val
    return out


def editable_fields(model):
    return {c.name for c in model.__table__.columns} - PROTECTED_FIELDS


def apply_payload(obj, model, payload: dict):
    allowed = editable_fields(model)
    for key, value in payload.items():
        if key in allowed:
            setattr(obj, key, value)


def crud_router(model, *, required=("title",), search_fields=(), default_order=None):
    """Standard owner-scoped CRUD. Routers can add custom endpoints on top."""
    router = APIRouter()

    @router.get("")
    def list_items(
        booking_id: int | None = None,
        client_id: int | None = None,
        q: str | None = None,
        db: Session = Depends(get_db),
        user=Depends(require_active),
    ):
        query = db.query(model).filter(model.user_id == user.id)
        if booking_id is not None and hasattr(model, "booking_id"):
            query = query.filter(model.booking_id == booking_id)
        if client_id is not None and hasattr(model, "client_id"):
            query = query.filter(model.client_id == client_id)
        if q and search_fields:
            like = f"%{q}%"
            query = query.filter(or_(*[getattr(model, f).ilike(like) for f in search_fields]))
        order = default_order(model) if default_order else [model.created_at.desc()]
        return [to_dict(o) for o in query.order_by(*order).all()]

    @router.post("", status_code=201)
    def create_item(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
        for field in required:
            if not payload.get(field):
                raise HTTPException(422, f"'{field}' is required")
        obj = model(user_id=user.id)
        apply_payload(obj, model, payload)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return to_dict(obj)

    @router.get("/{item_id}")
    def get_item(item_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
        obj = db.get(model, item_id)
        if not obj or obj.user_id != user.id:
            raise HTTPException(404, "Not found")
        return to_dict(obj)

    @router.patch("/{item_id}")
    def update_item(item_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
        obj = db.get(model, item_id)
        if not obj or obj.user_id != user.id:
            raise HTTPException(404, "Not found")
        apply_payload(obj, model, payload)
        db.commit()
        db.refresh(obj)
        return to_dict(obj)

    @router.delete("/{item_id}", status_code=204)
    def delete_item(item_id: int, db: Session = Depends(get_db), user=Depends(require_active)):
        obj = db.get(model, item_id)
        if not obj or obj.user_id != user.id:
            raise HTTPException(404, "Not found")
        db.delete(obj)
        db.commit()

    return router


def get_owned(db: Session, model, item_id: int, user_id: int):
    obj = db.get(model, item_id)
    if not obj or obj.user_id != user_id:
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def extract_json(text: str):
    """Pull the first JSON object/array out of an LLM response (handles ``` fences)."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = min((i for i in (text.find("{"), text.find("[")) if i >= 0), default=-1)
    if start == -1:
        raise ValueError("No JSON found in AI response")
    decoder = json.JSONDecoder()
    for idx in range(start, len(text)):
        if text[idx] in "[{":
            try:
                obj, _ = decoder.raw_decode(text[idx:])
                return obj
            except json.JSONDecodeError:
                continue
    raise ValueError("No JSON found in AI response")
