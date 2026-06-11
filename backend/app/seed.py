"""Seed a demo chef account with realistic data so the platform can be explored immediately.

Run:  python -m app.seed
Creates chef@demo.kitchen / demo12345 (subscription active, Pro plan).
"""
from datetime import date, timedelta

from . import config
from .auth import hash_password
from .database import Base, SessionLocal, engine, ensure_columns
from .models import (
    Appointment, Booking, Client, ClientReview, Design, Expense, Idea, InventoryItem, Invoice,
    OnlineOrder, PackingList, Payment, PlatformSettings, Quote, Recipe, RoutePlan, Shift,
    ShoppingList, Supplier, SupplierPrice, Task, User,
)

DEMO_EMAIL = "chef@demo.kitchen"
DEMO_PASSWORD = "demo12345"


def d(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def run():
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    db = SessionLocal()
    try:
        if not db.get(PlatformSettings, 1):
            db.add(PlatformSettings(id=1, currency=config.DEFAULT_CURRENCY, trial_days=0, plans=config.DEFAULT_PLANS))
            db.commit()
        existing = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if existing:
            seed_v2_extras(db, existing)
            print(f"Demo chef already exists: {DEMO_EMAIL} (v2 extras ensured)")
            return

        chef = User(
            email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD),
            name="Caroline Imoesiri", business_name="The Creatiste Kitchen",
            phone="+44 7700 900123", subscription_status="active", plan="elite", onboarding_paid=True,
        )
        db.add(chef)
        db.commit()
        db.refresh(chef)
        uid = chef.id

        db.add_all([
            Payment(user_id=uid, kind="onboarding", amount=199, currency="GBP", provider="demo", note="Onboarding fee — Pro Caterer"),
            Payment(user_id=uid, kind="subscription", amount=69, currency="GBP", provider="demo", note="Monthly subscription — Pro Caterer"),
        ])

        amara = Client(
            user_id=uid, name="Amara Okafor", email="amara@okafor.events", phone="+44 7700 111222",
            company="Okafor Events", address="14 Riverside Walk, London SE1",
            dietary=["pescatarian"], allergies="Shellfish (anaphylaxis — strict)",
            likes="Bold West African flavours, jollof, plantain, anything smoked",
            dislikes="Overly sweet desserts", tags=["repeat", "VIP"],
            notes="Prefers WhatsApp. Always confirms numbers late — chase 5 days out.",
        )
        james = Client(
            user_id=uid, name="James & Priya Whitfield", email="jpwhitfield@gmail.com", phone="+44 7700 333444",
            address="2 Beechwood Avenue, Surrey", dietary=["vegetarian (Priya)"],
            allergies="Tree nuts (mild)", likes="Modern Indian, sharing plates, natural wine pairings",
            dislikes="Coriander (James)", tags=["repeat"],
            notes="Anniversary dinner every June. Kitchen is small — induction only.",
        )
        marcus = Client(
            user_id=uid, name="Marcus Bell", email="m.bell@northstarcap.co", phone="+44 7700 555666",
            company="Northstar Capital", address="Canary Wharf, London", dietary=[],
            allergies="None declared", likes="Classic French, good beef, single malts",
            dislikes="", tags=["corporate"], notes="Quarterly board dinners, 10-14 covers. Invoices via accounts@northstarcap.co (30-day terms).",
        )
        db.add_all([amara, james, marcus])
        db.commit()

        db.add_all([
            ClientReview(user_id=uid, client_id=amara.id, rating=5, date=d(-40),
                         comment="The smoked jollof station was the talk of the party. Flawless service."),
            ClientReview(user_id=uid, client_id=james.id, rating=5, date=d(-180),
                         comment="Best anniversary dinner yet — the paneer course converted James."),
            ClientReview(user_id=uid, client_id=marcus.id, rating=4, date=d(-90),
                         comment="Excellent beef course. Board asked for more wine pairing notes next time."),
        ])

        recipes = [
            Recipe(user_id=uid, title="Smoked Party Jollof", category="Main", cuisine="West African", servings=20,
                   prep_minutes=45, cook_minutes=90, description="Deep, smoky party-style jollof finished over charcoal.",
                   ingredients=[
                       {"id": "i1", "name": "Long grain rice", "qty": 2.5, "unit": "kg", "note": "golden sella holds up for service"},
                       {"id": "i2", "name": "Plum tomatoes", "qty": 2, "unit": "kg", "note": ""},
                       {"id": "i3", "name": "Red bell peppers", "qty": 8, "unit": "pcs", "note": ""},
                       {"id": "i4", "name": "Scotch bonnet", "qty": 4, "unit": "pcs", "note": "adjust to client heat tolerance"},
                       {"id": "i5", "name": "Chicken stock", "qty": 2, "unit": "L", "note": ""},
                       {"id": "i6", "name": "Smoked paprika", "qty": 30, "unit": "g", "note": ""},
                   ],
                   steps=["Blend tomatoes, peppers and scotch bonnet; reduce by half.",
                          "Fry base in onion oil until brick red and split.",
                          "Toast rice in base, add stock, seal with foil + lid.",
                          "Steam 35 min; rest 15 min; finish with charcoal smoke lid for 10 min."],
                   tags=["party", "signature"], allergens=[], cost_per_serving=2.4, price_per_serving=9.5,
                   is_favorite=True),
            Recipe(user_id=uid, title="Miso-Glazed Cod, Charred Greens", category="Main", cuisine="Japanese-British", servings=4,
                   prep_minutes=20, cook_minutes=15, description="48h white-miso cure, blowtorch finish.",
                   ingredients=[
                       {"id": "i1", "name": "Cod loin", "qty": 720, "unit": "g", "note": "4 x 180g portions"},
                       {"id": "i2", "name": "White miso", "qty": 120, "unit": "g", "note": ""},
                       {"id": "i3", "name": "Mirin", "qty": 60, "unit": "ml", "note": ""},
                       {"id": "i4", "name": "Tenderstem broccoli", "qty": 400, "unit": "g", "note": ""},
                   ],
                   steps=["Cure cod in miso/mirin 48h.", "Wipe cure, roast 8 min at 200C.", "Blowtorch glaze; serve on charred greens."],
                   tags=["dinner party"], allergens=["fish", "soy"], cost_per_serving=6.8, price_per_serving=24,
                   is_favorite=True),
            Recipe(user_id=uid, title="Burnt Basque Cheesecake", category="Dessert", cuisine="Spanish", servings=12,
                   prep_minutes=15, cook_minutes=50, description="Crustless, caramelised top, molten centre.",
                   ingredients=[
                       {"id": "i1", "name": "Cream cheese", "qty": 1, "unit": "kg", "note": "room temp"},
                       {"id": "i2", "name": "Double cream", "qty": 500, "unit": "ml", "note": ""},
                       {"id": "i3", "name": "Eggs", "qty": 6, "unit": "pcs", "note": ""},
                       {"id": "i4", "name": "Caster sugar", "qty": 300, "unit": "g", "note": ""},
                   ],
                   steps=["Beat cheese + sugar smooth.", "Add eggs one at a time, then cream + flour.",
                          "Bake 230C for 45-50 min until mahogany; chill overnight."],
                   tags=["make ahead"], allergens=["dairy", "egg", "gluten"], cost_per_serving=1.6, price_per_serving=7.5),
            Recipe(user_id=uid, title="Suya Beef Skewers", category="Canapé", cuisine="West African", servings=30,
                   prep_minutes=40, cook_minutes=10, description="Yaji-spiced sirloin skewers, kankana onions.",
                   ingredients=[
                       {"id": "i1", "name": "Sirloin", "qty": 1.5, "unit": "kg", "note": "thin slice against grain"},
                       {"id": "i2", "name": "Yaji (suya spice)", "qty": 90, "unit": "g", "note": "contains peanuts!"},
                       {"id": "i3", "name": "Red onion", "qty": 4, "unit": "pcs", "note": ""},
                   ],
                   steps=["Slice, oil, dust heavily with yaji.", "Skewer and rest 2h.", "Grill hot 3 min/side; re-dust to serve."],
                   tags=["canapé", "grill"], allergens=["peanuts"], cost_per_serving=1.2, price_per_serving=4.5),
        ]
        db.add_all(recipes)
        db.commit()

        db.add_all([
            InventoryItem(user_id=uid, name="Long grain rice (golden sella)", category="Dry goods", quantity=8, unit="kg",
                          low_stock_threshold=5, storage="dry", purchase_date=d(-20), expiry_date=d(300),
                          cost_per_unit=2.1, supplier="Wing Yip"),
            InventoryItem(user_id=uid, name="White miso paste", category="Condiments", quantity=0.8, unit="kg",
                          low_stock_threshold=1, storage="fridge", purchase_date=d(-30), expiry_date=d(60),
                          cost_per_unit=9.5, supplier="Japan Centre"),
            InventoryItem(user_id=uid, name="Double cream", category="Dairy", quantity=2, unit="L",
                          low_stock_threshold=1, storage="fridge", purchase_date=d(-2), expiry_date=d(5),
                          cost_per_unit=3.2, supplier="Booker"),
            InventoryItem(user_id=uid, name="Cream cheese", category="Dairy", quantity=1.5, unit="kg",
                          low_stock_threshold=1, storage="fridge", purchase_date=d(-3), expiry_date=d(12),
                          cost_per_unit=5.4, supplier="Booker"),
            InventoryItem(user_id=uid, name="Scotch bonnet peppers", category="Produce", quantity=0.3, unit="kg",
                          low_stock_threshold=0.2, storage="fridge", purchase_date=d(-4), expiry_date=d(4),
                          cost_per_unit=8.0, supplier="Brixton Market"),
            InventoryItem(user_id=uid, name="Smoked paprika", category="Spices", quantity=0.4, unit="kg",
                          low_stock_threshold=0.1, storage="pantry", purchase_date=d(-60), expiry_date=d(400),
                          cost_per_unit=14.0, supplier="Online — Sous Chef"),
            InventoryItem(user_id=uid, name="Yaji suya spice", category="Spices", quantity=0.15, unit="kg",
                          low_stock_threshold=0.2, storage="pantry", purchase_date=d(-45), expiry_date=d(200),
                          cost_per_unit=18.0, supplier="Homemade batch"),
            InventoryItem(user_id=uid, name="Charcoal (binchotan)", category="Equipment consumables", quantity=6, unit="kg",
                          low_stock_threshold=3, storage="other", purchase_date=d(-15), expiry_date="",
                          cost_per_unit=7.0, supplier="Online — Konro UK"),
        ])

        booking1 = Booking(
            user_id=uid, client_id=amara.id, title="Okafor 40th Birthday — Garden Party", event_type="Private party",
            status="in_prep", date=d(5), start_time="17:00", end_time="23:30",
            venue_name="Private residence (marquee)", venue_address="14 Riverside Walk, London SE1",
            guest_count=60, quoted_price=4800, deposit_paid=True,
            menu=[
                {"id": "m1", "course": "Canapés", "name": "Suya Beef Skewers", "recipe_id": recipes[3].id, "notes": "peanut allergen signage"},
                {"id": "m2", "course": "Main station", "name": "Smoked Party Jollof", "recipe_id": recipes[0].id, "notes": "live charcoal finish"},
                {"id": "m3", "course": "Main station", "name": "Grilled whole sea bream", "recipe_id": None, "notes": "pescatarian host"},
                {"id": "m4", "course": "Dessert", "name": "Burnt Basque Cheesecake", "recipe_id": recipes[2].id, "notes": "12 wholes, pre-sliced"},
            ],
            equipment=["Charcoal konro x2", "Chafing dishes x6", "60 dinner plates", "Marquee lighting rig"],
            dietary_notes="Host pescatarian; 2 vegan guests; STRICT shellfish allergy (host)",
            setup_notes="Marquee access from 13:00. Buffet line along north wall, dessert table separate.",
            notes="DJ arrives 16:00 — coordinate power. Amara wants a menu card photo for Instagram.",
        )
        booking2 = Booking(
            user_id=uid, client_id=marcus.id, title="Northstar Q2 Board Dinner", event_type="Corporate dinner",
            status="confirmed", date=d(12), start_time="19:00", end_time="22:30",
            venue_name="Northstar boardroom", venue_address="One Canada Square, Canary Wharf",
            guest_count=12, quoted_price=2100, deposit_paid=True,
            menu=[
                {"id": "m1", "course": "Starter", "name": "Miso-Glazed Cod, Charred Greens", "recipe_id": recipes[1].id, "notes": "starter portion 90g"},
                {"id": "m2", "course": "Main", "name": "Herb-crusted beef fillet, pommes Anna", "recipe_id": None, "notes": "medium-rare default"},
                {"id": "m3", "course": "Dessert", "name": "Burnt Basque Cheesecake", "recipe_id": recipes[2].id, "notes": "with PX sherry"},
            ],
            equipment=["Portable induction x2", "Plate warmer"],
            dietary_notes="1 no-dairy (CFO) — swap dessert for sorbet",
            setup_notes="Service lift booking required 48h ahead. Black-tie service.",
            notes="Wine pairing notes printed per cover this time.",
        )
        booking3 = Booking(
            user_id=uid, client_id=james.id, title="Whitfield Anniversary Dinner", event_type="Private dinner",
            status="quoted", date=d(26), start_time="19:30", end_time="22:00",
            venue_name="Client home", venue_address="2 Beechwood Avenue, Surrey",
            guest_count=6, quoted_price=780, deposit_paid=False,
            menu=[], dietary_notes="Priya vegetarian; no coriander for James; tree-nut caution",
            setup_notes="Small induction-only kitchen — prep everything possible offsite.",
            notes="Send menu options by next week.",
        )
        db.add_all([booking1, booking2, booking3])
        db.commit()

        db.add(ShoppingList(
            user_id=uid, booking_id=booking1.id, title="Okafor 40th — main shop", shop_date=d(3), status="open",
            items=[
                {"id": "s1", "name": "Plum tomatoes", "qty": 6, "unit": "kg", "shop": "New Covent Garden", "category": "Produce", "est_cost": 14, "purchased": True, "note": ""},
                {"id": "s2", "name": "Red bell peppers", "qty": 24, "unit": "pcs", "shop": "New Covent Garden", "category": "Produce", "est_cost": 16, "purchased": True, "note": ""},
                {"id": "s3", "name": "Whole sea bream", "qty": 8, "unit": "pcs", "shop": "Billingsgate", "category": "Fish", "est_cost": 96, "purchased": False, "note": "gutted + scaled, 600-800g each"},
                {"id": "s4", "name": "Sirloin (suya)", "qty": 3, "unit": "kg", "shop": "Smithfield — butcher", "category": "Meat", "est_cost": 75, "purchased": False, "note": "ask for whole piece"},
                {"id": "s5", "name": "Plantain (ripe)", "qty": 20, "unit": "pcs", "shop": "Brixton Market", "category": "Produce", "est_cost": 12, "purchased": False, "note": ""},
                {"id": "s6", "name": "Cream cheese", "qty": 3, "unit": "kg", "shop": "Booker", "category": "Dairy", "est_cost": 17, "purchased": False, "note": "for 12 cheesecakes incl. spare"},
            ],
        ))
        db.add(ShoppingList(
            user_id=uid, booking_id=booking2.id, title="Northstar dinner shop", shop_date=d(10), status="open",
            items=[
                {"id": "s1", "name": "Cod loin", "qty": 1.2, "unit": "kg", "shop": "Fishmonger — Moxon's", "category": "Fish", "est_cost": 42, "purchased": False, "note": "centre-cut"},
                {"id": "s2", "name": "Beef fillet (whole)", "qty": 2.2, "unit": "kg", "shop": "HG Walter", "category": "Meat", "est_cost": 130, "purchased": False, "note": "trimmed, barrel cut"},
                {"id": "s3", "name": "Maris Piper potatoes", "qty": 5, "unit": "kg", "shop": "Supermarket", "category": "Produce", "est_cost": 6, "purchased": False, "note": ""},
            ],
        ))

        db.add_all([
            OnlineOrder(user_id=uid, booking_id=booking1.id, supplier="Sous Chef", website="https://www.souschef.co.uk",
                        order_ref="SC-118245", items_summary="Banana leaves x30, smoked salt, cocktail picks x500",
                        order_date=d(-3), expected_date=d(2), status="shipped",
                        tracking_url="https://track.dpd.co.uk/SC-118245", cost=64.5,
                        notes="Needed before Friday prep day"),
            OnlineOrder(user_id=uid, booking_id=booking1.id, supplier="Konro UK", website="https://konro.uk",
                        order_ref="KU-5521", items_summary="Binchotan 10kg + grill grate spare",
                        order_date=d(-6), expected_date=d(1), status="delayed",
                        tracking_url="", cost=89.0, notes="Chase — must arrive before event. Backup: BBQ World Croydon."),
            OnlineOrder(user_id=uid, booking_id=None, supplier="Nisbets", website="https://www.nisbets.co.uk",
                        order_ref="NB-90021", items_summary="Vacuum pouches, blue roll case, probe wipes",
                        order_date=d(-10), expected_date=d(-4), delivered_date=d(-4), status="delivered",
                        cost=43.2, notes=""),
        ])

        db.add_all([
            Task(user_id=uid, booking_id=booking1.id, title="Confirm final numbers with Amara", category="admin",
                 priority="high", status="doing", due_date=d(0), due_time="12:00",
                 description="Currently 60; she hinted it may go to 66. Affects bream count."),
            Task(user_id=uid, booking_id=booking1.id, title="Make yaji spice batch (large)", category="prep",
                 priority="high", status="todo", due_date=d(1), description="Current stock 150g — need 400g. Roast peanuts fresh."),
            Task(user_id=uid, booking_id=booking1.id, title="Billingsgate run — bream + ice", category="shopping",
                 priority="high", status="todo", due_date=d(3), due_time="05:30"),
            Task(user_id=uid, booking_id=booking1.id, title="48h: cure cod? NO — that's Northstar. Marinate suya", category="prep",
                 priority="medium", status="todo", due_date=d(4)),
            Task(user_id=uid, booking_id=booking1.id, title="Pack van: konro, chafers, plates, signage", category="logistics",
                 priority="high", status="todo", due_date=d(5), due_time="10:00"),
            Task(user_id=uid, booking_id=booking2.id, title="Book service lift with building management", category="logistics",
                 priority="high", status="todo", due_date=d(8), description="48h notice required — call facilities."),
            Task(user_id=uid, booking_id=booking2.id, title="Print wine pairing notes per cover", category="admin",
                 priority="low", status="todo", due_date=d(11)),
            Task(user_id=uid, booking_id=booking3.id, title="Send Whitfield menu options (3 routes)", category="admin",
                 priority="medium", status="todo", due_date=d(2)),
            Task(user_id=uid, booking_id=None, title="Deep clean & recalibrate sous vide", category="other",
                 priority="low", status="todo", due_date=d(14)),
        ])

        db.add(RoutePlan(
            user_id=uid, booking_id=booking1.id, title="Okafor prep-day run", date=d(3),
            start_location="Home kitchen, SE15",
            stops=[
                {"id": "r1", "order": 1, "name": "Billingsgate Market", "address": "Trafalgar Way, London E14 5ST", "purpose": "Bream x8, ice", "eta": "05:30", "duration_min": 40, "note": "cash for Micky's stall", "done": False},
                {"id": "r2", "order": 2, "name": "Smithfield — butcher", "address": "Grand Ave, London EC1A 9PS", "purpose": "Sirloin 3kg", "eta": "06:45", "duration_min": 25, "note": "", "done": False},
                {"id": "r3", "order": 3, "name": "Brixton Market", "address": "Electric Ave, London SW9 8JX", "purpose": "Plantain, scotch bonnet, garnish", "eta": "08:00", "duration_min": 30, "note": "", "done": False},
                {"id": "r4", "order": 4, "name": "Booker Peckham", "address": "Ilderton Rd, London SE15 1NT", "purpose": "Dairy + dry goods", "eta": "09:00", "duration_min": 35, "note": "collect pre-order #4471", "done": False},
                {"id": "r5", "order": 5, "name": "Home kitchen", "address": "SE15", "purpose": "Unload, label, start prep", "eta": "10:00", "duration_min": 0, "note": "", "done": False},
            ],
            notes="Van loaded with cool boxes night before. Congestion charge applies after 07:00.",
        ))

        db.add(Design(
            user_id=uid, booking_id=booking1.id, title="Marquee layout — buffet + dessert",
            canvas={"width": 1000, "height": 700, "items": [
                {"id": "d1", "type": "rect_table", "x": 120, "y": 80, "w": 360, "h": 70, "rotation": 0, "label": "Buffet line", "color": "#B4622D"},
                {"id": "d2", "type": "rect_table", "x": 620, "y": 80, "w": 220, "h": 70, "rotation": 0, "label": "Dessert table", "color": "#8A6D3B"},
                {"id": "d3", "type": "round_table", "x": 180, "y": 320, "w": 110, "h": 110, "rotation": 0, "label": "Guest 1", "color": "#5C6F5A"},
                {"id": "d4", "type": "round_table", "x": 420, "y": 360, "w": 110, "h": 110, "rotation": 0, "label": "Guest 2", "color": "#5C6F5A"},
                {"id": "d5", "type": "round_table", "x": 660, "y": 320, "w": 110, "h": 110, "rotation": 0, "label": "Guest 3", "color": "#5C6F5A"},
                {"id": "d6", "type": "bar", "x": 80, "y": 560, "w": 200, "h": 60, "rotation": 0, "label": "Bar", "color": "#1C1A17"},
                {"id": "d7", "type": "stage", "x": 700, "y": 540, "w": 220, "h": 110, "rotation": 0, "label": "DJ", "color": "#444"},
                {"id": "d8", "type": "entrance", "x": 470, "y": 640, "w": 90, "h": 40, "rotation": 0, "label": "Entrance", "color": "#888"},
            ]},
            notes="Keep charcoal konro outside marquee, service side.",
        ))

        db.add_all([
            Idea(user_id=uid, title="Charcoal plantain + scotch bonnet honey", pinned=True,
                 content="Tried at Okafor tasting — blistered plantain, whipped feta, scotch bonnet honey. Could be a signature canapé. Cost ~£0.80/unit.",
                 tags=["canapé", "signature", "west african"]),
            Idea(user_id=uid, title="Mobile menu QR cards", pinned=False,
                 content="Print QR linking to allergen matrix per event. Saves the 'what's in this?' queue at buffets.",
                 tags=["ops", "service"]),
            Idea(user_id=uid, title="Winter supper club series?", pinned=True,
                 content="6 dates, 16 covers, fixed menu, deposit upfront. Use quiet January weeks. Approx £85/head.",
                 tags=["business", "revenue"]),
        ])

        inv1 = Invoice(
            user_id=uid, booking_id=booking1.id, client_id=amara.id, number="INV-2026-001", status="sent",
            issue_date=d(-2), due_date=d(12),
            items=[
                {"id": "l1", "description": "Catering — 40th birthday garden party (60 covers)", "qty": 60, "unit_price": 70},
                {"id": "l2", "description": "Charcoal grill station + chef", "qty": 1, "unit_price": 350},
                {"id": "l3", "description": "Service staff x3 (6h)", "qty": 18, "unit_price": 18},
            ],
            tax_rate=0, discount=274, notes="Deposit £1,200 received — balance due 7 days after event.",
        )
        inv2 = Invoice(
            user_id=uid, booking_id=None, client_id=marcus.id, number="INV-2026-000", status="paid",
            issue_date=d(-60), due_date=d(-30), paid_date=d(-28),
            items=[{"id": "l1", "description": "Q1 board dinner (12 covers)", "qty": 12, "unit_price": 165}],
            tax_rate=0, discount=0, notes="",
        )
        db.add_all([inv1, inv2])

        db.add_all([
            Expense(user_id=uid, booking_id=booking1.id, category="Ingredients", description="New Covent Garden produce",
                    amount=128.40, date=d(-1), supplier="NCG Market"),
            Expense(user_id=uid, booking_id=booking1.id, category="Equipment", description="Binchotan + grate (Konro UK)",
                    amount=89.00, date=d(-6), supplier="Konro UK"),
            Expense(user_id=uid, booking_id=None, category="Travel", description="Congestion charge + parking (March)",
                    amount=47.50, date=d(-12), supplier="TfL"),
            Expense(user_id=uid, booking_id=None, category="Kitchen", description="Vacuum pouches + consumables",
                    amount=43.20, date=d(-4), supplier="Nisbets"),
        ])

        db.commit()
        seed_v2_extras(db, chef)
        print(f"Seeded demo chef: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    finally:
        db.close()




def seed_v2_extras(db, chef):
    """Team, tastings, suppliers, packing and quote demo data (idempotent)."""
    from .auth import hash_password as hp
    import uuid

    chef.plan = "elite"
    if not chef.enquiry_token:
        chef.enquiry_token = uuid.uuid4().hex
    if db.query(User).filter(User.email == "staff@demo.kitchen").first():
        db.commit()
        return
    uid = chef.id
    booking = db.query(Booking).filter(Booking.user_id == uid).order_by(Booking.date.asc()).first()
    bid = booking.id if booking else None

    staff = User(
        email="staff@demo.kitchen", password_hash=hp("demo12345"), name="Tomi Adeyemi",
        job_title="Sous chef", role="staff", owner_id=uid, subscription_status="active",
        business_name=chef.business_name, currency=chef.currency,
    )
    db.add(staff)
    db.flush()

    db.add_all([
        Shift(user_id=uid, staff_id=staff.id, booking_id=bid, date=d(3), start_time="08:00", end_time="16:00",
              role_label="Prep day", location="Home kitchen, SE15", notes="Cheesecakes + suya marinade"),
        Shift(user_id=uid, staff_id=staff.id, booking_id=bid, date=d(5), start_time="13:00", end_time="23:30",
              role_label="Service", location="Marquee — Riverside Walk"),
        Task(user_id=uid, booking_id=bid, assignee_id=staff.id, title="Portion & wrap 12 cheesecakes",
             category="prep", priority="high", status="todo", due_date=d(4)),
        Task(user_id=uid, booking_id=bid, assignee_id=staff.id, title="Label allergen cards for buffet",
             category="service", priority="medium", status="todo", due_date=d(5)),
        Appointment(user_id=uid, title="Tasting — Whitfield anniversary menu", kind="tasting",
                    date=d(9), start_time="14:00", end_time="15:30", location="Client home, Surrey",
                    notes="3 menu routes; no coriander dishes for James", status="scheduled"),
        Appointment(user_id=uid, title="Consultation — corporate Christmas party", kind="consultation",
                    date=d(15), start_time="10:00", end_time="10:45", location="Video call",
                    notes="120 covers, canapés + bowls", status="scheduled"),
        PackingList(user_id=uid, booking_id=bid, title="Okafor 40th — van pack", items=[
            {"id": "p1", "name": "Charcoal konro x2", "qty": 2, "category": "Equipment", "packed": True},
            {"id": "p2", "name": "Chafing dishes", "qty": 6, "category": "Equipment", "packed": False},
            {"id": "p3", "name": "Dinner plates", "qty": 66, "category": "Crockery", "packed": False},
            {"id": "p4", "name": "Allergen signage set", "qty": 1, "category": "Service", "packed": False},
            {"id": "p5", "name": "First aid + burns kit", "qty": 1, "category": "Safety", "packed": True},
        ]),
    ])

    wholesaler = Supplier(user_id=uid, name="Booker Peckham", category="Wholesaler",
                          contact_name="Trade counter", phone="020 7700 1234", account_ref="#4471")
    fish = Supplier(user_id=uid, name="Moxon's Fishmongers", category="Fish",
                    contact_name="Dan", phone="020 7700 5678", notes="Call before 7am for same-day")
    db.add_all([wholesaler, fish])
    db.flush()
    db.add_all([
        SupplierPrice(user_id=uid, supplier_id=wholesaler.id, item_name="Double cream", unit="L", price=3.20, last_checked=d(-2)),
        SupplierPrice(user_id=uid, supplier_id=wholesaler.id, item_name="Cream cheese", unit="kg", price=5.40, last_checked=d(-2)),
        SupplierPrice(user_id=uid, supplier_id=fish.id, item_name="Cod loin", unit="kg", price=34.00, last_checked=d(-7)),
        SupplierPrice(user_id=uid, supplier_id=fish.id, item_name="Whole sea bream", unit="pcs", price=11.50, last_checked=d(-7)),
    ])

    client = db.query(Client).filter(Client.user_id == uid).first()
    db.add(Quote(
        user_id=uid, booking_id=None, client_id=client.id if client else None,
        number="Q-2026-001", title="Whitfield anniversary dinner — proposal",
        items=[{"id": "q1", "description": "Private dinner, 6 covers (3 courses + canapés)", "qty": 6, "unit_price": 110},
               {"id": "q2", "description": "Wine pairing service", "qty": 1, "unit_price": 120}],
        tax_rate=0, discount=0, status="sent", public_token=uuid.uuid4().hex, valid_until=d(14),
        notes="Deposit 30% to confirm the date.",
    ))
    db.commit()
    print("Seeded v2 extras: staff@demo.kitchen / demo12345, rota, suppliers, tasting, packing, quote")


if __name__ == "__main__":
    run()
