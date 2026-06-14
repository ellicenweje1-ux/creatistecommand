"""Team module: staff logins, rota (shifts), assignments and the owner's activity trail.
Staff log in with their own account and work inside the owner's workspace — every change
they make is recorded in the activity log."""
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import mailer
from ..auth import hash_password, require_active, require_owner, require_plan
from ..database import get_db
from ..models import ActivityLog, Booking, Shift, Task, User
from ..utils import EMAIL_RE, crud_router, log_activity, to_dict, ws_id

TEAM_PLAN = 3  # Elite Kitchen

# Rota entries — workspace-scoped CRUD (staff edits are audit-logged like everything else)
shifts = crud_router(
    Shift, required=("date",), search_fields=("role_label", "location"),
    default_order=lambda m: [m.date.asc(), m.start_time.asc()], min_plan=TEAM_PLAN,
)

router = APIRouter(prefix="/team", tags=["team"], dependencies=[Depends(require_plan(TEAM_PLAN))])

STAFF_EXCLUDE = ("password_hash", "reset_token", "reset_token_expires", "stripe_customer_id", "stripe_subscription_id", "admin_notes")


@router.get("/staff")
def list_staff(db: Session = Depends(get_db), user=Depends(require_active)):
    rows = db.query(User).filter(User.role == "staff", User.owner_id == ws_id(user)).order_by(User.name.asc()).all()
    return [to_dict(u, exclude=STAFF_EXCLUDE) for u in rows]


@router.post("/staff", status_code=201)
def create_staff(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_owner)):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Enter a valid email for the staff member")
    if len(password) < 8:
        raise HTTPException(422, "Set a password of at least 8 characters")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "An account with this email already exists")
    staff = User(
        email=email, password_hash=hash_password(password),
        name=(payload.get("name") or "").strip(), job_title=(payload.get("job_title") or "").strip(),
        phone=(payload.get("phone") or "").strip(),
        role="staff", owner_id=ws_id(user), subscription_status="active",
        business_name=user.business_name, currency=user.currency,
    )
    db.add(staff)
    db.flush()
    log_activity(db, user, "created", staff, entity_type="StaffAccount", summary=staff.name or staff.email)
    db.commit()
    db.refresh(staff)
    mailer.send_email(
        email, f"You've been added to {user.business_name or 'the kitchen'} on The Creatiste Command",
        f"Hi {staff.name or ''},\n\n{user.name or 'The owner'} has set you up with a staff login.\n"
        f"Log in with this email address at the platform — your password was set by the owner.\n\n— The Creatiste Command",
    )
    return to_dict(staff, exclude=STAFF_EXCLUDE)


@router.patch("/staff/{staff_id}")
def update_staff(staff_id: int, payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_owner)):
    staff = db.get(User, staff_id)
    if not staff or staff.role != "staff" or staff.owner_id != ws_id(user):
        raise HTTPException(404, "Staff member not found")
    for field in ("name", "job_title", "phone"):
        if field in payload:
            setattr(staff, field, payload[field] or "")
    if "active" in payload:  # deactivate = block login without deleting history
        staff.subscription_status = "active" if payload["active"] else "suspended"
    if payload.get("password"):
        if len(payload["password"]) < 8:
            raise HTTPException(422, "Password must be at least 8 characters")
        staff.password_hash = hash_password(payload["password"])
    log_activity(db, user, "updated", staff, entity_type="StaffAccount", summary=staff.name or staff.email)
    db.commit()
    db.refresh(staff)
    return to_dict(staff, exclude=STAFF_EXCLUDE)


@router.delete("/staff/{staff_id}", status_code=204)
def delete_staff(staff_id: int, db: Session = Depends(get_db), user=Depends(require_owner)):
    staff = db.get(User, staff_id)
    if not staff or staff.role != "staff" or staff.owner_id != ws_id(user):
        raise HTTPException(404, "Staff member not found")
    log_activity(db, user, "deleted", staff, entity_type="StaffAccount", summary=staff.name or staff.email)
    db.query(Task).filter(Task.user_id == ws_id(user), Task.assignee_id == staff_id).update({"assignee_id": None})
    db.query(Shift).filter(Shift.user_id == ws_id(user), Shift.staff_id == staff_id).delete()
    db.delete(staff)
    db.commit()


@router.post("/assignments", status_code=201)
def assign_task(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_owner)):
    """Create a task assigned to a staff member (the streamlined 'set tasks for staff' path)."""
    staff = db.get(User, int(payload.get("staff_id") or 0))
    if not staff or staff.role != "staff" or staff.owner_id != ws_id(user):
        raise HTTPException(404, "Staff member not found")
    if not payload.get("title"):
        raise HTTPException(422, "'title' is required")
    task = Task(
        user_id=ws_id(user), assignee_id=staff.id, title=payload["title"],
        description=payload.get("description") or "", category=payload.get("category") or "prep",
        priority=payload.get("priority") or "medium", due_date=payload.get("due_date") or "",
        due_time=payload.get("due_time") or "", booking_id=payload.get("booking_id"), status="todo",
    )
    db.add(task)
    db.flush()
    log_activity(db, user, "created", task, entity_type="Assignment",
                 summary=f"{task.title} → {staff.name or staff.email}")
    db.commit()
    db.refresh(task)
    mailer.send_email(
        staff.email, f"New assignment: {task.title}",
        f"Hi {staff.name or ''},\n\n{user.name or 'The owner'} assigned you a task:\n"
        f"{task.title}\nDue: {task.due_date or 'no date'} {task.due_time or ''}\n{task.description}\n\n— The Creatiste Command",
    )
    return to_dict(task)


@router.get("/activity")
def activity(actor_id: int | None = None, limit: int = 100, db: Session = Depends(get_db), user=Depends(require_owner)):
    """The owner's oversight trail — every change in the workspace, who made it, when."""
    query = db.query(ActivityLog).filter(ActivityLog.user_id == ws_id(user))
    if actor_id:
        query = query.filter(ActivityLog.actor_id == actor_id)
    rows = query.order_by(ActivityLog.created_at.desc()).limit(min(limit, 300)).all()
    return [to_dict(a) for a in rows]


@router.get("/me")
def my_view(db: Session = Depends(get_db), user=Depends(require_active)):
    """A staff member's own corner: their shifts and their assigned tasks."""
    my_shifts = (
        db.query(Shift).filter(Shift.user_id == ws_id(user), Shift.staff_id == user.id)
        .order_by(Shift.date.asc(), Shift.start_time.asc()).all()
    )
    my_tasks = (
        db.query(Task).filter(Task.user_id == ws_id(user), Task.assignee_id == user.id)
        .order_by(Task.status.asc(), Task.due_date.asc()).all()
    )
    bookings = {b.id: b.title for b in db.query(Booking).filter(Booking.user_id == ws_id(user)).all()}
    return {
        "shifts": [{**to_dict(s), "booking_title": bookings.get(s.booking_id)} for s in my_shifts],
        "tasks": [{**to_dict(t), "booking_title": bookings.get(t.booking_id)} for t in my_tasks],
    }
