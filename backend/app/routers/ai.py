"""AI sous-chef endpoints powered by Claude (Anthropic API).

Every endpoint degrades gracefully: without an API key the routes return 503 with a
human-readable message, and the rest of the platform keeps working."""
import anthropic
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import config
from ..auth import require_active
from ..database import get_db
from ..models import Booking, Client, Idea, InventoryItem, Recipe
from ..utils import extract_json, get_owned, ws_id

router = APIRouter(prefix="/ai", tags=["ai"])

SYSTEM = (
    "You are Mise, the AI sous-chef inside 'The Creatiste Command', a management platform for "
    "professional private chefs and caterers. You are practical, precise and brief. "
    "You understand professional kitchen workflows: prep schedules, supplier shopping, "
    "shelf life, costing and event logistics. Always respond with VALID JSON ONLY — "
    "no prose before or after, no markdown fences."
)


@router.get("/status")
def ai_status():
    from ..mailer import email_enabled

    return {
        "enabled": bool(config.ANTHROPIC_API_KEY),
        "model": config.AI_MODEL,
        "name": "Mise",
        "email_enabled": email_enabled(),
    }


def ask_json(user_prompt: str, max_tokens: int = 8000):
    if not config.ANTHROPIC_API_KEY:
        raise HTTPException(
            503,
            "AI is not configured. Set ANTHROPIC_API_KEY in the backend environment to enable the AI sous-chef.",
        )
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=config.AI_MODEL,
            max_tokens=max_tokens,
            system=SYSTEM,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(503, "AI key rejected — check ANTHROPIC_API_KEY.")
    except anthropic.RateLimitError:
        raise HTTPException(429, "AI rate limit hit — try again in a moment.")
    except anthropic.APIError as exc:
        raise HTTPException(502, f"AI service error: {getattr(exc, 'message', exc)}")
    text = "".join(block.text for block in response.content if block.type == "text")
    try:
        return extract_json(text)
    except ValueError:
        raise HTTPException(502, "AI returned an unreadable response — try again.")


@router.post("/recipe")
def generate_recipe(payload: dict = Body(...), user=Depends(require_active)):
    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(422, "Describe the recipe you want")
    servings = int(payload.get("servings") or 4)
    result = ask_json(
        f"Create a professional recipe master sheet.\n"
        f"Brief: {prompt}\nServings: {servings}\n\n"
        "Return JSON with this exact shape:\n"
        "{\"title\": str, \"category\": str, \"cuisine\": str, \"servings\": int, "
        "\"prep_minutes\": int, \"cook_minutes\": int, \"description\": str (1-2 sentences), "
        "\"ingredients\": [{\"name\": str, \"qty\": number, \"unit\": str, \"note\": str}], "
        "\"steps\": [str], \"tags\": [str], \"allergens\": [str]}"
    )
    return result


