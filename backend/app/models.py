"""SQLAlchemy models. Dates/times that the chef edits are stored as plain strings
(YYYY-MM-DD / HH:MM) to keep timezone handling simple; audit timestamps are datetimes."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(120), default="")
    business_name: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")  # doubles as the business logo
    # Business profile — internal "all in one place"; services feed the New Booking dropdown.
    business_description: Mapped[str] = mapped_column(Text, default="")
    business_email: Mapped[str] = mapped_column(String(255), default="")
    services: Mapped[list] = mapped_column(JSON, default=list)   # service / event types offered
    socials: Mapped[dict] = mapped_column(JSON, default=dict)    # {instagram, facebook, tiktok, website, ...}
    gallery: Mapped[list] = mapped_column(JSON, default=list)    # [url] portfolio / gallery photos
    # Public marketing — opt in to be featured (logo + link) on the Creatiste Command site
    feature_publicly: Mapped[bool] = mapped_column(Boolean, default=False)
    testimonial: Mapped[str] = mapped_column(Text, default="")   # optional quote shown in the spotlight
    feature_status: Mapped[str] = mapped_column(String(10), default="none")  # none|pending|approved|rejected (admin review)
    testimonial_rating: Mapped[int] = mapped_column(Integer, default=0)  # chef's own 0–5 star rating for the wall
    # Quick-contact (WhatsApp / email) defaults used by the "Contact client" action
    contact_channel: Mapped[str] = mapped_column(String(10), default="both")   # both | whatsapp | email
    contact_template: Mapped[str] = mapped_column(Text, default="")
    role: Mapped[str] = mapped_column(String(20), default="chef")  # chef | admin | staff
    owner_id: Mapped[int] = mapped_column(Integer, nullable=True)  # staff accounts belong to an owner
    job_title: Mapped[str] = mapped_column(String(120), default="")
    enquiry_token: Mapped[str] = mapped_column(String(64), default="")  # public enquiry-form link
    calendar_token: Mapped[str] = mapped_column(String(64), default="")  # private ICS calendar-feed link
    currency: Mapped[str] = mapped_column(String(8), default="GBP")
    # pending | trialing | active | suspended | canceled
    subscription_status: Mapped[str] = mapped_column(String(20), default="pending")
    plan: Mapped[str] = mapped_column(String(20), default="")
    onboarding_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    trial_ends_at: Mapped[str] = mapped_column(String(10), default="")  # YYYY-MM-DD
    trial_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)  # day-before trial-ending email sent
    # Verification gate: set when the admin marks the onboarding call complete.
    # Empty = not yet onboarded → no workspace access; the trial clock starts here.
    onboarded_at: Mapped[str] = mapped_column(String(10), default="")  # YYYY-MM-DD
    stripe_customer_id: Mapped[str] = mapped_column(String(120), default="")
    stripe_subscription_id: Mapped[str] = mapped_column(String(120), default="")
    # Founders programme (private launch membership — lifetime rate, numbered seat)
    is_founder: Mapped[bool] = mapped_column(Boolean, default=False)
    founder_number: Mapped[int] = mapped_column(Integer, nullable=True)
    founder_since: Mapped[str] = mapped_column(String(10), default="")  # YYYY-MM-DD
    tour_done: Mapped[bool] = mapped_column(Boolean, default=False)  # welcome walkthrough finished
    admin_notes: Mapped[str] = mapped_column(Text, default="")
    # Password reset: a short-lived token emailed to the user (see routers/auth_router.py)
    reset_token: Mapped[str] = mapped_column(String(64), default="")
    reset_token_expires: Mapped[str] = mapped_column(String(40), default="")  # ISO-8601 UTC
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class PlatformSettings(Base):
    __tablename__ = "platform_settings"
    id: Mapped[int] = mapped_column(primary_key=True)  # single row, id=1
    currency: Mapped[str] = mapped_column(String(8), default="GBP")
    trial_days: Mapped[int] = mapped_column(Integer, default=0)
    plans: Mapped[dict] = mapped_column(JSON, default=dict)
    founders: Mapped[dict] = mapped_column(JSON, nullable=True)  # founders programme config (see config.DEFAULT_FOUNDERS)


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="subscription")  # onboarding | subscription | manual
    amount: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="GBP")
    provider: Mapped[str] = mapped_column(String(20), default="demo")  # stripe | demo | manual
    reference: Mapped[str] = mapped_column(String(255), default="")
    note: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class OwnedMixin:
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Client(OwnedMixin, Base):
    __tablename__ = "clients"
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    company: Mapped[str] = mapped_column(String(160), default="")
    address: Mapped[str] = mapped_column(String(400), default="")
    dietary: Mapped[list] = mapped_column(JSON, default=list)     # ["vegetarian", ...]
    allergies: Mapped[str] = mapped_column(Text, default="")
    likes: Mapped[str] = mapped_column(Text, default="")
    dislikes: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")


class ClientReview(OwnedMixin, Base):
    __tablename__ = "client_reviews"
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    rating: Mapped[int] = mapped_column(Integer, default=5)  # 1..5
    comment: Mapped[str] = mapped_column(Text, default="")
    date: Mapped[str] = mapped_column(String(10), default="")


class Recipe(OwnedMixin, Base):
    __tablename__ = "recipes"
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(80), default="")   # Starter / Main / Dessert / Canapé...
    cuisine: Mapped[str] = mapped_column(String(80), default="")
    servings: Mapped[int] = mapped_column(Integer, default=4)
    prep_minutes: Mapped[int] = mapped_column(Integer, default=0)
    cook_minutes: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(Text, default="")
    ingredients: Mapped[list] = mapped_column(JSON, default=list)   # [{id,name,qty,unit,note}]
    steps: Mapped[list] = mapped_column(JSON, default=list)         # [str]
    tags: Mapped[list] = mapped_column(JSON, default=list)
    allergens: Mapped[list] = mapped_column(JSON, default=list)
    image_url: Mapped[str] = mapped_column(String(500), default="")
    cost_per_serving: Mapped[float] = mapped_column(Float, default=0)
    price_per_serving: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)


class Menu(OwnedMixin, Base):
    """A set menu doc the chef keeps live and shares with clients (as a PDF). Courses can
    be built from finished recipes; an uploaded PDF is the shareable version."""
    __tablename__ = "menus"
    title: Mapped[str] = mapped_column(String(200))
    menu_type: Mapped[str] = mapped_column(String(80), default="")   # Tasting / Set / Canapé / Buffet…
    description: Mapped[str] = mapped_column(Text, default="")
    price_per_head: Mapped[float] = mapped_column(Float, default=0)
    courses: Mapped[list] = mapped_column(JSON, default=list)        # [{id,course,name,recipe_id,notes}]
    pdf_url: Mapped[str] = mapped_column(String(500), default="")    # attached, shareable PDF
    pdf_name: Mapped[str] = mapped_column(String(255), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)      # live / archived
    notes: Mapped[str] = mapped_column(Text, default="")


class InventoryItem(OwnedMixin, Base):
    __tablename__ = "inventory_items"
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(80), default="")   # Produce / Dairy / Dry / Protein...
    quantity: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(30), default="")
    low_stock_threshold: Mapped[float] = mapped_column(Float, default=0)
    storage: Mapped[str] = mapped_column(String(30), default="pantry")  # pantry|fridge|freezer|dry|other
    purchase_date: Mapped[str] = mapped_column(String(10), default="")
    expiry_date: Mapped[str] = mapped_column(String(10), default="")
    cost_per_unit: Mapped[float] = mapped_column(Float, default=0)
    supplier: Mapped[str] = mapped_column(String(160), default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class Booking(OwnedMixin, Base):
    __tablename__ = "bookings"
    client_id: Mapped[int] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    event_type: Mapped[str] = mapped_column(String(80), default="")  # Wedding / Private dinner...
    menu_type: Mapped[str] = mapped_column(String(80), default="")    # set menu chosen for this event (from Menus)
    status: Mapped[str] = mapped_column(String(20), default="enquiry")  # enquiry|quoted|confirmed|in_prep|completed|cancelled
    date: Mapped[str] = mapped_column(String(10), default="")
    start_time: Mapped[str] = mapped_column(String(5), default="")
    end_time: Mapped[str] = mapped_column(String(5), default="")
    venue_name: Mapped[str] = mapped_column(String(200), default="")
    venue_address: Mapped[str] = mapped_column(String(400), default="")
    guest_count: Mapped[int] = mapped_column(Integer, default=0)
    quoted_price: Mapped[float] = mapped_column(Float, default=0)
    deposit_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    menu: Mapped[list] = mapped_column(JSON, default=list)       # [{id,course,name,recipe_id,notes}]
    equipment: Mapped[list] = mapped_column(JSON, default=list)  # [str]
    dietary_notes: Mapped[str] = mapped_column(Text, default="")
    setup_notes: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class ShoppingList(OwnedMixin, Base):
    __tablename__ = "shopping_lists"
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    shop_date: Mapped[str] = mapped_column(String(10), default="")
    status: Mapped[str] = mapped_column(String(10), default="open")  # open | done
    items: Mapped[list] = mapped_column(JSON, default=list)  # [{id,name,qty,unit,shop,category,est_cost,purchased,note}]
    notes: Mapped[str] = mapped_column(Text, default="")


class OnlineOrder(OwnedMixin, Base):
    __tablename__ = "online_orders"
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    supplier: Mapped[str] = mapped_column(String(200))
    website: Mapped[str] = mapped_column(String(400), default="")
    order_ref: Mapped[str] = mapped_column(String(120), default="")
    items_summary: Mapped[str] = mapped_column(Text, default="")
    order_date: Mapped[str] = mapped_column(String(10), default="")
    expected_date: Mapped[str] = mapped_column(String(10), default="")
    delivered_date: Mapped[str] = mapped_column(String(10), default="")
    status: Mapped[str] = mapped_column(String(20), default="to_order")  # to_order|ordered|shipped|delivered|delayed|cancelled
    tracking_url: Mapped[str] = mapped_column(String(500), default="")
    cost: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")


class Task(OwnedMixin, Base):
    __tablename__ = "tasks"
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(20), default="prep")  # prep|shopping|admin|service|logistics|other
    priority: Mapped[str] = mapped_column(String(10), default="medium")  # low|medium|high
    status: Mapped[str] = mapped_column(String(10), default="todo")  # todo|doing|done
    due_date: Mapped[str] = mapped_column(String(10), default="")
    due_time: Mapped[str] = mapped_column(String(5), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    assignee_id: Mapped[int] = mapped_column(Integer, nullable=True)  # staff member assigned by the owner
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class RoutePlan(OwnedMixin, Base):
    __tablename__ = "route_plans"
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    date: Mapped[str] = mapped_column(String(10), default="")
    start_location: Mapped[str] = mapped_column(String(400), default="")
    stops: Mapped[list] = mapped_column(JSON, default=list)  # [{id,order,name,address,purpose,eta,duration_min,note,done}]
    notes: Mapped[str] = mapped_column(Text, default="")


class Design(OwnedMixin, Base):
    __tablename__ = "designs"
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    canvas: Mapped[dict] = mapped_column(JSON, default=dict)  # {width,height,items:[{id,type,x,y,w,h,rotation,label,color}]}
    notes: Mapped[str] = mapped_column(Text, default="")


class Idea(OwnedMixin, Base):
    __tablename__ = "ideas"
    title: Mapped[str] = mapped_column(String(200), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)


class Invoice(OwnedMixin, Base):
    __tablename__ = "invoices"
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    client_id: Mapped[int] = mapped_column(Integer, nullable=True)
    number: Mapped[str] = mapped_column(String(40), default="")
    status: Mapped[str] = mapped_column(String(10), default="draft")  # draft|sent|paid|overdue|void
    issue_date: Mapped[str] = mapped_column(String(10), default="")
    due_date: Mapped[str] = mapped_column(String(10), default="")
    paid_date: Mapped[str] = mapped_column(String(10), default="")
    items: Mapped[list] = mapped_column(JSON, default=list)  # [{id,description,qty,unit_price}]
    tax_rate: Mapped[float] = mapped_column(Float, default=0)  # percent
    discount: Mapped[float] = mapped_column(Float, default=0)  # absolute
    notes: Mapped[str] = mapped_column(Text, default="")


class Expense(OwnedMixin, Base):
    __tablename__ = "expenses"
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    category: Mapped[str] = mapped_column(String(80), default="")  # Ingredients / Equipment / Travel / Staff...
    description: Mapped[str] = mapped_column(String(300), default="")
    amount: Mapped[float] = mapped_column(Float, default=0)
    date: Mapped[str] = mapped_column(String(10), default="")
    supplier: Mapped[str] = mapped_column(String(160), default="")
    receipt_url: Mapped[str] = mapped_column(String(500), default="")


class Appointment(OwnedMixin, Base):
    """Tastings, consultations, site visits and calls."""
    __tablename__ = "appointments"
    client_id: Mapped[int] = mapped_column(Integer, nullable=True)
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20), default="tasting")  # tasting|consultation|site_visit|call
    date: Mapped[str] = mapped_column(String(10), default="")
    start_time: Mapped[str] = mapped_column(String(5), default="")
    end_time: Mapped[str] = mapped_column(String(5), default="")
    location: Mapped[str] = mapped_column(String(400), default="")
    status: Mapped[str] = mapped_column(String(20), default="scheduled")  # scheduled|completed|cancelled
    notes: Mapped[str] = mapped_column(Text, default="")
    outcome: Mapped[str] = mapped_column(Text, default="")


class Shift(OwnedMixin, Base):
    """Staff rota entries."""
    __tablename__ = "shifts"
    staff_id: Mapped[int] = mapped_column(Integer, nullable=True)
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    date: Mapped[str] = mapped_column(String(10), default="")
    start_time: Mapped[str] = mapped_column(String(5), default="")
    end_time: Mapped[str] = mapped_column(String(5), default="")
    role_label: Mapped[str] = mapped_column(String(120), default="")  # e.g. Service / KP / Grill
    location: Mapped[str] = mapped_column(String(300), default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class PackingList(OwnedMixin, Base):
    __tablename__ = "packing_lists"
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    items: Mapped[list] = mapped_column(JSON, default=list)  # [{id,name,qty,category,packed}]
    notes: Mapped[str] = mapped_column(Text, default="")


class Supplier(OwnedMixin, Base):
    __tablename__ = "suppliers"
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(120), default="")
    contact_name: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    website: Mapped[str] = mapped_column(String(400), default="")
    address: Mapped[str] = mapped_column(String(400), default="")
    account_ref: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class SupplierPrice(OwnedMixin, Base):
    __tablename__ = "supplier_prices"
    supplier_id: Mapped[int] = mapped_column(Integer, index=True)
    item_name: Mapped[str] = mapped_column(String(200))
    unit: Mapped[str] = mapped_column(String(40), default="")
    price: Mapped[float] = mapped_column(Float, default=0)
    last_checked: Mapped[str] = mapped_column(String(10), default="")
    notes: Mapped[str] = mapped_column(String(300), default="")


class Quote(OwnedMixin, Base):
    """Client-facing quotes with a public approval link."""
    __tablename__ = "quotes"
    booking_id: Mapped[int] = mapped_column(Integer, nullable=True)
    client_id: Mapped[int] = mapped_column(Integer, nullable=True)
    number: Mapped[str] = mapped_column(String(40), default="")
    title: Mapped[str] = mapped_column(String(200), default="")
    items: Mapped[list] = mapped_column(JSON, default=list)  # [{id,description,qty,unit_price}]
    tax_rate: Mapped[float] = mapped_column(Float, default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|sent|approved|declined|expired
    public_token: Mapped[str] = mapped_column(String(64), default="", index=True)
    valid_until: Mapped[str] = mapped_column(String(10), default="")
    responded_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    responder_name: Mapped[str] = mapped_column(String(160), default="")
    client_comment: Mapped[str] = mapped_column(Text, default="")


class ActivityLog(Base):
    """Audit trail: every change in a workspace, attributed to whoever made it."""
    __tablename__ = "activity_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)        # workspace owner
    actor_id: Mapped[int] = mapped_column(Integer, nullable=True)
    actor_name: Mapped[str] = mapped_column(String(160), default="")
    actor_role: Mapped[str] = mapped_column(String(20), default="")  # owner|staff|client
    action: Mapped[str] = mapped_column(String(20), default="")      # created|updated|deleted|completed
    entity_type: Mapped[str] = mapped_column(String(60), default="")
    entity_id: Mapped[int] = mapped_column(Integer, nullable=True)
    summary: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class OnboardingSession(Base):
    """Bookable video calls with the platform owner: the mandatory onboarding /
    verification session for every new client, and founders' day-5 check-in calls."""
    __tablename__ = "onboarding_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="onboarding")  # onboarding | checkin
    date: Mapped[str] = mapped_column(String(10), default="")   # YYYY-MM-DD
    start_time: Mapped[str] = mapped_column(String(5), default="")  # HH:MM
    duration_min: Mapped[int] = mapped_column(Integer, default=45)
    meeting_url: Mapped[str] = mapped_column(String(500), default="")
    meeting_id: Mapped[str] = mapped_column(String(40), default="")     # provider meeting id (Zoom) — matches the recording webhook back to this call
    provider: Mapped[str] = mapped_column(String(20), default="jitsi")  # zoom | jitsi | custom
    recording_url: Mapped[str] = mapped_column(String(500), default="")  # Zoom cloud-recording share link
    status: Mapped[str] = mapped_column(String(20), default="booked")  # booked | completed | cancelled | no_show
    notes: Mapped[str] = mapped_column(Text, default="")        # admin notes
    transcript: Mapped[str] = mapped_column(Text, default="")   # pasted call transcript
    ai_summary: Mapped[str] = mapped_column(Text, default="")   # Claude-generated key points
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class BlockedSlot(Base):
    """Admin time-off: a day or single slot the platform owner has blocked out, removed
    from the bookable availability shown to clients. A whole day off is a row with an
    empty start_time; a single blocked slot carries the HH:MM. Times are local to
    config.ONBOARDING_TZ (Europe/London), matching the slots clients see."""
    __tablename__ = "blocked_slots"
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[str] = mapped_column(String(10), index=True)   # YYYY-MM-DD
    start_time: Mapped[str] = mapped_column(String(5), default="")  # "" = the whole day
    note: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FounderFeedback(Base):
    """Day-5 founders check-in: thoughts on the programme, how it benefited them,
    and what they'd change — one (updatable) entry per founding member."""
    __tablename__ = "founder_feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    thoughts: Mapped[str] = mapped_column(Text, default="")
    benefits: Mapped[str] = mapped_column(Text, default="")
    changes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), default="")
    name: Mapped[str] = mapped_column(String(160), default="")
    subject: Mapped[str] = mapped_column(String(300), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), default="open")  # open | closed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
