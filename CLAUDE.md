# CLAUDE.md — project handover & working notes

Read this first in every new session. It replaces lost chat history.

**Founder / platform owner:** Ellice Nweje — founder of The Creatiste Command
(account owner, ellicenweje1@gmail.com). Ellice runs The Creatiste Catering and built
this platform; all decisions are hers. (Git-history heads-up: some early commits were
authored under a relative's Google login that was used to access Claude, so older
commit authorship may show a different name/email — the project is entirely Ellice's.)

## Owner feedback backlog — live list, collected from 2026-06-16 (Ellice, from real use)
Ellice is sending pointers "in bits" from using the live platform. Capture each here as it lands
so nothing is lost between sessions. Status: 🔲 not started · 🛠️ in progress · ✅ done · ❓ answered.

1. ✅ **"Keep me logged in" / stay signed in — DONE (22nd wave).** Fixed by the persistent disk (#2):
   `DATA_DIR/.secret_key` now survives deploys, so the SQLite-wipe logout cause is gone. (Original analysis below.) Today: JWT in `localStorage` (`cc_token`),
   `TOKEN_TTL_DAYS=7` — sessions already persist ~7 days, then 401 → `/login`. The likely real
   cause of surprise logouts is the **free-tier SQLite wipe on every deploy** (user row vanishes →
   `get_current_user` 401 "User no longer exists" → `api.js` clears the token). Plan: add the
   persistent disk (infra — see #2) AND optionally lengthen the TTL + add sliding refresh and/or a
   "Remember me" choice on login.
2. ✅ **"How do my updates affect live users in real time?" — answered; and its URGENT disk caveat is now DONE (22nd wave): the persistent disk + always-on Starter are live & verified, so deploys no longer wipe data.** — answered in chat. Merge→`main`→
   Render redeploys (~1–3 min build; brief blip on the free tier's single instance); existing
   logins survive a deploy (token is client-side, `SECRET_KEY` is a stable env var); a user with the
   app already open keeps the old frontend until they reload/navigate (SW is network-first, so a
   reload picks up the new build); `ensure_columns` migrations are additive and auto-run at boot.
   **URGENT caveat: on the free tier every deploy/restart WIPES the SQLite DB** — all chef data gone,
   only the admin recreated. So right now a deploy = total data loss for any live chef. **Add
   `DATA_DIR=/var/data` + a paid persistent disk on Render before any real chef signs up.** (Also
   the true fix for #1's logouts.)
3. 🔲 **Keep the FAQs pages continuously up to date (standing instruction).** Two FAQ surfaces now: the
   detailed in-app help is the `FAQS` array in `frontend/src/pages/Support.jsx`, and the **public, pre-sign-up
   FAQ** is the `Faq` component in `frontend/src/pages/Legal.jsx` (route `/faq`, same format as Terms/Privacy) —
   plus a few Q&As on Landing/Home. Whenever a feature ships or changes, update BOTH to match — part of "done".
4. ✅ **Support feature — confirmed working (Ellice, 2026-06-16).** The Support page (`/app/support`)
   posts `/support/request` → creates a SupportTicket (Admin → Support) + emails `SUPPORT_EMAIL`
   (`command@thecreatistecatering.com` via Resend), and Ellice confirms this works. The **“Ask
   Mise” AI chat** is now **live too** (22nd wave — `ANTHROPIC_API_KEY` set); its 503 fallback to the
   support form only appears if the key is ever removed. So: support = live, Mise chat = live.
5. ✅ **Split Settings into individual pages — DONE (14th wave).** `/app/settings` is now a layout
   with a sub-nav (Profile · Security · Appearance · Membership · App & integrations); each section
   is its own route/page. Details in the fourteenth-wave notes below.
6. ✅ **Bookings pending/open-enquiries pipeline — DONE (14th wave).** New "Pipeline" view on
   Bookings: a 4-stage lead board (enquiry→quoted→confirmed→in_prep) showing the client's rough
   details on each card, with quick edit + one-tap advance. Details in the fourteenth-wave notes.

7. ✅ **Menu master page — DONE (16th wave).** New **Menus** section (Kitchen nav, all plans): set
   menus built from recipe items (each course can link a recipe sheet), **a PDF attached per menu**
   to share, plus menu type, price/head and live/archive. New `menus` table via `crud_router`. The
   menu's title feeds a **"Menu" dropdown on New Booking** (new `bookings.menu_type` column, shown on
   the booking detail). Sharing the PDF to **enquired** clients rides on #8 (WhatsApp/email contact).
   Details in the sixteenth-wave notes below.
8. ✅ **WhatsApp / email "Contact client" — DONE (17th wave).** A **Contact client** button on a
   booking (Client card) and on each client opens a modal: the chef's **template message** pre-filled
   (placeholders {client}/{business}/{event}/{date}) with **Open in WhatsApp** (`wa.me/<digits>`) and
   **Open in email** (`mailto:`), plus an **Attach a menu PDF** picker that drops the menu's public
   `/uploads/…pdf` link into the message — the way set menus get shared to enquired clients. The chef
   sets the **preferred channel + template** in **Settings → Business → Contacting clients**. Details
   in the seventeenth-wave notes below.
9. ✅ **Business profile page — DONE (15th wave). Internal** (Ellice's call: chefs keep their own
   public sites/booking, so no public page). New **Settings → Business**: logo (reuses `avatar_url`),
   description, **services list** (editable chips), business contact email, social links, and a
   **gallery** (multi-photo upload). The **services list now powers the New-Booking "Event type"
   dropdown** (free text still works). Owner-only. Stored as additive `users` columns. Menu-type
   dropdown follows with #7. Details in the fifteenth-wave notes below.
10. ✅ **Tastings icon — DONE.** Was `cup`→`spoon` (14th wave); Ellice then changed it to a **`fork`**
    glyph in `ui.jsx`. Every Tastings usage (sidebar, Home guide, Landing, Tastings empty state, intro
    film) points at `fork`; the old `cup` and `spoon` glyphs are removed. (Live on `main`.)
11. ✅ **Modal: stop discarding entries on accidental click-off — DONE (14th wave, follow-on).** The
    shared `Modal` (`ui.jsx`) no longer closes on a backdrop click — close only via the X or Escape.
    Fixes the data loss across every form modal in the app.

### Second batch (collected 2026-06-17, twenty-first wave)
12. ✅ **Shopping-page "Shop" dropdown steered from the Supplier page — DONE (21st wave).** The shop
    field on each shopping-list item is now driven authoritatively by the chef's **Suppliers** (the
    generic starter shops only show until they've added suppliers), with an inline hint linking to
    Suppliers. Ties into #16. `frontend/src/pages/Shopping.jsx`. (It already pulled supplier names —
    this makes suppliers the source of truth + wires the shop→supplier→route-address chain.)
13. ✅ **Founders tab stays after every seat is filled — DONE (21st wave).** Was already structurally
    true (the admin Founders tab is unconditional and the price/seats fields are always editable, even
    when the programme is "closed"/full). Added explicit copy in `FoundersPanel` (`pages/Admin.jsx`):
    "This tab stays here for good … adjust the lifetime rate below if you ever need to." So Ellice can
    always track members + amend pricing.
14. ✅ **Admin email notifications for account events — DONE (21st wave).** New `mailer.notify_admin()`
    → emails **`SUPPORT_EMAIL`** (the verified `command@thecreatistecatering.com`) on: a **chef
    sign-up** (`auth_router.register`), a **new subscription/activation** (`billing._activate`, fires
    once per checkout — idempotent), a **plan change** (`billing.change_plan`, says upgraded/
    downgraded), a **cancellation** (`billing.cancel`), plus webhook **payment-failed → suspended** and
    **Stripe-side cancel/period-end** (guarded against duplicates). Best-effort/no-op until email is
    configured. ⚠️ Ellice wrote the inbox as `command@creatistecatering.com` (missing "the") — routed
    to the real verified `command@thecreatistecatering.com` (= `SUPPORT_EMAIL`); change the env var if
    she truly wants a different address.
15. ✅ **Unsubscribe retention — offer a lesser plan — DONE (21st wave).** Clicking "Cancel
    subscription" (Settings → Membership) now opens a **retention modal** first: it offers the
    cheaper tier(s) with a **"Switch & stay"** button (reuses `/billing/change-plan`), plus "Cancel
    anyway" / "Never mind". Smallest-plan chefs see a gentle goodbye; founders see a lifetime-rate
    warning. Pure frontend (`pages/Settings.jsx`).
16. ✅ **Saved shopping lists → route stops dropdown — DONE (21st wave).** The route editor
    (`pages/RoutesPage.jsx`) has an **"Add stops from a shopping list…"** picker: choosing a list turns
    each distinct shop on it into a stop, with the **address auto-filled from the matching Supplier**
    (skips "Anywhere"/blanks and shops already on the route). Pairs with #12. Pure frontend.

**Sequencing:** first batch all done (4 confirmed; 3 standing). Second batch (12–16) all done in the 21st
wave. **1 & 2 (stay-logged-in / real-time) — ✅ DONE (22nd wave, 2026-06-19):** the persistent disk +
always-on Starter instance are live and verified, so the SQLite DB and `.secret_key` survive deploys.
**Mise AI chat is live too** (`ANTHROPIC_API_KEY` set, `AI_MODEL=claude-sonnet-4-6`). **The whole backlog is
now cleared** — only the standing FAQ rule (#3) remains ongoing.

### Third batch (collected 2026-06-25, twenty-third wave — on-the-go amendments from live use)
All built + verified this wave (branch `claude/optimistic-meitner-yqvl2l`) — **merge to `main` to deploy**.
17. ✅ **Tasks: priority dropdown in the quick-add bar, with a blank "No priority" option** — was only in
    the edit modal before; now in the composer (`Tasks.jsx`). Blank priority stores `""` and shows no badge.
18. ✅ **Tasks: due *time* in the quick-add bar** (`due_time` already existed on the model; just exposed it).
19. ✅ **Tasks: grouped by date chronologically (Overdue · Today · Tomorrow · each day · No date), and
    auto-ordered by time within each day** — untimed sink to the bottom; overdue stays red at the top.
20. ✅ **Shopping: active bookings pulled into the page header** — a "Shopping for · active bookings" strip
    (confirmed/in-prep, date≥today) with a one-tap "List" to start a shopping list for that event.
21. ✅ **Shopping: amend an item already on a list** — pencil → Edit-item modal (name/qty/unit/shop/cost/note).
22. ✅ **Shopping & Packing: bigger tick boxes on phone** — `h-7 w-7` on mobile, `h-5` desktop (verified 28px vs 20px).
23. ✅ **All checklist items: drag to reorder** — new touch-friendly `frontend/src/sortable.jsx` (`DragList` +
    `GripHandle`, Pointer Events so it works with finger or mouse), wired into Shopping + Packing item lists
    (reorders **within a shop/category group**; refills that group's positions in the master JSON array, other
    groups untouched). NOT added to Tasks — those auto-order by date/time per #17–19 (would conflict).
24. ✅ **Supplier price book: amend a logged price inline** (pencil → row becomes an edit form; saving stamps
    `last_checked`=today) **and it's listed A–Z** (backend already ordered by item_name; also sorted client-side).
25. ✅ **Tasks: phone notification before a task times out** — full **Web Push**, *inert until VAPID keys are set*
    (house pattern). See the wave notes below for the env vars + the iOS "add to Home Screen" caveat.

## Latest session (2026-06-25, twenty-third wave — on-the-go amendments: tasks ordering, shopping/checklist UX, drag-to-reorder, phone notifications)
- Branch `claude/optimistic-meitner-yqvl2l` — **merge to `main` to deploy.** Ellice's third feedback batch
  (backlog 17–25, above), from using the live app on her phone. `npm run build` clean (**84 modules**).
- **Backend: 1 new table + 1 additive column + 1 new dep.** New `push_subscriptions` table (`create_all`);
  additive `tasks.due_reminder_for` (`ensure_columns`); **`pywebpush>=2.0`** added to `requirements.txt`
  (pulls in `cryptography`/`py_vapid`). New files: `app/push.py`, `app/routers/push.py`, plus frontend
  `src/sortable.jsx` + `src/push.js`. `PushSubscription` added to the delete-chef `PURGE_MODELS` cascade;
  `/push` added to the offline `NO_QUEUE`.
- **Tasks (#17–19, `pages/Tasks.jsx`):** quick-add bar now has a **priority `<select>` (with a blank "No
  priority")** + a **time** input; tasks **group by date chronologically** (Overdue → Today → Tomorrow → each
  day → No date) and **auto-sort by time within each day** (untimed last). Priority badge only renders for
  low/medium/high. `format.js` gained `addDaysISO()` for the Tomorrow label.
- **Drag-to-reorder (#23, `src/sortable.jsx`):** `<DragList>` + `<GripHandle>` (the new `grip` ⠿ glyph in
  `ui.jsx`). **Pointer Events** (finger *and* mouse), `touch-action:none` on the handle, drag by the grip.
  Reorders within a shop (Shopping) / category (Packing) group; the master JSON array's group positions are
  refilled in the new order so other groups don't move; persists via the existing list PATCH.
  **GOTCHA fixed:** the "keep the dragged order until the save round-trips" clear-logic must key off an
  **id-signature**, not the `items` array identity — Packing rebuilds its groups array every render (not
  memoised like Shopping), so an identity-based effect reset the drag mid-gesture. Verified both lists drag
  + persist across reload.
- **Shopping (#20–22, `pages/Shopping.jsx`):** an **active-bookings strip** in the header (confirmed/in-prep,
  date≥today) with one-tap "List" (seeds `NewListModal` with the booking + a title); an **Edit-item modal**
  (pencil) to amend name/qty/unit/shop/cost/note; **bigger tick boxes on mobile** (`h-7 w-7 sm:h-5`).
  `NewListModal` gained an optional `defaultTitle` (back-compatible — BookingDetail still uses it unchanged).
- **Packing (#22–23):** same bigger tick boxes + drag-to-reorder within category groups.
- **Suppliers (#24, `pages/Suppliers.jsx`):** price-book rows get an inline **edit** form (pencil → save
  stamps `last_checked`=today); list is sorted **A–Z** (label says so) on top of the backend's order.
- **Phone notifications (#25 — the big one): Web Push, INERT until configured** (same pattern as Zoom/Stripe/
  email). `app/push.py` (`push_enabled()`, `notify_user()` with dead-subscription pruning, + a `--gen` CLI for
  the keypair); `routers/push.py` (`GET /push/config`, `POST /push/{subscribe,unsubscribe,test}`); the SW
  (`sw.template.js`) gained `push` + `notificationclick` handlers; `src/push.js` does subscribe/permission;
  **Settings → App & integrations → "Phone notifications"** card has the per-device toggle + "Send a test" +
  the not-configured / iOS-install hints. The **scheduler sweep** now also runs `run_task_reminders()`: pushes
  a heads-up for tasks due within `TASK_REMINDER_LEAD_HOURS` (24) and not done; idempotent + auto-re-arming via
  `tasks.due_reminder_for` (stores the deadline it reminded for, so rescheduling re-arms). Times read in
  `ONBOARDING_TZ` (Europe/London). **Granularity = the scheduler interval (6h default)** — fine for a day-ahead
  nudge; lower `SCHEDULER_INTERVAL_HOURS` for snappier.
  - **⚠️ ACTION for Ellice to turn it on (no code, like the other integrations):** run **`python -m app.push
    --gen`** once (locally or in Render → Shell — it prints the three vars), then set **`VAPID_PUBLIC_KEY`**,
    **`VAPID_PRIVATE_KEY`** and **`VAPID_SUBJECT`** (a `mailto:` — defaults to `SUPPORT_EMAIL`) on Render and
    redeploy. Until then the card shows "not configured" and nothing sends. **iOS rule (not a bug):** web push
    only reaches the app once it's **added to the Home Screen** (installed PWA) — the card spells this out.
  - **What couldn't be verified in-sandbox:** the actual end-to-end *delivery* of a push (needs a real device +
    a push service like FCM). Everything around it was tested (gating, subscribe/unsubscribe de-dupe, the
    reminder selection/idempotency/re-arm, the card states, the SW handlers compiled into `dist/sw.js`).
- **FAQ kept current (rule #3):** Support FAQ — extended the mobile FAQ (bigger tick boxes + drag), added
  "Can I get a reminder before a task is due?", "How are my tasks ordered… leave priority blank?", "Can I edit
  or reorder items on a shopping list?", and a price-book-edit note on the routes/suppliers FAQ. (Public
  pre-sign-up FAQ untouched — these are in-app operational flows.)
- **Verified:** backend FastAPI TestClient **18/18** (blank-priority + due_time persist; push config gating
  on/off; subscribe + de-dupe + 422; reminder fires-once / idempotent / re-arms-on-reschedule / no-op when
  unconfigured; supplier price PATCH). Playwright (system chromium, demo Elite chef) **17/17 desktop**
  (composer priority+time, Today/Tomorrow groups, blank vs high badge, time-order within a day, active-bookings
  strip, shopping item edit, shopping drag, supplier price book A–Z + inline edit, packing drag handles, the
  notifications card configured-state) **+ mobile** (tick box 28px vs 20px desktop) **+ drag 3/3** (shopping +
  packing reorder, persists across reload). Zero app-origin console errors (only the known Google-Fonts noise).
  Temp verify scripts live in the scratchpad — nothing left in the tree.

### Follow-on (same 23rd-wave session — flow/streamlining + booking↔list link, after Ellice clarified #20)
Ellice clarified that "active bookings in the shopping header" meant: **when you click New list, the
"List title" step should have a dropdown of your bookings so the list and the event merge.** Also asked for
**a smoother prep flow** (less bouncing between Shopping/Tasks/Route) and **steps to comp her aunt's account** for a trial.
- **Booking picker in `NewListModal` (`pages/Shopping.jsx`):** a "Link to a booking" `<Select>` (shown only on
  the standalone Shopping page — hidden when a booking is already fixed, e.g. from a booking's own Shopping tab).
  Picking a booking sets `booking_id`, fills the shop date from the event, and auto-fills the title
  (`"<event> — shopping"`, still editable). `NewListModal` gained a `bookings` prop; the page passes its list.
- **"Getting ready" launchpad on the booking Overview (`pages/BookingDetail.jsx` `PrepProgress`):** one card at
  the top of Overview showing Menu + Shopping/Tasks/Route/Packing with live progress (X/Y bought·done·packed) and
  a one-tap row that jumps straight to that tab — so prepping an event happens from one place instead of bouncing
  between top-level pages. (The booking detail was already a per-event hub with those tabs; this makes it the
  obvious cockpit.) Menu row smooth-scrolls to the `#menu-builder` anchor.
- **⚠️ GOTCHA (cost a couple of verify rounds): `npm run build` does NOT catch undefined components** (no ESLint
  in the repo) — I used `<Select>` in the new modal without importing it; the build was green but the Shopping
  page threw `ReferenceError: Select is not defined` **at render of the always-mounted modal** (JSX children are
  `createElement`'d even while `Modal` returns null when closed, so a closed modal still evaluates its `<Select>`).
  Fix: import it. **Lesson: a clean `npm run build` ≠ no runtime ReferenceErrors — always load the changed pages
  in Playwright and watch for `pageerror`.** Verified after fix: Playwright 9/9 functional (picker + auto-fill +
  linked list + launchpad rows + tab-jump), Shopping page renders clean (only the known Google-Fonts network noise).
- **Further flow ideas surfaced to Ellice (NOT yet built — her call which to do next):** same booking picker on
  the New Route + New Packing modals; a one-tap "Build a route from this booking's shopping lists" on the booking
  Route tab; a single "Start prep" action on a confirmed booking that spins up a shopping + packing list (and, for
  Elite, runs Mise's shopping-list + prep-plan from the menu) in one go.
- **No code for the comp trial** — it uses the existing **Admin → Chefs → "Complimentary account"** checkbox
  (sets active + Elite + onboarded, never billed, excluded from MRR). Steps were given to Ellice in chat.
- **No version bump** (standing rule — awaiting Ellice's word + her biblical reference).

## Previous session (2026-06-19, twenty-second wave — LAUNCH: live infra activated (persistent disk + always-on · Stripe live · Mise ON) + password show/hide toggle)
- **The platform is now genuinely launch-ready** — Ellice activated the paid stack (the long-standing
  blocker), walked through live in-chat. Infra needed **no code**; the only code change this session is the
  password toggle (below). **Backlog #1 & #2 — the only items left open — are now DONE.**
- **Persistent disk + always-on (THE #1 operational risk, now CLEARED):** Render service upgraded
  **Free → Starter** (always-on — no more sleep / cold-starts) + a **1 GB disk mounted at `/var/data`** +
  env `DATA_DIR=/var/data`. **Verified live via Render → Shell:** `ls -la /var/data` → `creatiste.db` +
  `.secret_key` + `uploads/`; `df -h /var/data` → `/dev/nvme25n1` as its own mount. So **the SQLite DB now
  survives every deploy** (#2 done) and **`.secret_key` persists → no more surprise logouts on deploy**
  (#1 done). ⚠️ Note: there is **no `SECRET_KEY` env var** — the app uses the auto-generated
  `DATA_DIR/.secret_key`, now stable because the disk persists. (Optional future hardening: set an explicit
  `SECRET_KEY` so tokens don't depend on the disk file.) Starter (~$7/mo + ~$0.25 disk) also ends the
  free-tier wipe/sleep for good.
- **Stripe LIVE:** account in live mode; `STRIPE_SECRET_KEY` (sk_live) + `STRIPE_WEBHOOK_SECRET` (whsec)
  set; webhook at `…/api/billing/webhook` (5 events); **Customer portal configured** (update-card / cancel
  / invoice-history ON; "switch plans" left **OFF** — the app does plan changes itself; portal legal links
  → `/terms` `/privacy`). Told Ellice to **ignore** Stripe's "Set up Connect" / "recurring payments" /
  integration wizards — the app already does Checkout via the API (Connect is the future *deposits* feature,
  not now).
- **Mise AI switched ON (was deferred "until first paying chef"):** `ANTHROPIC_API_KEY` set +
  **`AI_MODEL=claude-sonnet-4-6`** (the cost pick — Sonnet $3/$15 vs Opus 4.8 $5/$25; **the old "~5×
  cheaper" note predates Opus 4.8 pricing — it's now ~40% cheaper**, still the right call for Mise's
  structured-JSON jobs). Live for **Elite** chefs + admin "Summarise with AI" + support chat. Verify:
  public `GET /api/ai/status` → `{enabled:true, model:"claude-sonnet-4-6"}`, then a real **"Draft with
  Mise"** as an Elite/founder (status only proves a key is *present*, not *valid* — the Mise action is the
  real test; a wrong key → 503 "AI key rejected"). **Clarified for Ellice:** `AI_MODEL` is ONE
  platform-wide setting, invisible to users — NOT a per-user model switch (her confusion was with the
  per-chef *plan* switch, which IS user-facing).
- **Email** already live (Resend) — `RESEND_API_KEY` / `SMTP_FROM` / `SUPPORT_EMAIL` confirmed present.
- **External trial-reminder cron deleted:** the cron-job.org job kept failing with **timeout (30s) =
  free-tier cold start**. With the instance now always-on, the **in-process scheduler** (`ENABLE_SCHEDULER=1`,
  default) covers reminders, so the external cron is redundant and was removed. (`CRON_SECRET` can stay or go.)
- **Security — rotate-on-exposure:** during setup Ellice revealed env *values* in a screenshot; she
  **rotated the Stripe live secret key** (the high-risk one). Advised: change the **admin password** if it's
  reused on her personal email; Resend / webhook / cron rotations flagged lower-priority/optional. (Same
  pattern as the 11th-wave on-screen-exposure rotations.) Tip given: to confirm a Render var is set you don't
  need to *reveal* it — the key names alone suffice.
- **Feature shipped (only code change) — show/hide password eye toggle.** Branch
  `claude/festive-tesla-8xs0jo` → **merged to `main`** (fast-forward; live on next build). New reusable
  **`PasswordInput`** in `ui.jsx` (drop-in for `<Input type="password">` + an eye button; `tabIndex={-1}` so
  it doesn't disrupt form tab-flow; defaults hidden) and **`eye`/`eyeOff`** glyphs added to the `PATHS` icon
  set (canonical Feather paths). Wired into **login + register** (`AuthPage`, shared form), **change-password**
  (`Settings → Security`, both fields) and **reset-password** (`ResetPassword`, New + Confirm). `npm run build`
  clean (**78 modules**); rendered eye/eyeOff to PNG to confirm they look right.
- **Brand assets generated for Ellice (delivered as files — NOT committed):** high-res logo PNGs (full
  lockup on near-black + transparent; a **white-background variant** — the white "command" + flame highlight
  recoloured to near-black `#0C0A08`, gold kept) and **flame-only icons** (1024² transparent — white-accent
  for dark bg, dark-accent for white bg). **Brand colours confirmed: gold `#BFA987` (the "copper"/accent
  token — the core brand colour), ivory `#FFFBF5`, near-black `#0C0A08`.** Wordmark = **Playfair Display**
  (web stand-in for "The Seasons"). **Render recipe (fresh container has no chromium/venv):** `pip install
  Pillow cairosvg`; Playfair Display variable fonts pulled from google/fonts GitHub raw
  (`PlayfairDisplay[wght].ttf` + `-Italic`); flame = the two `Flame`/`make_icons` SVG paths flattened to
  polygons + filled; supersample 4× → LANCZOS downscale. (Reusable if regenerating brand assets.)
- **No version bump** (standing rule — awaiting Ellice's word + her biblical reference).

### Follow-on builds (same 22nd-wave session, branch `claude/festive-tesla-8xs0jo`)
After the infra/password work above, three more asks landed and were built on the same branch:
- **Show/hide password eye toggle** — `PasswordInput` in `ui.jsx` (+`eye`/`eyeOff` glyphs); wired into
  login/register (`AuthPage`), change-password (`Settings → Security`) and reset-password (`ResetPassword`).
  **Merged to `main`.** (Also audited all 13 Mise touchpoints — all already present Mise as live/dynamic; only
  stale note was backlog #4, fixed.)
- **Onboarding call auto-record → transcribe → AI-summarise (Zoom):** when `ZOOM_*` creds +
  `ZOOM_WEBHOOK_SECRET_TOKEN` are set, onboarding/check-in calls cloud-record; new signature-verified
  `POST /api/zoom/webhook` (`routers/zoom.py`) pulls the Zoom audio transcript onto the matching
  `OnboardingSession`, saves the recording link, and auto-runs the existing AI key-points summary (extracted
  to `admin.run_onboarding_summary()`). Additive `onboarding_sessions.meeting_id` / `recording_url`;
  `create_meeting` sets `auto_recording=cloud` + returns the meeting id; booking confirmation email gains a
  recording-consent line; admin session modal gets a "Recording" link. **INERT until Zoom is configured**
  (webhook 403s, calls don't record) — behaviour unchanged until Ellice does the Zoom side (Pro plan + cloud
  recording + audio transcript + a Server-to-Server OAuth app + a webhook subscription → set
  `ZOOM_ACCOUNT_ID/CLIENT_ID/CLIENT_SECRET/ZOOM_WEBHOOK_SECRET_TOKEN`). Verified: webhook 7/7.
- **Weekly off-site backup (email) — LIVE:** `app/backup.py` — the in-process scheduler emails a full SQLite
  snapshot to `BACKUP_EMAIL` (defaults to `SUPPORT_EMAIL`) every `BACKUP_INTERVAL_DAYS` (7), via Resend with an
  attachment (new `mailer.send_email_sync` + attachment support on the Resend/SMTP paths). `make_snapshot()`
  shared with the admin Download-backup endpoint; due-state in `DATA_DIR/.last_backup` (a restart won't
  re-backup); no-op until email is configured (never "spends" a week silently). First run fires on the next
  startup (no stamp yet → immediate), then weekly. The snapshot is the WHOLE platform DB (every chef account +
  everything chefs & their clients entered) — keep the inbox secure. New env (safe defaults):
  `BACKUP_INTERVAL_DAYS` (7), `BACKUP_EMAIL`, `ENABLE_BACKUP` (1). Verified: backup 8/8.
  **⚠️ PLANNED UPGRADE (Ellice's explicit note): move the destination from EMAIL → encrypted CLOUD STORAGE
  (Backblaze B2 / S3) — emailing a full DB is the start, not the end.** Also flagged: Render likely already
  takes automatic daily disk snapshots (verify in the Disks tab) — that covers disk failure; this weekly email
  is the independent off-Render copy.
- **Full platform review + "first next steps" delivered in-chat:** (1) run one real end-to-end Stripe
  subscription on her own card; (2) solicitor review of Terms/Privacy + registered business details; (3) turn
  on Render disk snapshots / off-site backup (now part-built); (4) invite the first founder for a real run;
  (5) custom domain + the call-recording path. Medium: error monitoring (Sentry), email deliverability/DMARC.

### Amendments batch (same 22nd-wave session, branch `claude/festive-tesla-8xs0jo`) — data-safety + allergen doc
Ellice's amendments after the review, all built + verified on the same branch (still **merge to `main` to deploy**):
- **Apple Calendar option (already on `main` at `94375ba`):** the Calendar-subscription card (Settings → App &
  integrations) now spells out Apple / Google / Outlook subscribe-by-URL paths (was a generic webcal link).
- **Admin backup & RESTORE button — DONE + drilled:** the admin "Database backup" card (Admin → Overview) gained a
  **Restore from a backup** card. Upload a `.db` → it's validated (SQLite header + integrity + has a `users` table)
  and **staged** next to the live DB; the swap happens on the **next restart** (`backup.apply_pending_restore()`,
  called first thing in `main.bootstrap()` before the DB is opened), keeping the current DB as a timestamped
  `.prerestore-*` copy so it can be undone. New `POST /api/admin/restore` (admin-only, size-capped). Frontend
  `api.postFile()`. Stale free-tier-wipe copy on the download card was refreshed (disk is live now). **Drill passed
  end-to-end via the real HTTP API:** backup → change a setting → upload → restart → data reverted to the snapshot,
  `.prerestore` kept; junk file → clean 400. To actually apply a restore on Render: **Render → Manual Deploy →
  Restart** (or any deploy) — the staged file swaps in on boot.
- **Self-service recycle bin — DONE (backlog-style ask):** chefs can recover their own accidental deletes.
  **Snapshot approach** (not soft-delete columns): the single `crud_router` delete chokepoint now writes a full
  JSON snapshot of the row into a new **`deleted_items`** table before deleting, so existing list/get queries are
  untouched (no risk of a "deleted" row leaking back into views, no per-model schema churn). New `app/recycle.py`:
  a registry of the 14 recoverable crud models, `snapshot_deletion` / `restore_item` / `purge_expired`, and
  `GET /recycle` + `POST /recycle/{id}/restore` + `DELETE /recycle/{id}` + `DELETE /recycle` (empty). **Restore keeps
  the original id when it's still free** (so references survive) and falls back to a fresh id on collision (pre-check
  + `IntegrityError` guard — NB the savepoint/`begin_nested` approach was buggy and was replaced with a clean
  pre-check). Retention **30 days** (`RECYCLE_RETENTION_DAYS`, Ellice's choice), auto-purged by the scheduler sweep +
  opportunistically on read. `DeletedItem` added to the delete-chef `PURGE_MODELS` cascade. `/recycle` added to the
  offline `NO_QUEUE` (recovery needs a connection). Frontend: a new **Settings → Recently deleted** sub-page (nav
  pill, `trash` icon) with a **"How recovery works" instructions card** (Ellice's explicit ask — so chefs understand
  it and don't aim frustration at her), Restore (`replay` icon) + Delete-forever + Empty-bin, days-left countdown.
- **Allergen matrix → FSA-compliant printable table card + export-hub link:** the Allergens page already had a
  14-allergen grid + CSV; now **Print / PDF** yields a proper A4 document for the dining table — a **UK FSA guidance
  template** (the mandatory "speak to a member of staff" allergy statement + a Food Information Regulations 2014 /
  Natasha's Law line + key/legend + cross-contamination disclaimer) and a print-only header (business name, menu
  source, date). New **`@media print`** block in `index.css` + **`print:hidden`** on the app chrome in `App.jsx`
  (sidebar/headers/nav/footer/offline chip/trial banner) so only the document prints (brand ticks kept via
  `print-color-adjust`, header repeats per page, rows don't split). Surfaced from **Settings → App & integrations →
  Export your data** (links to the Allergens page — the matrix is built client-side from recipe sheets).
- **Verified:** backend restore drill (HTTP) + recycle bin (HTTP e2e: create→delete→bin→restore→original-id kept;
  delete-forever; menu/client modules) + unit (purge expired vs fresh; id-collision fallback leaves the occupying row
  intact; free-id preserved). Playwright (system chromium, demo chef): recycle page 9/9 (instructions, item listed,
  Restore clears it, empty-state); allergen doc — FSA statement + Natasha/FIR + all 14 columns + ticks + print-media
  hides the sidebar & shows the doc header + export-hub row. `npm run build` clean (**78 modules**). Only console
  noise = the known Google-Fonts cert failures. Temp verify scripts removed.
- **FAQ kept current (rule #3):** Support FAQ — reworded the allergen entry (Print/PDF + FSA statement) and added
  "I deleted something by accident — can I get it back?" (Settings → Recently deleted, 30-day restore). Public
  pre-sign-up FAQ — added "What if I delete something by mistake?" under the data-safety section.
- **⚠️ STILL PLANNED (Ellice's note, not yet built):** move the **weekly backup destination from EMAIL → encrypted
  cloud storage (Backblaze B2 / S3)**. And the **Zoom call-recording path stays dormant** until Ellice does the Zoom
  side (Pro plan + cloud recording + audio transcript + Server-to-Server OAuth + webhook → set the `ZOOM_*` envs).

### Live-use fixes & menu/quote/numbering batch (still 22nd-wave session, branch `claude/festive-tesla-8xs0jo`, all merged to `main`)
Ellice testing the live app on her iPhone sent a run of pointers; each built, verified (Playwright + API), merged to `main`:
- **Mobile safe-area fix (iPhone 17 Pro Max):** the app is `viewport-fit=cover` + `black-translucent`, but only the
  bottom nav honoured insets — so the top bar and bottom-sheet modals (with their dropdowns) sat under the Dynamic
  Island / home indicator and were unreachable. Added `env(safe-area-inset-top)` to the mobile header and
  `safe-area-inset-bottom` padding to the `Modal` body+footer and the "More" sheet. Pure additive padding (0 on
  desktop/non-notched — no distortion). Verified via CDP `setSafeAreaInsetsOverride`.
- **Allergen PDF → A4 landscape (standardised):** the allergen matrix is the only print surface, so the print CSS now
  forces `@page { size: A4 landscape }` (the 14-allergen table needs the width). Verified the rendered PDF is 297×210mm.
- **Menu builder reworked (shared `frontend/src/dishrows.jsx` — used by booking menu AND saved Menus):** pull dishes in
  from a saved menu (picker on the booking Menu card), **Enter adds the next line**, header **"Course/component"**, and a
  **manual "Serves" (free text, e.g. "10-12") + "Price"** per line — **NO calculation** (Ellice's explicit steer: a tray
  menu reads "Jollof Rice | serves 10-12 | £38"; serves is descriptive). Booking **Menu total = simple sum of line
  prices** (`menuPriceTotal`). **"Build a quote from this menu"** (Elite owners) → each line becomes a quote item at
  **qty 1 @ its price** in the exported `QuoteEditor` (set quantities + send). Serves/price live in the existing
  `menu`/`courses` JSON — no backend change. (NB an earlier serves-aware ceil(guests/serves) tally was built then
  removed per her "no calculation".)
- **Six-pointer batch (this session's last set):**
  1. **Custom invoice/quote number prefixes** — new `users.invoice_prefix` ("INV") / `quote_prefix` ("Q") (additive),
     set in **Settings → Business → "Invoice & quote numbering"**; shared `utils.next_doc_number()` builds
     `PREFIX-YYYY-NNN`; quote + finance + quote→invoice generators all read the **owner's** prefix.
     **Upgraded to full FORMAT TEMPLATES (follow-on, Ellice's ask):** new `users.invoice_format` / `quote_format`
     (additive). `utils.render_doc_number(fmt, seq, today)` renders tokens `{n}/{nn}/{nnn}` (zero-padded sequence) +
     `{DD} {MM} {YY} {YYYY}`; `effective_doc_format(owner, kind)` falls back to the prefix style when no format set.
     So Ellice's "number then date" → format `{nn}{DD}{MM}{YY}` → **23200626** (23rd invoice, 20 Jun 26). Settings
     card now has a token legend, **live preview of the real next number** (endpoints return `seq`), and one-tap
     preset chips (incl. `23200626`). Frontend mirror `format.renderDocNumber()`.
  2/3. **Booking detail tabs reordered:** Overview, **Money**, Shopping, Orders, Tasks, Route, Packing, Designs (Money
     moved up right after the Menu/Overview, per her order).
  4. **Upload-an-invoice** (she invoices in another app): new `invoices.file_url` / `file_name` (additive); a **Money-tab
     "Upload"** button → `UploadInvoiceModal` (PDF via `api.upload` + number/amount/date/status) creates an Invoice with a
     single line item; rows show a **PDF** chip + open link.
  5. **Nav modules reordered chronologically** (`App.jsx NAV_GROUPS`): Operations = Home·Dashboard·Bookings·**Clients**·
     Tastings·Tasks·Routes·Team; Kitchen = Menus·Recipes·Allergens·Inventory·Shopping·Orders·Suppliers·Packing; Business =
     Finance·Designs·My Brain. Bottom nav is now **path-based** (`QUICK_PATHS`) so reorders can't break it.
  6. **Complimentary accounts (mock onboarding / friends & family):** new `users.is_comp` (additive). Admin → Chefs modal
     has a **"Complimentary account"** checkbox → sets the chef **active + Elite + onboarded, never billed**, and **excluded
     from MRR** (`overview.comp_count`). They register/onboard exactly like any user; Ellice just ticks the box.
- **Quote/invoice streamline batch (her live "wall" — quoting for her own clients):** (a) **reusable service charges** —
  new `users.service_charges` JSON (`[{id,label,rate,per}]`) managed in **Settings → Business → "Service charges"**
  (delivery per mile, service fee, etc.); a shared **`ChargesMenu`** (`frontend/src/charges.jsx`, with built-in presets)
  sits beside "Add line" in **both** the `QuoteEditor` (Quotes.jsx) and `InvoiceEditorModal` (Finance.jsx) → one tap adds
  the line (per-unit charges start qty 1, set miles/hours on the line). (b) **One-step quote→invoice** — `QuoteEditor`
  gains **"Save & create invoice"** (saves the quote incl. its charge lines, then `POST /quotes/{id}/to-invoice` → draft
  invoice with the chef's number format). (c) **Invoice-app deep link** — new `users.invoice_app_url`; Settings → Business
  field + a **"My app"** shortcut on the booking Money tab. **Embedding an external invoice app in an iframe is NOT
  possible** (they send X-Frame-Options/CSP) — so it's a new-tab link + the existing upload-PDF-back-as-preview loop. All
  additive columns; `PUT /auth/me` whitelists `service_charges`/`invoice_app_url`. Verified: charges persist; quote
  (£38 + 12mi×£0.45 + £50 = £93.40) → invoice carries all 3 lines; Settings card + quote charges menu + My-app shortcut
  (caught + fixed a missing `IconButton` import in Settings.jsx).
- **Native invoice document — DONE (so Ellice can drop her external invoice app, App Store id1590349103):** new
  `invoices.public_token` (additive) + `POST /invoices/{id}/share?send=` (mints the link, optionally emails the client +
  marks sent) + public `GET /public/invoice/{token}`. New **`pages/PublicInvoice.jsx`** at route **`/i/:token`** — a clean
  **white, portrait, print-perfect** invoice (business logo/name/contact header, Bill-to, line-item table, subtotal/
  discount/tax/Total in brand gold, notes, Download/Print button). `InvoiceEditorModal` (Finance.jsx) gained **"Preview /
  print"** (saves → opens the doc) and **"Send to client"** (saves → shares → emails/copies link). **Print-orientation
  fix:** named `@page`/`page:` aren't honoured by the print-to-PDF engine, so the default `@page` is now **portrait** and
  the **Allergens page renders an inline `<style>@media print{@page{size:A4 landscape}}`** only while mounted (overrides to
  landscape). Verified: invoice PDF 595×842 portrait, allergen PDF 842×595 landscape; public doc renders number/bill-to/
  lines/total £131.40 as a white doc; editor Preview+Send present. **Audience copy broadened** (Support + public FAQ): it's
  for **all food & beverage providers** (bakers, cocktail/drinks, grazing/dessert, supper clubs, food trucks, pop-ups) —
  **not** a full-service restaurant system.
- **Invoice line auto-fill + branding colour (follow-on):** shared **`MenuItemsMenu`** (`frontend/src/menulines.jsx`,
  `fetchMenuItems(bookingId)` flattens the booking's menu + all saved menus' **priced** courses) sits beside Add-line in
  **both** the quote + invoice editors → one tap auto-fills a line with the dish + its price. **Invoice branding colour:**
  new `users.invoice_accent` (additive, default brand gold `#BFA987`), set in **Settings → Business → "Invoice branding"**
  (colour picker + presets + live mini-invoice preview, next to the logo — saves with the business profile); the public invoice endpoint returns `business.accent` and
  `PublicInvoice.jsx` uses it for the INVOICE heading / total / table rule. Verified: accent persists + greens the public
  doc; menu-item dropdown auto-fills "Rice — Jollof Rice" @ £38.
- **⚠️ ROADMAP (Ellice's note, NOT built):** a **"Pop-up" feature** — a chef/caterer takes **pre-orders** for a set
  **location + day/time**; customers order ahead; ideally a **payments/POS integration** for the pop-up day. She named
  **SumUp** (has APIs + hosted checkout + an Orders/online-store product, so a menu+pre-order+payment flow is feasible —
  likely a public per-popup order page like the enquiry/quote public pages, + SumUp for card payment, or Stripe which is
  already wired). Sizeable feature — capture when she's ready to build it.
- **FAQ kept current (rule #3):** added "Can I set my own invoice and quote numbers?" (+ upload-invoice tip) and extended
  the quote-approval FAQ for "Build a quote from this menu".
- **Verified:** backend API (number prefixes → `CC-`/`QT-`; uploaded invoice file persists; comp pending→active/elite/
  onboarded + MRR excluded + workspace access) and Playwright (nav order, booking tab order, upload modal fields, numbering
  card, comp checkbox). `npm run build` clean (**79 modules** — `dishrows.jsx` added).

## Previous session (2026-06-17, twenty-first wave — shop/route wiring, founders-tab persistence, admin email alerts, unsubscribe retention)
- Branch `claude/clever-goodall-te9p07` — **merge to `main` to deploy.** Ellice's second feedback batch
  (backlog 12–16, above). **Backend: NO new columns/tables/env/deps** — just a new `mailer.notify_admin()`
  helper + best-effort notify calls. Frontend-heavy. `npm run build` clean (**78 modules**).
- **#14 Admin email alerts (only real backend change):** `mailer.notify_admin(subject, body)` →
  `SUPPORT_EMAIL`, prefixed `[Creatiste Command]`. Wired at: **sign-up** (`auth_router.register`),
  **first activation/subscribe** (`billing._activate`, placed after the idempotency early-return so a
  webhook+confirm double-fire sends ONE email), **plan change** (`billing.change_plan`, captures
  `old_plan` and labels upgraded/downgraded), **cancel** (`billing.cancel` → `_notify_cancel`, both the
  Stripe cancel-at-period-end and demo paths), and in the **webhook** for `invoice.payment_failed`
  (→ suspended) + `customer.subscription.deleted` (catches Stripe-portal cancels), each **guarded on a
  status transition** so they don't repeat. All no-op until email is configured (Resend/SMTP).
  ⚠️ **Inbox typo:** Ellice asked for `command@creatistecatering.com` (missing "the"); routed to the
  verified `command@thecreatistecatering.com` (= `SUPPORT_EMAIL`). Change the env var if she wants else.
- **#15 Unsubscribe retention (frontend, `pages/Settings.jsx`):** "Cancel subscription" now opens a
  **"Before you go…"** modal that offers the cheaper tier(s) via **"Switch & stay"** (reuses
  `/billing/change-plan` → which also fires the #14 "changed plan" alert, so a save is NOT a "cancel"),
  with "Cancel anyway" / "Never mind". Founders get a lifetime-rate warning (no downgrade — backend
  blocks founder plan-switch); smallest-plan chefs get a gentle goodbye. Replaced the old
  `window.confirm`. New imports: `Modal`. NB the bare `amber` colour token doesn't exist here — the
  warning box uses the default Tailwind `amber-*` palette like the `Badge` amber tone.
- **#16 Shopping list → route stops (frontend, `pages/RoutesPage.jsx`):** the route editor fetches
  `/shopping` too and shows **"Add stops from a shopping list…"** (`Select`); picking one turns each
  distinct shop into a stop, **address auto-filled from the matching Supplier by name**, purpose tagged
  `Shop · <list title>`, skipping "Anywhere"/blank shops and shops already on the route. Reuses
  `/routes` PATCH — no new endpoint.
- **#12 Shop dropdown steered from suppliers (frontend, `pages/Shopping.jsx`):** the item "Shop"
  datalist is now **suppliers-only when the chef has any** (generic starters only until then) + a hint
  linking to Suppliers ("…and feeds your route stops"). This makes #16's name→address match line up.
  Module-level `GENERIC_SHOPS` for the no-suppliers fallback.
- **#13 Founders tab persistence (frontend, `pages/Admin.jsx`):** added a reassurance note in
  `FoundersPanel` — the tab + member list + lifetime-rate editing stay available even once every seat
  is filled or the programme is closed. (No logic change; it was already unconditional.)
- **FAQ kept current (rule #3):** Support FAQ — extended "How do I cancel or change my plan?" with the
  retention/offer-a-smaller-plan step, and added "Can I build a route from a shopping list?" (covers
  #12 + #16). Public pre-sign-up FAQ untouched (these are in-app operational flows).
- **⚠️ Version stamp — DO NOT bump until Ellice says (standing rule, set 2026-06-17).** Version updates
  begin **only once the platform is officially launched**. Ellice will **confirm when she wants the next
  version cut**, and will provide **a new biblical reference** at that point; that release will roll up
  **all amendments shipped since the last version**. Until she gives the word, **do not append a
  `VERSIONS` entry** in `frontend/src/version.jsx` and **never fabricate the scripture**. (When she does:
  append `{ n, ref: '<her reference>', text: '<private verse, not rendered>', updates: [ … ] }` covering
  everything since the previous entry — e.g. for this wave: 'Shopping "Shop" list now driven by your
  Suppliers — and turns into route stops in one tap.', 'Plan a prep-day route straight from a saved
  shopping list, addresses filled in automatically.', 'Thinking of leaving? We now offer a smaller plan
  before you cancel.')
- **Verified:** backend FastAPI TestClient **7/7** (signup/subscribe/plan-up/plan-down notify; subscribe
  idempotent = no dup; same-plan = no notify; cancel notify). Playwright (system chromium, desktop 1280)
  **19/19 + 4/4**: F1 datalist = suppliers only (no generic) + hint; F5 list→stops with supplier address,
  "Anywhere"/already-present skipped, purpose tagged; F4 retention modal + "Switch & stay" + decline
  keeps the sub + **the positive path actually downgrades Elite→Pro and stays subscribed** (then restored
  to Elite); F2 founders persistence copy + editable rate. **Zero app-origin console errors** (only the
  known Google-Fonts noise). Temp verify scripts removed.

## Previous session (2026-06-17, twentieth wave — marketing polish: founders logo wall + testimonials, SEO pack)
- Branch `claude/cool-shannon-yyt4kh` — **merge to `main` to deploy.** Ellice's pick while the persistent disk /
  payments wait: "marketing polish." Builds the **promised founders perk** (logo on site + link as advertising) +
  testimonials, plus an SEO pack. **Backend: 2 additive `users` columns** (`feature_publicly`, `testimonial`) via
  `ensure_columns`; one new public endpoint. No new env/deps. `npm run build` clean (78 modules).
- **Two distinct sections on the landing** (`pages/Landing.jsx`, between Features and How-it-works), both **consent-based**
  and **hidden until there's content** (per Ellice's steer — a scrolling logo bar, then a *separate* testimonial wall):
  (1) a **continuous scrolling logo bar** — `#trusted`, a CSS marquee (`.cc-marquee` in `index.css`; each chip links out
  to the client's site as advertising; pauses on hover, reduced-motion-safe; the duplicate copy that makes it loop is
  `aria-hidden` + untabbable; short lists are padded so the strip still fills), and (2) a **separate testimonial wall** —
  `#loved`, quote cards with a "Founding member" line for founders. Both fed by **`GET /api/public/featured`**
  (`routers/public.py`) — only opted-in chefs' public bits (name, logo, normalised https link, optional testimonial,
  is_founder); leaks nothing private. `_public_link()` turns `@handle`/bare domains into safe absolute URLs (or "").
- **Opt-in lives in Settings → Business** (`SettingsBusiness`): a **"Feature on the Creatiste Command site"** card —
  a `Toggle` (`feature_publicly`) + a testimonial textarea, saved with the business profile (`PUT /auth/me` now
  whitelists `testimonial` + the bool `feature_publicly`). The outbound link reuses the website/first social already on
  the page; turning the toggle on with no logo and/or no link shows an inline nudge to add them. **DECISION (flag for Ellice): the opt-in is open to ALL owners**, not founders-only — broader social proof,
  everyone happy can advertise; founders are still distinguished by the badge. Easy to gate to `is_founder` if she wants
  it exclusive.
- **SEO pack:** `frontend/public/robots.txt` (allow site, disallow `/app` `/api` + token pages, points at the sitemap)
  + `frontend/public/sitemap.xml` (home/register/login/terms/privacy) — both served at root by the SPA catch-all (Vite
  copies `public/` → `dist/`). `index.html` gains a **canonical** link + **JSON-LD** (`Organization` +
  `SoftwareApplication` with an `AggregateOffer`; `lowPrice "39"` mirrors the entry tier — update if it changes). All
  absolute URLs use `creatistecommand.onrender.com` — **update on a custom domain** (same as the OG tags).
- **FAQ kept current (rule #3):** new Support FAQ "Can my business be featured on your site?" → Settings → Business.
- **Follow-on — public pre-sign-up FAQ page (same branch, after Ellice's steer):** the landing footer's "Support &
  FAQs" link pointed at the **logged-in** `/app/support` (useless to a visitor). Added a **public `/faq`** page — `Faq`
  in `pages/Legal.jsx`, reusing `LegalLayout` (same look as Terms/Privacy; `updated` made optional so it has no
  "last updated" line), short pre-sign-up Q&As ending in a "Start your free trial" CTA + support email. Landing footer
  now links to `/faq` (label "FAQs"); the shared Legal/FAQ footer cross-links FAQs · Terms · Privacy · Home; `/faq`
  added to `sitemap.xml`. Detailed help still lives behind login on `/app/support`.
- **Follow-on — listings now go through OWNER APPROVAL (Ellice's steer), no auto-publish:** being featured is no longer
  an instant toggle. A chef sets logo/link/testimonial in Settings → Business and hits **"Submit for review"** →
  `feature_status` goes **pending** (new additive `users` column: none|pending|approved|rejected); it only shows publicly
  once the owner **approves** it in the new **Admin → Showcase** tab (approve can fix spelling first; reject/unpublish
  keeps it off). `GET /public/featured` now also requires `feature_status == 'approved'`. New endpoints:
  `POST /auth/feature-request` + `POST /auth/feature-withdraw` (chef), `GET /admin/feature-requests` +
  `…/{id}/approve|reject` (owner, reuses `public._public_link`). Changing the logo on an *approved* listing auto-sends it
  back to pending (re-review). `PUT /auth/me` no longer touches the feature fields. Also: replaced the fabricated 5-star
  row with a **chef-chosen rating** — a `Stars` input in Settings → Business (new additive `users.testimonial_rating`
  0–5, sent with the feature request, optional/clearable), shown on the public wall + the Admin review card only when set;
  and the wall heading is now **"Loved by Chefs whose kitchens run on it."** Support FAQ updated to describe the review step.
- **Verified:** API (urllib, live server + seed) **14/14** — featured empty→opt-in→1 business→opt-out→empty; website
  normalised to `https://…`; testimonial exposed; **no private fields leaked**; robots/sitemap 200 + content; index.html
  carries JSON-LD + canonical. Playwright (system chromium, desktop) **13/13** — landing `#loved` renders the business +
  testimonial + outbound `target=_blank` link + JSON-LD in DOM; Settings card shows the toggle (ON) + saved testimonial;
  **zero app-origin console errors** (only the known Google-Fonts noise). Temp checks were heredocs — nothing left behind.
- **Still the only real blocker: the persistent disk** (`DATA_DIR=/var/data` + paid Render disk) before real chefs —
  unchanged by this wave.

## Previous session (2026-06-16, nineteenth wave — version stamp + release notes, "Pass"→"event" copy)
- Branch `claude/exciting-bardeen-vcmynn` — **merge to `main` to deploy.** Two of Ellice's asks: (a) a **version
  number** at the base of the platform + a Settings section for it, and (b) reword every written **"Pass"** (the kitchen
  pass) to **"event"**. **Frontend only — no backend, no env, no new deps.** `npm run build` clean (**78 modules**).
- **⚠️ Read this — the brief was REVISED mid-session (final state below):** Ellice first asked for the version to be a
  Christian dedication marked with a **✝ cross**, the scripture explained on the Settings page. She then refined it:
  **the dedication is PERSONAL and must NOT be explained to users anywhere in the UI.** Final design:
  - **The version = a number + a biblical reference, rendered as a lowercase italic dotted/technical string
    `v1.matthew.25:23`** (Ellice's preferred styling — `versionRef` = ``v${n}.`` + `ref.toLowerCase().replace(/\s+/g,'.')``).
    The reference is just the version's name; its meaning is hers and is never spelled out to users. **Each future
    release gets a new biblical reference + the next v-number** (v2, v3 …), in chronological order.
  - **The marker is a plain "circle-with-a-v" glyph** (NOT a cross): `circleV` in `ui.jsx` PATHS
    (`M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 9.5l3.5 5 3.5-5`, copper). The old `cross` glyph was removed.
  - **Settings → Version is iOS-style RELEASE NOTES** — short "what's new" bullets per release + a "Release history"
    list — **no scripture text, no dedication, no "Jesus", nothing personal** rendered. (Verified absent in tests.)
- **Single source of truth: `frontend/src/version.jsx`** — `VERSIONS` (ordered `{n, ref, text, updates[]}`; `text` is
  Ellice's PRIVATE record of the verse and is **deliberately NOT rendered**), `CURRENT` (= last/highest entry, live),
  `versionLabel` (→ `v1`), `versionRef` (→ `v1.matthew.25:23`, lowercase/italic at the call sites), `<VersionStamp>`
  (footer line: circle-v + the ref; links to Settings → Version in-app, plain span on public pages; tooltip = the ref
  only, no verse), `<VersionNotes>` (one release's what's-new block). **To ship a new version: append one entry with the
  next number, a new reference, and its `updates` bullets — the whole app updates.** (This brand "vN" is separate from
  the semver `1.0.0` in `package.json`/`main.py` — left untouched.)
- **Where the stamp lives** ("base of the platform and required pages"): the **app shell footer** in `App.jsx` (centred
  `<footer>` at the base of `<main>`, on every one of the 30+ app pages, links to Settings → Version) **plus** the
  **Landing**, **Terms/Privacy** (`Legal.jsx`), and **Login/Register** (`AuthPage.jsx`) footers.
- **Settings → Version** (new sub-page): route `path="about"` → `SettingsAbout` (exported from `Settings.jsx`, imported
  in `App.jsx`), new **"Version"** pill in the settings sub-nav (the `circleV` icon). URL `/app/settings/about`.
- **"Pass" → "event" (5 user-facing copy spots, all the kitchen "the pass"):** `Landing.jsx` ×3 (GAP_POINTS "at the
  event"; "Built for the move" feature "at the event…"; gap heading **"You were trained for the event — not the
  paperwork"**), `Home.jsx` ×1 (My-Brain chef's tip "…the second the event allows"), `Support.jsx` ×1 (phone FAQ
  "capture ideas at the event"). **Deliberately NOT touched:** "password"; Python `pass`; `passes`/`passed`; and backend
  `admin.py` "That day has already **passed**" (correct English, not the pass).
- **No voiceover re-render needed:** `vo-script.json` + `introfilm.jsx` contain **no "pass"** (checked).
- **Follow-on copy tweak (same branch):** "the applause" → "the final presentation" — `Landing.jsx` features heading
  ("Everything between the enquiry and the final presentation") + `Bookings.jsx` page subtitle ("Every event from
  enquiry to final presentation"). Only 2 instances; no "applause" elsewhere (incl. voiceover).
- **FAQ kept current (standing rule #3):** Support FAQ "How do I see what's new when the platform updates?" — neutral,
  points at Settings → Version release notes; **no mention of the scripture/dedication**.
- **Verified:** `npm run build` clean (78 modules). Playwright (system chromium, desktop 1280), demo chef — version
  format check **9/9** (on top of the earlier 22/22): stamp shows lowercase italic `v1.matthew.25:23` + circle-v glyph
  (old cross/`V1. Matthew 25:23` gone); tooltip is the ref only; "the pass" gone & "at the event" present; app base
  footer links to settings/about; Settings → Version shows "What's new" + `v1.matthew.25:23` (italic) + the update
  bullets + "Release history" + the Version nav pill, and **contains no "Jesus"/"dedicat"/verse prose**; Support page
  has the neutral updates FAQ. Only console noise = the known harmless Google-Fonts failures (0 app-origin). Temp
  verify scripts removed.

## Latest session (2026-06-16, eighteenth wave — social preview, ICS calendar feed, DB backup, CSV export, trial-reminder email, self-serve plan switching)
- Branch `claude/gracious-newton-tfm2dk` — **merge to `main` to deploy.** Clears the **rest of the 7th-wave review
  item 7** (OG/social tags, ICS feed, CSV export, admin DB-backup download — all now done) **plus two from Ellice's
  list** (trial-ending reminder email, self-serve plan switching). **Backend: 2 additive `users` columns**
  (`calendar_token`, `trial_reminder_sent`) via `ensure_columns`; 5 new files (`app/ics.py`, `app/scheduler.py`,
  routers `calendar_feed.py` / `exports.py` / `cron.py`). **No new runtime deps** (stdlib csv/sqlite3/threading; ICS
  hand-rolled; OG image is a build-time Playwright screenshot, checked in). `npm run build` clean (77 modules).
- **Social preview (OG/Twitter):** `frontend/index.html` now has full Open Graph + Twitter `summary_large_image`
  tags + a 1200×630 brand card at `frontend/public/og-image.png` (regenerate via `scripts/make_og.py`). Absolute URLs
  point at `https://creatistecommand.onrender.com` — **update them if a custom domain is added.** Link-in-bio shares
  now render a card on WhatsApp/Instagram/etc.
- **ICS calendar feed:** private per-chef token (`calendar_token`, minted at register + bootstrap like `enquiry_token`)
  → public `GET /api/calendar/<token>.ics` (`routers/calendar_feed.py` + `app/ics.py`) of bookings + tastings
  (cancelled excluded; timed events use floating local time, dateless ones are all-day). Subscribe link + `webcal://` +
  "From URL" instructions in **Settings → App & integrations → "Calendar subscription"**. Read-only; no rotate-token UI
  yet (resetting the column would invalidate the link).
- **Admin DB backup:** `GET /api/admin/backup` streams a consistent SQLite snapshot (SQLite online-backup API, safe
  while live) → BackgroundTask cleans the temp file. Button + free-tier-wipe warning in **Admin → Overview → "Database
  backup"**. The **interim safety net until the persistent disk is added** (see action items).
- **CSV export:** `routers/exports.py` — `/exports/clients.csv` (Pro+), `/exports/bookings.csv` (all) — plus finance
  `/finance/export/invoices.csv` + `/finance/export/expenses.csv` (owner+Pro, gated on the finance mount). Central hub
  in **Settings → App & integrations → "Export your data"**, quick buttons on **Clients** + **Finance** (invoices/
  expenses tabs), and a **client-side Allergen-matrix CSV** on the Allergens page. New `api.download(path, filename)`
  (raw fetch + bearer, bypasses the offline cache/queue) drives all authenticated downloads; CSVs carry a UTF-8 BOM so
  Excel opens them cleanly.
- **Trial-ending reminder email (day-4):** `app/scheduler.py` — an in-process daemon thread (single worker, same
  pattern as `ratelimit.py`) sweeps every `SCHEDULER_INTERVAL_HOURS` (6) **and once on startup**, emailing trialing
  chefs `TRIAL_REMINDER_DAYS_BEFORE` (1 = day-4 of the 5-day trial) before the trial ends. Idempotent via
  `trial_reminder_sent`; **no-op until email is configured** (a reminder is never "spent" silently before email works);
  skips chefs who already added a card (`stripe_subscription_id`). Free-tier instances sleep, so for guaranteed daily
  sends point an external uptime/cron at `POST /api/cron/trial-reminders` with header `X-Cron-Key: <CRON_SECRET>`
  (`routers/cron.py`).
- **Self-serve plan switching:** `POST /api/billing/change-plan` — demo mode flips the plan instantly; a live Stripe
  subscriber's recurring price is updated via `Subscription.modify(items=[{id, price_data}], proration_behavior=
  "create_prorations")` (the one-time onboarding fee isn't a sub item, so untouched), wrapped so **any Stripe error
  degrades to "manage in the billing portal / contact support"**. Founders are blocked (contact support so the lifetime
  rate is preserved). UI = a **"Change plan"** card in **Settings → Membership** (3 tiers, current marked, switch
  buttons; confirm dialog; refreshes user + billing after). FAQ updated — it's real now, no longer "coming".
- **Bonus latent-bug fix:** new chefs get **both** `enquiry_token` and `calendar_token` **at registration** now
  (previously `enquiry_token` only appeared after the next startup bootstrap).
- **New optional env (all safe defaults — nothing required of Ellice):** `CRON_SECRET` (enables the cron endpoint;
  empty = endpoint 403s), `TRIAL_REMINDER_DAYS_BEFORE` (1), `SCHEDULER_INTERVAL_HOURS` (6), `ENABLE_SCHEDULER` (1).
- **Verified:** backend FastAPI TestClient **29/29** (admin backup = real SQLite + admin-gated; ICS timed/all-day/
  cancelled-excluded/bad-token-404; clients/bookings/invoices/expenses CSV content; change-plan demo + unknown-422 +
  same-plan no-op; cron reminds exactly 1 then 0 (idempotent) + wrong-key 403). Playwright (system chromium, desktop
  1280 + mobile 390) **21/21**: OG tags + og-image 200; calendar + export cards render; **a CSV and the DB backup
  actually download**; **plan switch Elite↔Pro round-trips in the UI**; export buttons on Clients/Finance/Allergens.
  No console errors beyond the known harmless Google-Fonts cert noise. Temp verify scripts removed.
- **⚠️ ACTION for Ellice:** (1) **Persistent disk is still the #1 operational risk** — add `DATA_DIR=/var/data` + a
  paid Render disk before real chefs sign up; the new backup download is only a manual stopgap (and it's also the true
  fix for feedback #1's surprise logouts). (2) For reliable day-4 reminders on the free tier, set `CRON_SECRET` and
  point a free uptime/cron service at `…/api/cron/trial-reminders` (header `X-Cron-Key`). (3) **Confirm the live-Stripe
  plan-switch path with a real test subscription once Stripe is live** — it couldn't be exercised in-sandbox. (4) On a
  custom domain, update the OG URLs in `frontend/index.html` (re-run `make_og.py` only if branding changes).

## Readiness sweep (2026-06-16, pre-soft-rollout) — Mise plan-gating fix
- After the 18th wave, did a full pre-rollout review (live new-chef walk of all 32 pages with every paid service OFF
  → all rendered, **zero app-origin errors / zero uncaught exceptions**, only the known Google-Fonts sandbox noise;
  empty states all friendly; onboarding gate + public enquiry form + Mise-chat-fallback all good). One real issue found
  and fixed:
- **Mise (AI) tools were not plan-gated.** The 5 sous-chef endpoints (`/ai/recipe`, `/ai/shopping-list`, `/ai/prep-plan`,
  `/ai/menu-suggest`, `/ai/idea-polish`) used `require_active`, not `require_plan(3)` — a Solo/Pro chef could call an
  Elite-only feature (revenue leak once the key is on), and **every chef saw "Draft with Mise" buttons that errored**
  with "AI not configured" while the key is off (founders are Elite-level, so the actual soft-rollout users would hit
  dead buttons). Fix: (1) `require_plan(3)` on those 5 endpoints (→ clean 403 upgrade message for non-Elite; `support-chat`
  stays open to all); (2) `enriched_user` now returns `ai_enabled` (= `bool(ANTHROPIC_API_KEY)`); (3) new `miseReady(user)`
  helper (`format.js`) = `ai_enabled && plan_level>=3` gates the Mise UI in **Recipes**, **BookingDetail**, **Ideas**.
  Net: Mise UI is **hidden for everyone while the AI key is off**, and **appears automatically for Elite the moment Ellice
  sets `ANTHROPIC_API_KEY`** (no code change needed). Verified: Solo→403, Elite→503-when-off; UI hidden (AI off, 3/3),
  shown for Elite + hidden for Solo (AI on, 2/2). `npm run build` clean (77 modules).

## Latest session (2026-06-16, seventeenth wave — WhatsApp/email "Contact client" + menu sharing)
- Same branch `claude/determined-brahmagupta-oxnjxp` — **merge to `main` to deploy.** Builds owner
  feedback item **8** (contact client) and completes the current batch. **Backend: 2 additive `users`
  columns** (`contact_channel`, `contact_template`) via `ensure_columns`. No new env/setup. `npm run
  build` clean (77 modules).
- **`frontend/src/contact.jsx` — `<ContactClient client booking? />`**: a "Contact" button → modal
  with the chef's **template message pre-filled** (`fillTemplate` replaces `{client}/{business}/
  {event}/{date}`), **Open in WhatsApp** (`https://wa.me/<digits>?text=…`, phone stripped to digits)
  and **Open in email** (`mailto:?subject&body`). Channels shown respect the chef's preferred-channel
  setting and what the client actually has (phone/email). Returns null if the client has neither.
- **Menu sharing rides here:** the modal has an **"Attach a menu PDF"** picker (menus that have a
  `pdf_url`); choosing one appends `Here's our <title>: <origin>/uploads/…pdf` to the message. `/uploads`
  is a public StaticFiles mount, so the link opens for the client. This is how set menus reach
  **enquired** clients (Ellice's steer — no public pages).
- **Wired in:** Clients page (each client's detail card) and **BookingDetail** (Client card, passes the
  booking for `{event}`/`{date}` context). **Settings → Business** gains a **"Contacting clients"** card:
  preferred channel (both/WhatsApp/email) + the editable message template (placeholder hint). Saved with
  the business profile; `contact_channel`/`contact_template` are overlaid from the **owner** in
  `enriched_user` so staff use the business defaults.
- **Verified:** API — contact prefs persist on `PUT /auth/me`. Playwright (desktop) **10/10**: the
  Settings contact card + saved template, the Contact button on a client, the modal prefilled from the
  template, **menu PDF link appended**, the Email button, and the **WhatsApp deep link**
  `https://wa.me/447911123456?text=…` (captured via a `window.open` shim — "+44 7911 123456" → digits),
  plus the **Contact client** button on the booking detail. No console errors.

## Latest session (2026-06-16, sixteenth wave — Menu master page + booking menu dropdown)
- Same branch `claude/determined-brahmagupta-oxnjxp` — **merge to `main` to deploy.** Builds owner
  feedback item **7** (menu master page). **Backend: new `menus` table** (`create_all` makes it) + one
  additive `bookings.menu_type` column (`ensure_columns`). No new env/setup. `npm run build` clean (76
  modules). All plans (not gated) — menus are recipe-adjacent.
- **Menus page** (`pages/Menus.jsx`; route `/app/menus`; new **"Menus"** item in the Kitchen nav after
  Recipes — `doc` icon): card grid + search + New/Edit modal. Each menu = **title, menu type**
  (datalist of common types), **price/head**, **description**, **courses** (the same `{course,name,
  recipe_id,notes}` rows the booking menu uses — each dish can link a recipe sheet), an **attached
  PDF** (`api.upload`, `.pdf`) shown as an open/download chip, and a **live/archive** toggle. Cards
  show type badge, price, first dishes, the PDF link + dish count.
- **Backend:** `Menu` model (OwnedMixin) + `core.menus = crud_router(Menu, …)` registered at
  `/api/menus`; `Menu` added to admin `PURGE_MODELS` (delete-chef cascade) so no orphans.
- **New-Booking "Menu" dropdown:** `BookingForm` now also fetches `/menus` and offers a **datalist of
  menu titles** on a new "Menu" field, stored on the booking's new **`menu_type`** column (also shown
  in the BookingDetail "Event details" grid). **GOTCHA hit & fixed:** a new model column must be added
  to the **model class**, not only to `ensure_columns` — the generic `crud_router`/`to_dict` whitelist
  is built from `model.__table__.columns`, so a DB-only column silently won't save/serialize. Verified
  by API (`menu_type` came back `None` until the model got the field).
- **Sharing** (the PDF → client) is deferred to **#8**: the WhatsApp/email "Contact client" action
  will be where a menu PDF is sent to clients who've enquired.
- **Verified:** API — menu create (with courses) + list; booking `menu_type` round-trips after the
  model fix. Playwright (desktop + mobile) **11/11**: Menus nav + page, an API-made menu card + type
  badge, **UI create with a PDF attached** (card shows the PDF link), the **New-Booking Menu dropdown
  lists the menus**, and the **mobile bottom nav still shows Shopping** (the inserted nav item shifted
  the Kitchen indices — `mobileMain` updated from `[1].items[2]`→`[1].items[3]`). No console errors.
  (Several Playwright flakes were harness-only — native `<datalist>` popup intercepting clicks, the
  sticky modal header, and `is_visible()` not waiting — each ruled out against direct DOM evidence.)

## Latest session (2026-06-16, fifteenth wave — Business profile (internal) + booking service dropdown)
- Same branch `claude/determined-brahmagupta-oxnjxp` — **merge to `main` to deploy.** Builds owner
  feedback item **9** (business profile). Ellice's steer: **internal only** (chefs keep their own
  public sites/booking — no public page). **Backend: 5 additive `users` columns** (no data loss;
  `ensure_columns` adds them at boot). No new env/setup. `npm run build` clean (75 modules).
- **Settings → Business** (`pages/Settings.jsx` `SettingsBusiness`; route in `App.jsx`; new "Business"
  pill in the settings sub-nav; **owner-only** — staff see a short notice): **logo** (reuses the
  existing `avatar_url` column; saves on upload), **business description**, **services you offer**
  (editable chips), **business contact email**, **social links** (instagram/facebook/tiktok/website/
  x/youtube in a `socials` JSON dict), and a **gallery** (multi-upload → `gallery` JSON list). Logo +
  gallery save immediately on upload; the text/list fields save on the button. An **init-once `useRef`
  guard** stops an upload's `setUser` from wiping in-progress text edits.
- **New-Booking "Event type" is now a dropdown** of the chef's services (`<input list>` + `<datalist>`
  in `BookingForm`), still accepting free text so existing event types keep working. The form reads
  `user.services`, which `/auth/me` + login now overlay from the **owner** (so staff get the
  business's services too). Menu-type dropdown will join it when #7 lands.
- **Backend tidy (fixes a latent bug):** new `auth_router.enriched_user(db, user)` — `/me`, login and
  **`PUT /auth/me`** all return through it, so saving the profile no longer hands back a bare user
  object missing `plan_level`/`is_staff`/`business_name`/`services` (the old Profile save had this gap
  too). JSON fields are assigned as fresh objects on update so SQLAlchemy actually persists them.
- **Data model:** `User` gains `business_description` (Text), `business_email` (str), `services`
  (JSON list), `socials` (JSON dict), `gallery` (JSON list); `avatar_url` reused as the logo.
- **Verified:** API — `PUT`/`GET /auth/me` persists services/socials/description/email and keeps the
  overlays (`plan_level` 3, `is_staff` false). Playwright (desktop + mobile) **17/18** (the miss was a
  non-waiting toast assertion; the save was confirmed via the API — "Buffet service" + logo persisted):
  Business pill in the sub-nav, all four cards render, saved chips show, add-service + save, **logo
  upload renders**, and the **New-Booking event-type dropdown lists the services**. No console errors.

## Latest session (2026-06-16, fourteenth wave — split Settings pages + Bookings enquiry pipeline)
- Branch `claude/determined-brahmagupta-oxnjxp` — **merge to `main` to deploy.** Builds owner
  feedback items **5** (split Settings) and **6** (bookings enquiry pipeline). **Frontend only —
  no backend changes, no new env/setup for Ellice.** `npm run build` clean (75 modules).
- **Settings split into individual pages** (`frontend/src/pages/Settings.jsx` + nested routes in
  `App.jsx`): `/app/settings` is now a layout (PageHeader + a sub-nav rail) with **nested routes**,
  one page each — **Profile** (index, `/app/settings`) · **Security** (`/security`, change password)
  · **Appearance** (`/appearance`, theme) · **Membership** (`/membership`, billing + founders card)
  · **App & integrations** (`/integrations`, install/PWA + Mise status + email status + public
  enquiry link). Sub-nav = horizontal scrollable pills on mobile, a left vertical rail on `lg`
  (NavLink active state). Each sub-page fetches only what it needs (billing/ai/founders) and keeps
  the old conditionals (founders card founders-only; enquiry link non-staff Pro+ with a token;
  cancel/portal hidden for admin). Settings.jsx exports the layout (default) + `SettingsProfile /
  Security / Appearance / Membership / Integrations`; App.jsx imports them for the child routes.
  Sidebar / bottom-nav / "More" links to `/app/settings` still land on Profile (index); deep-links
  and reloads to a sub-page work via the SPA catch-all + SW network-first navigations.
- **Bookings "Pipeline" view** (`frontend/src/pages/Bookings.jsx`): a third view toggle **List ·
  Pipeline · Calendar**. Pipeline = a **4-column lead board** (`enquiry → quoted → confirmed →
  in_prep`; completed/cancelled graduate off it) — 4 cols on `xl`, 2 on `md`, stacked on mobile.
  Each card shows the **rough details the client sent** (title, date + relDays, guests, event type,
  venue, quoted price, and the enquiry `notes` block with contact / budget / message), a full-width
  **"Move to <next>"** one-tap advance button (`Mark complete` at in_prep), and **"Edit details"** →
  the existing `BookingForm` in a modal (fill in / refine as she talks to the client). Advance does
  `PATCH /bookings/{id}` `{status: next}` and updates the list in place with a toast. The **Pipeline
  toggle carries a copper count badge** of new `enquiry`-status leads needing attention. No new
  endpoints — reuses `/bookings` GET + PATCH and the existing `enquiry`-status rows from the public
  form. List view (upcoming / past / all) + Calendar unchanged. NB the public enquiry form already
  feeds these rows in; the board is just a better lens on them.
- **FAQ kept current (standing rule #3):** updated the "public enquiry form" FAQ in `Support.jsx`
  to point at **Settings → App & integrations** (the link moved there in the split) and to mention
  the new Pipeline view. No other feature capability changed, so other FAQ copy still holds.
- **Verified:** Playwright (system chromium, desktop 1280 + mobile 390), demo Elite chef, after a
  DB reseed + a fresh public enquiry → **42/42 checks**: Settings sub-nav (all 5) + each sub-page
  renders (Profile fields, Security password, Appearance theme, Membership status row once billing
  loads, Integrations app+Mise+enquiry cards) + deep-link/reload to a sub-page; Bookings Pipeline
  shows all 4 stage columns + the enquiry lead card with its rough details, the quick-edit modal
  opens, and one-tap advance moves a lead (toast + the enquiry badge clears). No console errors
  beyond the known harmless Google-Fonts cert noise. (Temp verify script removed after.)
- **Follow-on fixes (same branch — owner pointers 10 & 11):** (a) **Tastings icon is now a spoon** —
  added a `spoon` glyph to `ui.jsx` and repointed every Tastings reference (sidebar, Home module
  guide, Landing feature card, Tastings empty state, intro-film montage + app vignette) off `cup`,
  then removed the unused `cup` glyph. (b) **Modals no longer discard input on an accidental
  click-off** — the shared `Modal` dropped its backdrop-click close; it now closes only via the X or
  Escape, so clicking outside a half-filled form can't wipe it. Verified 6/6 with Playwright (spoon
  glyph wired on the Tastings nav; a backdrop click keeps the New-booking modal open *and* the typed
  value; Escape and the X still close). `npm run build` clean (75 modules).

## Latest session (2026-06-16, thirteenth wave — security hardening: SVG uploads, enquiry honeypot + rate-limits, login throttle)
- Branch `claude/wizardly-keller-06hky9` — **merge to `main` to deploy**. Knocks out the
  seventh-wave review's **item 7 security sub-items**: drop `.svg` from uploads, honeypot +
  rate-limit the public enquiry form, and a brute-force throttle on login (plus forgot-password,
  same email-spam class). **No new env vars or setup for Ellice** — works out of the box; all six
  limits are env-tunable if ever needed.
- **`.svg` dropped from `ALLOWED_UPLOAD_EXT`** (`config.py`): SVGs can carry `<script>` and uploads
  are served same-origin from `/uploads`, so a booby-trapped one opened directly = stored XSS. Chefs
  only upload photos (png/jpg/jpeg/webp/gif) + PDF receipts — SVG was never needed. Anyone trying to
  upload `.svg` now gets a friendly 422; raster/PDF unaffected. (NB the Designs studio draws inline
  SVG client-side and saves it as JSON path data — **not** an upload — so it's untouched.)
- **New tiny in-process rate limiter** (`backend/app/ratelimit.py`, stdlib only): a per-key sliding
  window in memory — `client_ip()`, `count(key, window)`, `record(key, window)`, `reset()`. The app
  runs as a single uvicorn worker so this is enough; **if we ever run multiple workers, move the
  store behind Redis** (shared window). `client_ip` reads the first `X-Forwarded-For` entry (Render's
  real client IP) and falls back to the socket peer for local/dev. The read-then-write pair lets each
  caller choose what counts (enquiry counts every accepted submission; login counts only failures).
- **Public enquiry form hardened** (`routers/public.py` + `pages/PublicEnquiry.jsx`): it creates a
  booking *and* emails the chef with **no login**, so it's a spam magnet once the link is in a bio.
  Two layers — (1) a **honeypot**: a hidden off-screen `company` field real users never see; any
  submission that fills it gets a **silent 201** (don't tip the bot off) and **creates nothing**;
  (2) a **per-IP rate limit** (`ENQUIRY_RATE_MAX=5` per `ENQUIRY_RATE_WINDOW=600`s → 429 after).
  Both sit *after* the invalid-token 404, so the costly booking+email path is what's protected.
- **Login brute-force throttle** (`routers/auth_router.py`): **only failed** sign-ins from an IP
  count (`LOGIN_RATE_MAX=10` per `LOGIN_RATE_WINDOW=300`s); once over the cap even a correct password
  is refused with 429 until the window slides — a guesser can't grind past the wall, but a normal
  user (or a shared office IP) who signs in correctly is never penalised.
- **Forgot-password throttle** (same wave, related — same unauthenticated-email-spam class):
  capped per IP (`FORGOT_RATE_MAX=5` per `FORGOT_RATE_WINDOW=900`s, 429 after); the deliberate
  no-account-enumeration generic 200 is preserved for unknown emails.
- **Verified:** backend via FastAPI TestClient — **22 checks** (`.svg` 422 / `.png` 201; honeypot
  silent-201 + no booking, real enquiry creates one; enquiry 5-then-429 + other IP unaffected; login
  10-fails-then-429, correct-pw-on-blocked-IP 429, fresh IP 200, 9-fails-then-correct-pw 200 i.e.
  successes don't count; forgot 5-then-429 + unknown-email generic 200; the ratelimit primitive).
  Playwright (system chromium, demo chef's enquiry link) — **7 checks** (form renders, honeypot input
  + label both parked off-screen, real submit → Thank-you + exactly one new booking, no real console
  errors). `npm run build` clean (75 modules). Only console noise = the known harmless Google-Fonts
  cert error. (Temp verification scripts were removed after — nothing left in the tree.)
- **Review item 7 now partly done** — remaining smaller suggestions: OG/social-preview meta tags,
  ICS calendar feed, CSV export (clients/finance), admin SQLite-backup download. (Item 6 — set
  `AI_MODEL=claude-sonnet-4-6` when Mise goes live — is still the cheap env-only next step.)

## Previous session (2026-06-16, twelfth wave — onboarding timezone + block-out, delete-chef cascade)
- Branch `claude/zen-johnson-y5jrrv` — **merge to `main` to deploy**. Knocks out the seventh-wave
  review's next two items: **3 (call slots: no block-out + BST drift)** and **4 (delete_chef
  orphans)**.
- **Onboarding slots pinned to Europe/London (BST bug fixed):** slot times were treated as naive
  UTC, so a "09:00" label was compared to the 3-hour booking lead as if it were 09:00 UTC — 1h
  off during British Summer Time. Now `routers/onboarding.py` builds each slot as a
  `ZoneInfo(config.ONBOARDING_TZ)`-aware instant (`_slot_instant`) and iterates **local** dates
  (`_today_local`), so labels + lead-time stay correct through the BST/GMT switch. New
  `config.ONBOARDING_TZ` (default `Europe/London`); **`tzdata` added to requirements** so the zone
  is always present regardless of host base image. Zoom meetings now also send `timezone` so the
  created call matches the local slot.
- **Admin block-out controls (holidays / days off / single slots):** new **`BlockedSlot`** model
  (a row with empty `start_time` = whole day off; a `HH:MM` = one slot). New admin endpoints
  (`admin.py`, admin-gated): `GET /admin/availability` (a grid of every business day in the
  horizon with each slot's state open/booked/blocked/past + the future "time off" list),
  `POST /admin/availability/block` `{date, start_time?}`, `DELETE /admin/availability/block/{id}`.
  `available_slots` (the client booking source) now subtracts blocked days/slots, so blocking
  instantly removes them from the booking page; `book_session` re-validates against it (can't book
  a blocked slot). Admin horizon `ONBOARDING_ADMIN_DAYS_AHEAD` (21d) is longer than the client's
  14d so Ellice can plan ahead; a date-picker blocks holidays further out still.
- **Frontend:** new **`AvailabilityPanel`** at the top of **Admin → Onboarding** (`pages/Admin.jsx`):
  a per-day grid of slot chips (click open↔blocked), a "take the whole day off" day toggle, a
  holiday date-picker, and a "Scheduled time off" chip list with remove buttons. On-brand
  (gold/red states, dark theme), mobile-friendly (scrolls). **GOTCHA re-confirmed: the API helper's
  delete method is `api.del(...)`, NOT `api.delete` (undefined)** — bit me once; all four delete
  calls use `api.del`.
- **delete_chef now cascades (no orphans):** `OWNED_MODELS` (14 tables) → **`PURGE_MODELS` (24
  tables)** — adds Appointment, Shift, PackingList, Supplier, SupplierPrice, Quote, ActivityLog,
  OnboardingSession, FounderFeedback, SupportTicket. It now also gathers the chef's **staff
  logins** (`User.owner_id == chef.id`), purges every user-keyed row for the owner *and* their
  staff ids (`user_id.in_(ids)`), then deletes the staff users, then the owner. (`BlockedSlot` is
  platform-level, not per-chef — untouched.)
- **Verified:** backend via FastAPI TestClient — **23 checks** (tz helpers BST/GMT, lead-time
  filters the right slots in summer, availability grid states, block/unblock single slot + whole
  day, blocked slots hidden from client booking, past-date/non-slot-time 422s, delete cascade
  empties all 24 tables + staff + staff-owned tickets while a bystander chef's data survives).
  Playwright (system chromium, desktop) — **12 checks** (panel renders + Europe/London badge, 171
  open slots, block a slot → blocked + time-off chip, reopen → cleared, whole-day off + restore,
  holiday via date-picker persists across reload, remove). `npm run build` clean (75 modules). Only
  console noise = the known harmless Google-Fonts cert errors.
- **No new env/setup for Ellice** — works out of the box. `ONBOARDING_TZ` is overridable but
  defaults to Europe/London; `ONBOARDING_ADMIN_DAYS_AHEAD` tunes the admin grid length.
- **Follow-up tweaks (same session, after Ellice tried it — already merged to `main`):** at her
  request the bookable window was **widened to 08:00–20:00 (8am–8pm)** — 13 slots/day, first 08:00,
  last 20:00 — and the calendar **opened to Mon–Sun** (Sunday added). Both are config defaults in
  `config.py`: `ONBOARDING_DAY_START=8` / `ONBOARDING_DAY_END=21` (range end is exclusive; 21 ⇒
  last slot 20:00) and `ONBOARDING_WEEKDAYS={0..6}`. NB the verification numbers above (171 open
  slots; "Mon–Sat 09:00–17:00" in older notes) predate these — the live grid is now Mon–Sun
  8am–8pm. Commits `a697252` (hours) + `4704ac6` (Sunday) on top of the wave commit `b70cb1f`.

## Previous session (2026-06-14, eleventh wave — password reset + Terms/Privacy pages)
- Branch `claude/pensive-clarke-eirbkc` — **merge to `main` to deploy**. Knocks out the two
  highest-priority gaps from the seventh-wave review: **item 1 (no password reset)** and
  **item 2 (no Terms/Privacy)**.
- **Password reset — two paths (admin-now, email-when-SMTP-on):**
  - **Admin reset (works today, no SMTP needed):** Admin → Chefs → click a chef → new
    **"Reset password"** block in the modal. Type a password *or* hit **Generate** for a
    temporary one; the new password is shown **once** in a copyable box for Ellice to relay,
    then the chef changes it in Settings. Endpoint `POST /admin/chefs/{id}/set-password`
    (admin-only) → `{password, generated}`. This is the locked-out-chef recovery path.
  - **Self-service email flow (lights up once SMTP is set):** login page now has a
    **"Forgot password?"** link → `/forgot-password` → `POST /auth/forgot-password`
    (deliberately generic response — **no account enumeration**; mints a 2-hour token and
    emails `{APP_URL}/reset-password?token=…`). `/reset-password` page → `POST
    /auth/reset-password` (validates token + expiry, **single-use**, clears it).
  - **No-SMTP fallback UX:** with email off, the forgot-password page tells the user to email
    **support** instead of promising a link. Both that page and the legal pages read
    `GET /auth/config` → `{email_enabled, support_email}`.
  - **Data:** new `users.reset_token` / `reset_token_expires` columns (additive
    `ensure_columns` migration, same pattern as prior waves). These are **stripped from every
    User serialization** — `auth_router.USER_EXCLUDE`, `admin.USER_EXCLUDE`,
    `team.STAFF_EXCLUDE` — so tokens never leak in `/auth/me`, `/admin/chefs`, or staff lists.
- **Legal pages:** `/terms` + `/privacy` (new `frontend/src/pages/Legal.jsx`, exports `Terms`
  + `Privacy` off one shared layout). Plain-English, **UK-oriented** (England & Wales law, UK
  GDPR + ICO, Stripe billing, and a **food-safety / allergen / Natasha's-Law disclaimer** that
  the chef stays responsible — important for a catering tool). Contact email is pulled live
  from `/auth/config`. **Linked from the landing footer and the register form** ("By creating
  an account you agree to…"). Copy edits → bump `UPDATED` ("Last updated 14 June 2026") in
  Legal.jsx.
- **⚠️ ACTION for Ellice:**
  1. The ToS/Privacy are solid **templates, not legal advice** — have a solicitor review them
     and add registered business details / a postal address before charging real cards in anger.
  2. The email reset link won't actually send until **SMTP_\* env vars** are set on Render;
     until then use the admin-side reset. Also set **`SUPPORT_EMAIL`** to a monitored inbox
     (it still defaults to `ADMIN_EMAIL`) so the "contact support" fallback reaches someone.
     **(2026-06-15:)** Email is now wired through **Resend** from `command@thecreatistecatering.com`.
     M365 was a dead end (shared mailbox + GoDaddy federation); then Render turned out to **block
     outbound SMTP** (timed out), so `mailer.py` was switched to Resend's **HTTP API** (set
     `RESEND_API_KEY`). Domain verified in Cloudflare. See **"Email & Domain Infrastructure"** for
     the full constraints (Cloudflare account, single-SPF rule, why SMTP can't be used).
     **✅ Verified live 15 Jun** — first password-reset email delivered (landed in junk at first;
     new-domain reputation, will warm up). Added a **DMARC** `v=DMARC1; p=none` TXT at Cloudflare.
     **Rotated** the Stripe live key, Stripe webhook signing secret, `ADMIN_PASSWORD`, and the
     first Resend key (all were briefly visible on-screen during setup).
- New routes are public (outside `/app`); SPA catch-all + SW network-first navigations already
  serve them. `/auth/` and `/admin/` are in the offline `NO_QUEUE`, so these flows fail fast
  offline (correct — they need a connection).
- **Verified:** backend via FastAPI TestClient — 24 checks (config, register hides secrets,
  forgot-password generic + no-enumeration, token persisted/single-use/expired-reject, admin
  generate/set/short-pw/non-admin-403/404, `/auth/me` + chef list hide reset fields) + the
  additive migration adds both columns idempotently. Playwright (system chromium, desktop):
  login "Forgot password?" link, forgot→contact-support fallback + support email, reset
  with/without token, register legal links, Terms (allergen/Natasha + support email) +
  Privacy (ICO/UK GDPR/processor) render, footer links, admin Generate + Set reveal a copyable
  password. Only console noise = the known harmless Google-Fonts cert error. `npm run build`
  clean (78 modules).

## Previous session (2026-06-14, tenth wave — copy reword across film + public site, voiceover re-rendered)
- Branch `claude/inspiring-hopper-tc8hhw` → **merged to `main`** (clean fast-forward; main
  now at `92c2016`). Live on the next Render build from `main`.
- **Wording changes Ellice asked for** (two she chose from options I offered):
  - Intro film **gap scene**: "your prep days" → **"your days of chaos"** (her pick);
    "calm" → **"clear"** ("one clear, beautiful command centre").
  - Intro film **CTA**: "command of your craft" → **"command of your kitchen"**.
  - "calm" → "clear" everywhere else it described the product: intro **app scene**
    ("All clear — all in one screen") + **Dashboard** empty-state ("Nothing pending.
    You're all clear.").
  - **Mise line** (everything scene) expanded: "…your AI sous-chef (as in mise en place,
    **so everything is set up and put into place for you**)" — caption + speech.
  - **Public nav headers** (`pages/Landing.jsx`): "The intro" → **"Intro"**;
    "Why Creatiste" → **"Why Us?"**.
  - Deliberately **left** `Landing.jsx` "Built around real prep days — shop runs, van
    packs…" untouched (different line; "prep day" is used positively across the brand).
- **Single source of truth honoured**: every change edited BOTH `caption` and `speech` in
  `frontend/src/vo-script.json` so captions and audio can't drift; the duplicated visible
  lines in `introfilm.jsx` (SceneGap "Built by a caterer…", SceneCta "Take command of your
  kitchen") were updated to match.
- **Voiceover RE-RENDERED & shipped** (what kept audio == captions): Ellice ran
  `scripts/render_voiceover.py` locally again (Mac; sandbox still can't reach
  `api.elevenlabs.io`), kept the **default Alice** voice (`Xb7hH8MSUJpSbSDYk0k2`,
  `eleven_multilingual_v2`), then uploaded the regenerated **`vo.mp3`** (~1.27 MB, up from
  1.25 MB — narration is longer now) + **`vo.json`** via the GitHub web UI onto the branch;
  I fast-forwarded `main`. **Takeaway: any future caption edit needs a matching re-render**
  (edit `vo-script.json` → run the script on a machine with internet → upload both files).
  This session the key was typed only in Ellice's own Terminal (not pasted in chat).

## Previous session (2026-06-14, ninth wave — intro-film voiceover rendered & shipped)
- Branch `claude/youthful-brahmagupta-9wsed8` → **already merged to `main`** (main at
  `ca01215`); the recorded voiceover goes live with the next Render build from `main`.
- **The eighth wave's awaited step is done — the ElevenLabs render shipped.** Ellice ran
  `scripts/render_voiceover.py` with her key; the produced files are committed in
  `frontend/public/`: **`vo.mp3`** (~1.22 MB, 128 kbps) + **`vo.json`** (7 contiguous cues
  hook1→hook2→welcome→everything→gap→app→cta, `dur` 78.16s). The intro film now runs
  **audio-first** (the Alice voiceover is the master clock); browser TTS stays as the no-file fallback.
  - Voice = **Alice**, ElevenLabs `voiceId Xb7hH8MSUJpSbSDYk0k2`, model `eleven_multilingual_v2`
    (en-GB female — matches the seventh-wave "option B, not her own voice" call). To change the
    voice later: `--list-voices` → set `ELEVENLABS_VOICE_ID`, re-render, re-upload both files.
- **GOTCHA for any future render — the sandbox CANNOT reach `api.elevenlabs.io`**: the
  environment's network egress allowlist blocks it (`403 Host not in allowlist`), exactly as the
  script header warns. So the render must run somewhere with internet. The path used this session:
  Ellice (Mac, no Python) installed python.org Python + ran its "Install Certificates.command",
  downloaded the repo ZIP, ran `python3 scripts/render_voiceover.py`, then **uploaded the two
  files via the GitHub web UI** onto the dev branch — I fast-forwarded `main` to it (clean ff, no
  conflicts). Alternative (not used): add `api.elevenlabs.io` to the env's egress allowlist + start
  a fresh session, then it renders in-sandbox with no local steps.
- **Security:** the ElevenLabs API key was pasted in chat — Ellice advised to rotate it in the
  ElevenLabs dashboard now that the render is done.

## Previous session (2026-06-13, eighth wave — intro film: recorded voiceover + film polish)
- Branch `claude/gallant-ramanujan-vumagq` — merge to `main` to deploy.
- **Acted on last session's review item 5 (the "slideshow + robotic voice" niggle).**
  Ellice chose **option B — a one-time ElevenLabs render** (not her own voice) for
  the ~70s voiceover. The film engine is rebuilt to be **audio-first** while keeping
  browser TTS as a no-file fallback, plus the requested polish.
- **`frontend/src/introfilm.jsx` rebuilt:**
  - When a recording is present (`frontend/public/vo.mp3` + `vo.json` cue points),
    **the audio is the master clock**: a rAF loop reads `audio.currentTime`, advances
    scenes as it crosses each cue, drives the progress-bar fill from real time, and
    ends the film on the audio's `ended`. Seeking sets `audio.currentTime`; pause/
    resume just pause/resume the element (no per-scene restart). Mute toggles
    `audio.muted`.
  - With no recording it falls back to the **exact previous engine** (per-scene
    timers + SpeechSynthesis, "wait for both timer and voice" gating). So the site
    works with or without the render — nothing breaks until Ellice produces the file.
  - **Crossfades + Ken Burns**: scene cuts cross-dissolve via two stacked layers
    (`.if-cross-in`/`.if-cross-out`) and the incoming layer gets a slow `.if-ken`
    drift (CSS in `index.css`, reduced-motion-aware). Applies in both modes.
  - **New 7th scene — app-UI vignette** (`SceneApp`): a stylised mini dashboard
    (brand header, sidebar, stat cards "3 events / 12 tasks / £4.2k", booking rows)
    that animates in, so the line "one command centre" pays off with the real screen.
    Order: hook1, hook2, welcome, everything, gap, **app**, cta (counts now "/ 7").
- **Single source of truth for narration: `frontend/src/vo-script.json`** — every
  scene's `caption` + `speech` + fallback `dur`, keyed. The film imports captions
  from it; the render script reads `speech` from it. So **on-screen captions and the
  recorded audio can never drift apart**. (Edit copy here, not in the component.)
- **`scripts/render_voiceover.py`** — the one-time render (stdlib only, no pip deps):
  reads `vo-script.json`, calls ElevenLabs **with-timestamps**, writes
  `frontend/public/vo.mp3` + `vo.json` (per-scene cues computed from the character
  timestamps). Ellice runs it **locally** (needs internet, not the sandbox):
  `export ELEVENLABS_API_KEY=sk_…` then `python scripts/render_voiceover.py`.
  Optional `ELEVENLABS_VOICE_ID` (default Alice, a warm en-GB female; override with
  her own — `--list-voices` prints account voices + IDs) and `ELEVENLABS_MODEL`.
  `--dry-run` previews the script with no API call. **Then commit both produced
  files.** Delete them to revert to TTS.
- **`frontend/sw.template.js`**: the service worker now **bypasses `.mp3`/range
  requests** so the voiceover streams natively (caching 206 partials breaks media
  seeking). The film is public-marketing, deliberately **not** precached — the
  offline target is the installed `/app`, which never needs it.
- **DO NOT commit a placeholder `vo.mp3`** — it would ship a wrong/silent voice.
  (For verification I generated a synthetic clip into `dist/` only, which is
  gitignored.) Awaiting Ellice running the render with her chosen ElevenLabs voice;
  until then the film uses the TTS fallback exactly as before.
- Verified 15/15 with Playwright (system chromium) against `vite preview` (the film
  is a static landing feature — no backend needed), desktop + 390px: **audio mode**
  (poster shows real 0:13, audio drives all 7 scenes + fill, app vignette renders,
  ends on audio end, seek/pause/resume, Ken Burns layer present) and **fallback mode**
  (recording removed → poster shows 1:21 estimate, `if-fill` timer engine drives
  progress, seek + timer-driven end card), no console errors beyond the expected
  vo.json 404 on the fallback probe (and the known harmless Google-Fonts cert error).

## Previous session (2026-06-13, seventh wave — full platform review + "mise en place" copy)
- Branch `claude/adoring-davinci-9pfah3` — merge to `main` to deploy.
- **Mise now explains its own name at a glance** everywhere it's described (Ellice's
  request): Landing feature card, Home module-guide bubble, Support FAQ ("What is
  Mise?"), Settings card, BookingDetail AI card, intro-film montage caption (speech
  track says it phonetically: "Meez … meez-on-plass"), ai.py SUPPORT_SYSTEM knowledge,
  README. Standard wording: "Named for/after mise en place — everything in its place
  before service." Plan-JSON feature bullets deliberately untouched (they live in the
  DB; a code change wouldn't roll forward and could clobber live pricing edits).
- **Full review delivered in-chat.** Top findings (status as of 16 Jun: 1, 2 ✅ 11th wave;
  3, 4 ✅ 12th wave; 5 ✅ waves 8–10; 7's **security** sub-items ✅ 13th wave — **next unactioned:
  6, then the rest of 7**):
  1. ✅ **DONE (11th wave)** — password reset built: admin set/generate in the chef modal +
     self-service email flow (now sending live via Resend).
  2. ✅ **DONE (11th wave)** — Terms + Privacy live at `/terms` `/privacy`, linked from the
     footer + register form. (Templates — still want a solicitor's review before relying on them.)
  3. ✅ **DONE (12th wave)** — onboarding slots pinned to **Europe/London** (BST drift fixed) +
     admin block-out controls (days off / holidays / single slots) in Admin → Onboarding.
  4. ✅ **DONE (12th wave)** — `delete_chef` now cascades: clears all 24 user-keyed tables +
     the chef's staff logins, no orphans left.
  5. ✅ **DONE (waves 8–10)** — recorded ElevenLabs voiceover shipped, audio-first engine. Orig: keep the React scene
     engine, replace browser TTS with a **recorded ~70s voiceover MP3** (Ellice's own
     voice, or a one-time ElevenLabs render) put in `frontend/public/`, drive scene
     advance/seek from `audio.currentTime`, keep TTS only as no-file fallback; add
     crossfades/Ken Burns drift + an animated app-UI vignette scene. Awaiting Ellice's
     choice of voice source before building.
  6. When Mise goes live, consider `AI_MODEL=claude-sonnet-4-6` (~5x cheaper than Opus,
     fine for Mise's structured-JSON jobs) — it's just an env var.
  7. ✅ **DONE (18th wave)** — smaller suggestions all cleared: ~~OG/social-preview meta
     tags~~, ~~ICS calendar feed of bookings/tastings~~, ~~CSV export (clients/finance)~~,
     ~~admin SQLite-backup download~~ (18th wave), ~~rate-limit/honeypot the public enquiry
     form~~ ✅ 13th wave, ~~drop `.svg` from ALLOWED_UPLOAD_EXT~~ ✅ 13th wave (also added a
     login + forgot-password brute-force/spam throttle). The 18th wave also added a
     trial-ending reminder email + self-serve plan switching (off Ellice's list).

## Previous session (2026-06-12, sixth wave — offline mobile app (PWA) + Stripe hardening)
- Branch `claude/magical-planck-l54gva` — merge to `main` to deploy.
- **The platform is now an installable mobile app (PWA) that works fully offline.**
  No app store needed: chefs install from the browser (Android/desktop: "Install app";
  iOS: Share → Add to Home Screen — instructions + an Install button live in
  Settings → "Use it as an app"). Architecture (three layers):
  - `frontend/sw.template.js` + a tiny inline Vite plugin (`vite.config.js`) emit
    `dist/sw.js` at build time with the hashed asset list inlined → the app shell
    (JS/CSS/icons/manifest) is precached and the app opens with zero connection.
    The SW **never touches `/api/`**; navigations are network-first (so site updates
    flow to the app over the cloud whenever it's online), `/uploads/` + Google Fonts
    are stale-while-revalidate.
  - `frontend/src/offline.js` — the data layer. IndexedDB `gets` store caches every
    GET response (key = API path incl. query string); `outbox` store queues offline
    mutations and replays them FIFO on reconnect (last write wins). Offline writes
    are applied **optimistically** to the cached lists (generic for all crud_router
    shapes: POST append w/ `tmp-…` id, PATCH/PUT merge, DELETE remove, plus the
    shopping/packing `/toggle` fast paths and `/bookings/{id}/workspace.booking`).
    After a queued create syncs, `adoptRealId` rewrites any queued follow-up edits
    + cached copies from the temp id to the server id. Server-rejected items (4xx)
    are dropped with a red toast; network failures stop the replay until next time.
  - `frontend/src/api.js` — same `api.*` surface for every page, now network-first
    with cache fallback (GET) / queue fallback (mutations). `NO_QUEUE` list = flows
    that genuinely need a connection (auth, billing, AI, admin, onboarding slots,
    founders, uploads, public) — they fail fast with a friendly `.offline` error.
  - UX: amber/copper **offline chip** (App.jsx `OfflineChip`) shows offline state +
    pending count + syncing; on sync a toast fires and `<Outlet key={syncEpoch}>`
    remounts the current page so optimistic copies swap for server records. Logout
    warns if unsynced changes exist and clears IDB (shared devices). Login primes
    the `/auth/me` cache so the installed app can boot offline; an offline boot
    no longer clears the token.
  - Assets: `frontend/public/manifest.json` (start_url `/app`, standalone, brand
    black) + icons generated by `scripts/make_icons.py` (flame mark via Playwright
    screenshot — icons are checked in, rerun only if the brand changes). iOS meta
    tags in `index.html`. **Wrap-in-Capacitor later if Ellice wants store listings.**
- **Stripe integration hardened** (`routers/billing.py`):
  - NEW `/billing/confirm` — success_url now carries `session_id={CHECKOUT_SESSION_ID}`;
    Onboarding.jsx confirms the session server-side on return, so activation works
    instantly **even with no webhook configured** (metadata user check + payment_status).
  - Webhook now also handles `invoice.paid` (renewals recorded as Payment rows,
    reactivates suspended accounts; `subscription_create` invoices skipped — checkout
    already recorded those) and `customer.subscription.updated` (past_due/unpaid →
    suspended, canceled → canceled, active → restores). `_activate` is idempotent on
    `Payment.reference` so webhook + confirm can both fire safely.
  - NEW `/billing/portal` (Stripe customer portal: card/invoices/receipts) — button in
    Settings → Membership when `has_stripe_customer` (added to `/billing/status`).
    NOTE: portal needs one-time activation in Stripe Dashboard → Settings → Billing →
    Customer portal, else the endpoint returns Stripe's error.
  - Cancel with Stripe = `cancel_at_period_end` (keeps access until the paid period
    ends; webhook flips status later). Demo mode (no key) unchanged everywhere.
  - **To go live Ellice sets on Render:** `STRIPE_SECRET_KEY` (sk_live_… or sk_test_…
    first) and `STRIPE_WEBHOOK_SECRET` (whsec_… from Dashboard → Developers →
    Webhooks → Add endpoint `https://<domain>/api/billing/webhook`, events:
    `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
    `customer.subscription.updated`, `customer.subscription.deleted`).
- **Mise**: code verified ready — model `claude-opus-4-8` is current, all endpoints
  degrade gracefully (503 with instructions) without the key. Switching it on is
  purely: Render → Environment → add `ANTHROPIC_API_KEY` → save (auto-redeploys).
  Same moment also lights up admin "Summarise with AI" + the support chat helper.
- Verified: 17/17 Playwright offline e2e (login → SW controls page → **server killed
  + offline emulation** → shell boots, recipes from IDB, offline create + shopping
  toggle, chip counts, reconnect → sync toast → exactly one server record, UI swaps
  temp copy); 17/17 Stripe API tests (webhook lifecycle incl. idempotent replay,
  renewal/failed/recovered/deleted, confirm + portal guards, demo-activate blocked
  when live); demo mode + Settings cards (desktop + 390px) + Mise 503s re-verified.
- Offline limits (by design, v1): no file uploads / AI / payments offline; conflict
  policy is last-write-wins; first offline boot needs one prior online login.
- Addendum (same session, after launch-night setup with Ellice): Home module guide
  gained a 22nd bubble — **Mobile app** (Help & housekeeping, new `mobile` icon in
  ui.jsx, every plan, staff included → counts now 22 owner / 20 staff) explaining
  install + offline + sync, CTA → Settings. Ellice completed the live setup herself:
  merged to main (PR #1), created a **dedicated Stripe account "Creatiste Command"**
  under her Stripe Organisation (separate from the Studios/SimplyBook account — its
  sk_live key + webhook + customer portal all configured per the in-chat walkthrough).
  ANTHROPIC_API_KEY deliberately deferred until first paying chef (cost reasons) —
  Mise stays gracefully disabled meanwhile.

## Previous session (2026-06-12, fifth wave — tier comparison table + portal Home guide)
- Branch `claude/determined-carson-cogamv` — merge to `main` to deploy.
- **Tier comparison table** on the public landing page (`pages/Landing.jsx`,
  `#compare` inside the `#pricing` section): tick/✗ matrix so visitors can compare
  memberships at a glance. 24 rows in 4 groups (Plan & run events / Kitchen &
  shopping / Business & money / Team & the edge); each row is `[benefit, min plan
  level]` in the `COMPARE` const — **levels mirror the real server gating** (1 Solo,
  2 Pro, 3 Elite; quotes/team/Mise=3, clients/tastings/orders/routes/suppliers/
  designs/finance/enquiry=2). Plan names/prices/trial copy stay live from
  `/billing/plans`; only the matrix rows are hardcoded — if Ellice changes what a
  tier includes, update `COMPARE` too. Pro column highlighted + "Most popular";
  tfoot = onboarding fee + Choose CTAs; ticks have `sr-only` Included/Not included;
  mobile h-scrolls (min-w 620px table in overflow wrapper).
- **Portal Home — module guide** (`pages/Home.jsx`, now the `/app` index route):
  21 circular module "bubbles" in 4 groups (Run the operation / In the kitchen /
  Grow the business / Help & housekeeping). Hover (or keyboard focus) = floating
  blurb tooltip; click = guide modal: what it is, "Why it earns its place" (3 ticks),
  "How to use it well" (numbered steps), gold "Chef's tip", plan badge + "Open X"
  CTA that navigates. Plan-locked bubbles (below user's level) show a lock chip,
  dimmed icon, and the modal swaps in an upgrade banner + "See membership options"
  → /app/settings (content still visible = upsell). `ownerOnly` modules
  (Finance/Quotes) hidden from staff, mirroring the sidebar. All copy lives in the
  `GROUPS` const in Home.jsx — edit there to reword any module guide. Stagger
  entrance via `.bubble-in` (index.css). Tooltip is `z-[45]` — above the fixed
  sidebar (z-40, was clipping left-column tooltips), below modals (z-50).
- **Dashboard moved** `/app` → `/app/dashboard` (Home took the index). Sidebar:
  Home (icon `home`) then Dashboard (new `pulse` icon in ui.jsx). Mobile bottom nav
  unchanged (Dashboard/Bookings/Tasks/Shopping) — `mobileMain` indices in App.jsx
  updated for the inserted Home item; Home reachable on mobile via brand-logo tap
  (→ /app) and the More sheet. All existing `navigate('/app')` flows (login,
  onboarding success, founders tour first login) now land on the guide — intended.
- Verified with Playwright (desktop + 390px, dark + light): tick matrix counts
  Solo 9 / Pro 19 / Elite 24 of 24, tfoot CTAs, mobile h-scroll; 21 bubbles for
  elite owner / 10 locks on Solo / 19 bubbles for staff; hover tooltip, modal
  content, CTA navigation, locked modal → settings; bottom nav + More sheet; no
  console errors.

## Previous session (2026-06-12, fourth wave — landing intro film + hook sections)
- **Embedded intro film** on the public landing page (`frontend/src/introfilm.jsx`,
  branch `claude/nice-tesla-az74mn`): a 6-scene, ~70s animated brand film that looks
  and behaves like a video player (poster + play button, segmented click-to-seek
  progress, pause/resume, restart, mute) but is pure React/CSS — no video file to
  host, crisp at any size, always on-brand. **Warm female voiceover** via the
  browser's SpeechSynthesis: `pickVoice()` prefers female en-GB voices (Sonia/Libby/
  Kate/"Google UK English Female"…), rate .95/pitch 1.06; speech text spells the
  brand phonetically ("Cree-ay-teest") so every engine pronounces it right, captions
  show the real spelling and run always (graceful fallback where TTS is missing —
  sound icon dims, scenes advance on timers). Scenes: hook questions ("Have you ever
  been in a position where…"), exact welcome line Ellice specified ("…the
  comprehensive management platform and one-stop shop designed for chefs, caterers
  and all culinary professionals"), feature montage, chaos→"one command centre" gap
  story, CTA end-card → /register. Scene timing waits for BOTH the per-scene timer
  AND utterance end (8s safety cap); pause cancels speech and resume restarts the
  current scene so voice/motion stay in sync; `.if-*` keyframes live in index.css.
- **Landing page additions** (`pages/Landing.jsx`): hero now has "Watch the intro ·
  1 min" → `#film` section (dark, framed); new `#why` section = 4 "Have you ever…?"
  hook cards (each pain → how the platform answers it) + "The gap we fill" panel
  ("You were trained for the pass — not the paperwork"); nav links The intro / Why
  Creatiste / Pricing. New icons in ui.jsx: play/pause/replay/sound/soundOff.
- **GOTCHA — never use Tailwind `text-base` in this repo**: the theme defines a
  *colour* token named `base`, so Tailwind emits BOTH font-size and colour rules for
  `text-base` and the colour (= page background!) wins → invisible text. Existing
  uses survive only because an explicit text-colour class happens to sort later.
  Use `text-[16px]` instead. (Bit the film twice via `sm:`/`md:` variants.)
- Verified with Playwright (desktop + 390px mobile, dark + light themes): poster →
  play → captions/scene visuals per scene, seek via segments, pause/resume, mute
  toggle, end-card CTA → /register, hooks/gap/pricing sections render, no console
  errors. NOTE: headless chromium has no TTS voices — voiceover needs a quick
  listen on a real device after deploy (Chrome/Edge/Mac/iOS all ship female voices).

## Previous session (2026-06-12, third wave — onboarding calls, 5-day trial, badges)
- **Verification-first access**: every new account (founder or standard) must book a
  **video onboarding session** and have Ellice mark it complete before the workspace
  opens. Register → status stays `pending` → /onboarding shows a slot picker (Step 1
  of 2) → booked card with join link → on completion (`Admin → Onboarding`) the user
  gets `users.onboarded_at` and the **5-day free trial** starts right then
  (DEFAULT_TRIAL_DAYS=5; boot migrates old 3→5). Gate enforced server-side in
  `auth._owner_active` + client-side in RequireActive; pre-existing active/trialing
  users are grandfathered at boot (onboarded_at = created_at).
- **Booking system** (`routers/onboarding.py`, `frontend/src/booking.jsx`):
  Mon–Sat 09:00–17:00 slots (**now Mon–Sun 08:00–20:00 — see 12th wave**), 45 min, 14-day horizon, 3h lead, global calendar
  (everyone books Ellice), double-book → 409, rebook replaces, cancel endpoint,
  emails to client + SUPPORT_EMAIL. Video link per session: **Zoom** auto-created
  when ZOOM_ACCOUNT_ID/CLIENT_ID/CLIENT_SECRET set (server-to-server OAuth);
  `MEETING_URL` env = fixed personal room; default = unique **Jitsi Meet** room
  (free, zero setup, works in demo).
- **Admin → Onboarding tab**: Ellice's call calendar (upcoming grouped by date +
  past), session modal with join link, Complete (= verify & start trial)/no-show/
  cancel, notes + pasted transcript, **"Summarise with AI"** → Claude key points
  (summary/key points/action items/feature requests/sentiment) stored on the
  session (`ai_summary`); 503 without ANTHROPIC_API_KEY.
- **Founders day-5 = a call now**: check-in modal leads with a slot picker
  (kind=checkin, founders-only) + the 3 written questions as optional prep;
  booking the call or sending the form clears the nag; booked call shown in
  Settings founders card + admin Founders/Onboarding tabs. days_in counts from
  onboarded_at (trial start).
- **Founders invite page badges**: perks are now structured {icon,title,text}
  badge cards ("Founders only" chips) incl. new **Testimonial spotlight** (logo on
  site + direct link to their business as advertising) + "How joining works"
  4-step (call-first). Old string perks migrate at boot. (Logo-wall on the public
  landing page **built in the 20th wave** — opt-in in Settings → Business, served by
  `GET /api/public/featured`; logos reuse `avatar_url`.)
- **Stripe trial billing**: checkout during trial now passes
  `subscription_data.trial_period_days` = remaining trial days → card taken at
  subscribe, first charge lands when the trial ends (auto-renews after). Demo mode
  unchanged. "No card needed" copy everywhere now says *for the trial*.
- Verified end-to-end (API + Playwright): register→pending→402 w/ booking message,
  book slot, 409 double-book, admin completes → trialing w/ +5d trial & workspace
  200, founder day-5 modal books real check-in call, AI summarize 503s gracefully,
  founders activation still £59/waived.

## Previous session (2026-06-12, second session — Founders Membership)
- Built the **Founders Membership**: a private, invite-only launch programme for the
  platform's first chefs. Developed on `claude/vibrant-newton-jah29i` — merge to
  `main` to deploy.
- How it works (all editable live in **Admin → Founders**):
  - Secret invite link `/founders/<code>` (code auto-generated at bootstrap, stored
    in `platform_settings.founders` JSON). Never linked from public pages; wrong
    code and closed programme both 404 identically. Ellice shares it by hand.
  - Limited **founding seats** (default 10). Full Elite access (`plan="founders"`,
    level 3) at a **lifetime rate** (default £59/mo vs £129 Elite) with the
    onboarding fee **waived** (default £0 vs £399). Normal 3-day trial still applies.
  - Register with `founders_code` → numbered seat (`founder_number`), gold badge in
    sidebar/Settings, founders-only activation card on /onboarding (Stripe checkout
    and demo mode both handle plan `founders`).
  - **Walkthrough onboarding**: 5-step welcome tour on first login (persisted via
    `users.tour_done`); last step sets up the day-5 catch-up expectation.
  - **Day-5 check-in** (`CHECK_IN_AFTER_DAYS=5` in routers/founders.py): modal asks
    Ellice's 3 questions (thoughts / how it benefited / what to change) →
    `founder_feedback` table + email to SUPPORT_EMAIL; snoozable per session,
    reappears until sent.
  - **Direct line**: founders' support tickets get "[Founders direct line #N]" in
    the email subject + a priority note on the Support page.
  - **Admin → Founders tab**: seats/pricing editor, copy/regenerate invite link,
    close/reopen programme (closing kills the link for good; existing founders keep
    their rate + number), member list with days-in and check-in answers (click a
    row to read). ChefModal checkbox can grandfather an existing chef in. Overview
    MRR counts founders at the founders rate.
- New files: `backend/app/routers/founders.py`, `frontend/src/founders.jsx`
  (badge + tour + check-in components), `frontend/src/pages/Founders.jsx` (invite
  page). DB: additive columns on users/platform_settings via `ensure_columns`,
  new `founder_feedback` table via `create_all` — existing DBs migrate on boot.
- Verified end-to-end with Playwright (invite → register → tour → activate →
  backdated day-5 check-in → admin reads feedback → close programme kills link).
- **Pick up here:** wire real Stripe keys + webhook (founders checkout already
  builds the right line items); then SMTP so founder check-ins/support actually
  email Ellice.

## Previous session (2026-06-12)
- Moved the project onto the owner's own GitHub + Claude Code account (the only
  thing that was on someone else's account was the old Claude history — code and
  Render were already the owner's). Nothing to "transfer": every session reads
  this file automatically, so context carries over.
- Created **`main`** as the canonical branch (copy of `claude/vigilant-volta-da1cu9`).
  Owner to do the two one-time dropdown flips — see Deployment below. Verify they're
  done before relying on a push to `main` to deploy.
- No app code changed that session — only branch reorg + notes.

## What this is
**The Creatiste Command** — a subscription SaaS platform for private chefs & caterers,
founded by Ellice Nweje (who also runs the namesake catering business, The Creatiste
Catering). Chefs pay a one-time onboarding fee + monthly subscription; Ellice is the
platform admin. Built end-to-end in Claude Code sessions; this file is the continuity
bridge between sessions.

## Deployment (IMPORTANT)
- Hosted on **Render** (web service, native Python runtime, free tier so far).
- **`main` is now the canonical branch** (created 2026-06-12 from
  `claude/vigilant-volta-da1cu9`, identical at creation). Merge/push finished work
  to `main` so the live site updates.
- One-time owner flips (each ~30s, may still be pending): Render → Settings →
  Build & Deploy → Branch → `main`; GitHub → repo Settings → General → Default
  branch → `main`. If a push to `main` doesn't trigger a deploy, the Render flip
  hasn't happened yet and Render is still watching `claude/vigilant-volta-da1cu9`.
- Build command: `pip install -r backend/requirements.txt && cd frontend && npm install && npm run build`
- Start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Env vars on Render (LIVE as of 22nd wave, 2026-06-19):** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL`,
  `PYTHON_VERSION=3.11.9`, `DATA_DIR=/var/data` (paid Starter instance + 1 GB disk — DB survives deploys),
  `ANTHROPIC_API_KEY` + `AI_MODEL=claude-sonnet-4-6` (Mise on), `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  (live; + webhook + customer portal), `RESEND_API_KEY` + `SMTP_FROM` + `SUPPORT_EMAIL` (email via Resend),
  `CRON_SECRET` (external cron since removed — built-in scheduler covers reminders). **NB no `SECRET_KEY`
  env var is set** — the app uses the auto-generated `DATA_DIR/.secret_key`, now stable on the persistent
  disk (optional hardening: set an explicit `SECRET_KEY`).
  Optional since the 18th wave (all have safe defaults): `CRON_SECRET` (enables the
  external cron hook for reliable day-4 trial reminders), `TRIAL_REMINDER_DAYS_BEFORE`
  (default 1), `SCHEDULER_INTERVAL_HOURS` (6), `ENABLE_SCHEDULER` (1). Backup/recovery
  (22nd-wave amendments, safe defaults): `BACKUP_INTERVAL_DAYS` (7), `BACKUP_EMAIL`
  (defaults to `SUPPORT_EMAIL`), `ENABLE_BACKUP` (1), `RECYCLE_RETENTION_DAYS` (30).
  Phone notifications / Web Push (23rd wave — **off until set**): `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:`; defaults to `SUPPORT_EMAIL`) — generate
  with `python -m app.push --gen`. Tuning (safe defaults): `TASK_REMINDER_LEAD_HOURS` (24),
  `ENABLE_TASK_REMINDERS` (1). Needs the `pywebpush` dependency (now in requirements.txt).

## Email & Domain Infrastructure (IMPORTANT — read before any email work)
> Hard-won constraints for `thecreatistecatering.com` (Ellice supplied these after a
> long investigation). Respect them so future work doesn't redo dead ends.

**Sending app email — do NOT use Microsoft 365 / Exchange SMTP. It cannot work on this
tenant. Use a dedicated transactional email service.**
- **Why M365 SMTP is off-limits here:**
  1. `command@thecreatistecatering.com` is a **shared mailbox** (unlicensed, sign-in
     disabled, shows under `command@NETORGFT20702755.onmicrosoft.com`) → no password,
     so no SMTP credentials.
  2. The tenant is **federated to GoDaddy** (legacy provisioning; tenant id
     `NETORGFT20702755.onmicrosoft.com`) → there is **no Microsoft-side password** to do
     SMTP AUTH with, even for the licensed `enquiries@` account.
  3. Microsoft is **retiring Basic-Auth SMTP** anyway (disabled by default end of 2026,
     OAuth-only after) — password SMTP is a dead end going forward.
  ➡️ A dedicated sending service is the **correct architecture**, not a workaround.
- **Recommended service: Resend** (Brevo / SendGrid / Postmark are fine alternatives).
  - **Send over Resend's HTTP API, NOT SMTP.** Render **blocks outbound SMTP ports** —
    `smtp.resend.com:587` just times out (log: `email to … failed: timed out`). `mailer.py`
    now posts to `https://api.resend.com/emails` over HTTPS (443) when **`RESEND_API_KEY`**
    (the `re_…` key) is set, and falls back to STARTTLS SMTP only when it isn't.
  - ⚠️ **Send a real `User-Agent` header.** Resend's API is behind Cloudflare, which 403s the
    default `Python-urllib/x` UA as a bot (`error code: 1010`). `mailer.py` sets a
    `Mozilla/5.0 (compatible; …)` UA — keep it when touching the mailer.
  - **Required env vars on Render:** `RESEND_API_KEY=re_…`, `SMTP_FROM=The Creatiste Command
    <command@thecreatistecatering.com>` (reused as the API sender), `SUPPORT_EMAIL=command@thecreatistecatering.com`.
    The `SMTP_HOST/USER/PASSWORD/PORT` vars are now redundant (ignored when the API key is set).
  - Store the key as a Render **secret env var** — never hardcode, never a mailbox password.
- **DNS lives at Cloudflare (NOT GoDaddy, NOT Microsoft). Registrar is 123-Reg.**
  - ⚠️ Use the Cloudflare account on nameservers **`jill.ns.cloudflare.com` +
    `quinton.ns.cloudflare.com`**. A *dormant duplicate* Cloudflare account exists on
    `craig.ns.cloudflare.com` + `uma.ns.cloudflare.com` — editing it does NOTHING (cost
    hours). Make ALL changes in the jill+quinton account.
  - ⚠️ **SPF must be a SINGLE `v=spf1` TXT record** — never two. Combine includes. Target
    once a sender is added: `v=spf1 include:spf.protection.outlook.com include:<service-include> -all`.
    Also add the service's **DKIM** records (CNAMEs/TXT they generate). (Resend usually puts
    its SPF/return-path on a `send.` subdomain, so the root SPF may not need editing — follow
    Resend's exact records.)
  - ⚠️ Mail records must be **DNS only (grey cloud)** in Cloudflare, never proxied (orange).
- **Receiving email works today — leave as-is.** `command@` receives via M365 (MX →
  `thecreatistecatering-com.mail.protection.outlook.com`); read/reply by granting the
  licensed `enquiries@` account access to the shared mailbox. The sending service handles
  **outbound app mail only**; inbound still lands in the M365 shared mailbox.
- **Accounts:** `enquiries@…` = licensed user (Exchange Online Essentials), primary admin
  mailbox. `command@…` = shared mailbox (unlicensed), outbound via service / inbound here.
- **Out of scope (separate future project, NOT app work):** "defederating" from GoDaddy to
  take full control of the tenant (forces user password resets + a licensing move). Not
  required for the app to send or receive email.

## Brand (exact spec from Ellice — do not drift)
- Gold `#BFA987`, ivory `#FFFBF5`, true black background. Dark "signature" theme is
  default; light mode toggle in Settings (theme tokens are CSS vars in
  `frontend/src/index.css`; Tailwind maps them in `tailwind.config.js` — `copper`
  is the gold accent token name, kept for history).
- Font: **The Seasons** (Canva premium, not web-licensed) → substituted with
  **Playfair Display**. If Ellice buys the web licence, embed the real file.
- Wordmark: "THE CREATISTE" gold caps + "command" lowercase italic ivory, letters
  justified to the same width (see `Brand` in `frontend/src/ui.jsx`).

## Architecture map
- `backend/` FastAPI + SQLite (SQLAlchemy). One process also serves the built SPA.
  - `app/utils.py` — `crud_router` factory: workspace-scoped CRUD + activity audit
    log + plan gating (`min_plan`). **Workspace scoping**: staff users act on their
    owner's data via `ws_id(user)` — never use `user.id` directly in queries.
  - `app/auth.py` — roles: admin (platform owner) / chef (business owner) / staff
    (has `owner_id`). `require_active` (402 paywall, trial-aware), `require_owner`,
    `require_plan(1|2|3)` (Solo/Pro/Elite tier gates — enforced server-side).
  - Routers: core (recipes/inventory/shopping/packing/tasks/routes/appointments/
    suppliers/designs/ideas/clients), bookings (+`/workspace` aggregate), finance
    (owner-only, Pro+), quotes (owner-only, Elite, public approval links), team
    (staff CRUD, shifts, assignments, activity trail — Elite), public (no-auth
    quote + enquiry endpoints), ai (Mise; model `claude-opus-4-8`), support
    (tickets → Admin tab + SUPPORT_EMAIL), billing (Stripe or demo mode), admin.
  - `database.ensure_columns()` = additive migration for new columns; new tables
    come from `create_all`. Seed: `python -m app.seed` (idempotent, adds v2 extras).
- `frontend/` React 18 + Vite + Tailwind. `src/ui.jsx` is the design system
  (icons, Brand, Button/Card/Modal/Badge/toast). `src/App.jsx` has grouped nav with
  plan locks + staff filtering + trial banner. Public routes: `/q/:token` (quote
  approval), `/enquire/:token` (enquiry form).

## Business model (current state)
- 3-day **no-card free trial** by default (`DEFAULT_TRIAL_DAYS`, editable in
  Admin → Pricing) → then onboarding fee + first month together at activation.
- Tiers: Solo Chef £39/mo+£99, Pro Caterer £69/mo+£199, Elite Kitchen £129/mo+£399
  (all editable live in Admin → Pricing). Quotes/Team/Mise are Elite; clients/
  tastings/orders/routes/designs/suppliers/enquiry/finance are Pro+.
- **Founders Membership** (launch only): invite-only via secret link in Admin →
  Founders; limited seats; full Elite access at a lifetime rate (£59/mo, onboarding
  waived by default). Walkthrough on first login + day-5 feedback check-in. Closing
  the programme removes it permanently; founders keep their rate. See latest
  session notes above for the full mechanics.

## Logins (local/demo; live DB resets on deploy and reseeds nothing automatically —
## bootstrap creates only admin; run seed manually if demo data wanted)
- Platform admin: env `ADMIN_EMAIL`/`ADMIN_PASSWORD` (defaults in config.py).
- Seeded demo: chef@demo.kitchen / demo12345 (Elite), staff@demo.kitchen / demo12345.

## Verification pattern used in every session
Playwright (sync) against `http://127.0.0.1:8000` with the system chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (newer downloads are blocked).
Boot: venv at `backend/.venv`; `setsid nohup .venv/bin/uvicorn app.main:app --host
0.0.0.0 --port 8000 ... & disown`; kill via `fuser -k 8000/tcp` (NOT pkill -f —
it matches the calling shell and kills it).

## Gotchas learned the hard way
- **JSON columns**: never mutate the loaded list/dict in place — SQLAlchemy won't
  detect it and silently won't save. Build new objects and/or `flag_modified`
  (see shopping/packing toggle endpoints in `routers/core.py`).
- Google Fonts are blocked in the dev sandbox (cert errors in console = harmless).
- Render free tier sleeps + wipes SQLite on each deploy; upsell the disk before
  real customers.

## Likely next steps (Ellice's roadmap)
- ✅ Done: Stripe live keys + webhook (6th wave), **email** (Resend HTTP API, 11th wave),
  `SUPPORT_EMAIL` → `command@thecreatistecatering.com`, `main` as the canonical branch,
  onboarding **Europe/London + block-out** and **delete_chef cascade** (12th wave),
  **security hardening** — `.svg` upload drop, enquiry honeypot + rate-limit, login &
  forgot-password throttles (13th wave), **OG/social tags, ICS calendar feed, CSV export,
  admin DB-backup download, trial-ending reminder email, self-serve plan switching** (18th wave).
- ✅ **Item 6 DONE (22nd wave):** `AI_MODEL=claude-sonnet-4-6` set when Mise went live. (Pricing note: vs
  Opus 4.8's current $5/$25 it's ~40% cheaper — not the old "5×", which predated Opus 4.8's pricing.) The
  rest of item 7 is done (18th wave).
- **The big one down the road (Ellice's list):** deposits / client payments via **Stripe
  Connect** — the platform's natural next revenue layer (let chefs take deposits, take a cut).
- ✅ **Mise is ON (22nd wave):** `ANTHROPIC_API_KEY` set + `AI_MODEL=claude-sonnet-4-6` — live for Elite + admin summarise + support chat.
- ✅ **Persistent disk DONE (22nd wave):** `DATA_DIR=/var/data` on a paid Starter instance + 1 GB disk, always-on, DB survives deploys (verified via Render Shell). The free-tier wipe/sleep is gone for good.
- Custom app domain (currently on `creatistecommand.onrender.com`) — update the OG URLs in
  `frontend/index.html` when it changes.
- ✅ Plan switching from the chef dashboard — **DONE (18th wave)**, Settings → Membership.