@router.post("/shopping-list")
def generate_shopping_list(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
    booking = get_owned(db, Booking, int(payload.get("booking_id") or 0), ws_id(user))
    recipe_ids = [m.get("recipe_id") for m in (booking.menu or []) if m.get("recipe_id")]
    recipes = db.query(Recipe).filter(Recipe.user_id == ws_id(user), Recipe.id.in_(recipe_ids)).all() if recipe_ids else []
    stock = db.query(InventoryItem).filter(InventoryItem.user_id == ws_id(user)).all()

    menu_lines = "\n".join(
        f"- {m.get('course', '')}: {m.get('name', '')} ({m.get('notes') or 'no notes'})" for m in (booking.menu or [])
    ) or "(menu not set — infer sensible items from the event details)"
    recipe_lines = "\n".join(
        f"Recipe '{r.title}' (serves {r.servings}): " + ", ".join(
            f"{i.get('qty', '')} {i.get('unit', '')} {i.get('name', '')}".strip() for i in (r.ingredients or [])
        )
        for r in recipes
    ) or "(no linked recipe sheets)"
    stock_lines = "\n".join(
        f"- {i.name}: {i.quantity} {i.unit} (expires {i.expiry_date or 'n/a'})" for i in stock
    ) or "(stock list empty)"

    result = ask_json(
        f"Build a consolidated shopping list for this booking.\n\n"
        f"EVENT: {booking.title} | {booking.event_type} | {booking.date} | {booking.guest_count} guests\n"
        f"Dietary notes: {booking.dietary_notes or 'none'}\n\n"
        f"MENU:\n{menu_lines}\n\nLINKED RECIPES (scale quantities to {booking.guest_count or 'the'} guests):\n{recipe_lines}\n\n"
        f"CURRENT STOCK (subtract what is already on hand and in date):\n{stock_lines}\n\n"
        "Group items by the most suitable shop type (e.g. Greengrocer, Butcher, Fishmonger, Wholesaler, "
        "Supermarket, Asian supermarket, Online). Estimate realistic costs in the chef's currency.\n"
        "Return JSON: {\"title\": str, \"items\": [{\"name\": str, \"qty\": number, \"unit\": str, "
        "\"shop\": str, \"category\": str, \"est_cost\": number, \"note\": str}]}",
        max_tokens=12000,
    )
    return result


@router.post("/prep-plan")
def generate_prep_plan(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
    booking = get_owned(db, Booking, int(payload.get("booking_id") or 0), ws_id(user))
    menu_lines = "\n".join(f"- {m.get('course', '')}: {m.get('name', '')}" for m in (booking.menu or [])) or "(menu TBC)"
    result = ask_json(
        f"Create a prep & logistics task plan for this booking, working backwards from the event date.\n\n"
        f"EVENT: {booking.title} | {booking.event_type or 'event'} on {booking.date} "
        f"{booking.start_time or ''} | {booking.guest_count} guests at {booking.venue_name or 'venue TBC'}\n"
        f"MENU:\n{menu_lines}\nSetup notes: {booking.setup_notes or 'none'}\n\n"
        "Include shopping days, advance prep (brines/marinades/stocks), day-before prep, pack/load list, "
        "service-day timeline and post-event admin. Use concrete dates (YYYY-MM-DD) on or before the event date.\n"
        "Return JSON: {\"tasks\": [{\"title\": str, \"description\": str, "
        "\"category\": \"prep\"|\"shopping\"|\"admin\"|\"service\"|\"logistics\", "
        "\"priority\": \"low\"|\"medium\"|\"high\", \"due_date\": \"YYYY-MM-DD\", \"due_time\": \"HH:MM\"}]}",
        max_tokens=12000,
    )
    return result


@router.post("/menu-suggest")
def suggest_menu(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
    brief = (payload.get("brief") or "").strip()
    client_block = ""
    if payload.get("client_id"):
        client = get_owned(db, Client, int(payload["client_id"]), ws_id(user))
        client_block = (
            f"CLIENT: {client.name}\nDietary: {', '.join(client.dietary or []) or 'none'}\n"
            f"Allergies: {client.allergies or 'none'}\nLikes: {client.likes or '-'}\nDislikes: {client.dislikes or '-'}\n"
        )
    if not brief and not client_block:
        raise HTTPException(422, "Give a brief or pick a client")
    result = ask_json(
        f"Propose an event menu.\n{client_block}\nBRIEF: {brief or 'chef’s choice, seasonal'}\n\n"
        "Return JSON: {\"menu_name\": str, \"rationale\": str (2 sentences max), "
        "\"courses\": [{\"course\": str, \"name\": str, \"description\": str}]}"
    )
    return result


@router.post("/idea-polish")
def polish_idea(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_active)):
    text = (payload.get("text") or "").strip()
    if payload.get("idea_id"):
        idea = get_owned(db, Idea, int(payload["idea_id"]), ws_id(user))
        text = f"{idea.title}\n{idea.content}".strip()
    if not text:
        raise HTTPException(422, "Nothing to polish")
    result = ask_json(
        f"A chef captured this rough on-the-spot idea:\n---\n{text}\n---\n"
        "Tidy it into a usable note: a sharp title, a clear actionable write-up "
        "(keep the chef's intent, expand abbreviations, suggest 1-2 next steps), and tags.\n"
        "Return JSON: {\"title\": str, \"content\": str, \"tags\": [str]}"
    )
    return result
