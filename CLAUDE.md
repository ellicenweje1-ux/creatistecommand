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

1. 🔲 **"Keep me logged in" / stay signed in.** Today: JWT in `localStorage` (`cc_token`),
   `TOKEN_TTL_DAYS=7` — sessions already persist ~7 days, then 401 → `/login`. The likely real
   cause of surprise logouts is the **free-tier SQLite wipe on every deploy** (user row vanishes →
   `get_current_user` 401 "User no longer exists" → `api.js` clears the token). Plan: add the
   persistent disk (infra — see #2) AND optionally lengthen the TTL + add sliding refresh and/or a
   "Remember me" choice on login.
2. ❓ **"How do my updates affect live users in real time?"** — answered in chat. Merge→`main`→
   Render redeploys (~1–3 min build; brief blip on the free tier's single instance); existing
   logins survive a deploy (token is client-side, `SECRET_KEY` is a stable env var); a user with the
   app already open keeps the old frontend until they reload/navigate (SW is network-first, so a
   reload picks up the new build); `ensure_columns` migrations are additive and auto-run at boot.
   **URGENT caveat: on the free tier every deploy/restart WIPES the SQLite DB** — all chef data gone,
   only the admin recreated. So right now a deploy = total data loss for any live chef. **Add
   `DATA_DIR=/var/data` + a paid persistent disk on Render before any real chef signs up.** (Also
   the true fix for #1's logouts.)
3. 🔲 **Keep the FAQs page continuously up to date (standing instruction).** FAQ copy lives in the
   `FAQS` array in `frontend/src/pages/Support.jsx` (plus a few Q&As on Landing/Home). Whenever a
   feature ships or changes, update the FAQs to match — treat it as part of "done" from now on.
4. ✅ **Support feature — confirmed working (Ellice, 2026-06-16).** The Support page (`/app/support`)
   posts `/support/request` → creates a SupportTicket (Admin → Support) + emails `SUPPORT_EMAIL`
   (`command@thecreatistecatering.com` via Resend), and Ellice confirms this works. Only the **"Ask
   Mise" AI chat** is still off (needs `ANTHROPIC_API_KEY` → 503 → falls back to the form); she'll
   set the AI key up later. So: support = live; Mise chat = deferred with the rest of the AI rollout.
5. ✅ **Split Settings into individual pages — DONE (14th wave).** `/app/settings` is now a layout
   with a sub-nav (Profile · Security · Appearance · Membership · App & integrations); each section
   is its own route/page. Details in the fourteenth-wave notes below.
6. ✅ **Bookings pending/open-enquiries pipeline — DONE (14th wave).** New "Pipeline" view on
   Bookings: a 4-stage lead board (enquiry→quoted→confirmed→in_prep) showing the client's rough
   details on each card, with quick edit + one-tap advance. Details in the fourteenth-wave notes.

**Sequencing:** 5 & 6 built (14th wave); 4 confirmed working (only the Mise AI chat is deferred);
3 is a standing rule; 1 awaits the persistent-disk infra step (#2); 2 is answered.

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
  7. Smaller suggestions: OG/social-preview meta tags (index.html has none — bio links
     share with no card), ICS calendar feed of bookings/tastings, CSV export (clients/
     finance), admin SQLite-backup download, ~~rate-limit/honeypot the public enquiry
     form~~ ✅ 13th wave, ~~drop `.svg` from ALLOWED_UPLOAD_EXT~~ ✅ 13th wave (also added a
     login + forgot-password brute-force/spam throttle).

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
  landing page not built yet — perk is promised, collect logos via avatar_url
  later.)
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
- Env vars on Render: `SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL`,
  `PYTHON_VERSION=3.11.9`. Not yet set: `ANTHROPIC_API_KEY` (enables Mise),
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (real payments; demo mode without),
  `SMTP_*` (email notifications), `SUPPORT_EMAIL` (support inbox — Ellice will
  point this at her own domain later), `DATA_DIR=/var/data` (only after adding a
  paid persistent disk — **free tier wipes the SQLite DB on every deploy/restart**).

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
  forgot-password throttles (13th wave).
- **NEXT ON THE LIST** (7th-wave review, above): **6** — when Mise goes live, set
  `AI_MODEL=claude-sonnet-4-6` (~5x cheaper than Opus, fine for Mise's structured-JSON jobs;
  just an env var). Then the **rest of 7** (OG/social meta tags, ICS calendar feed, CSV export,
  admin SQLite-backup download — the enquiry honeypot/rate-limit + `.svg` drop are now done).
- **Still pending `ANTHROPIC_API_KEY`** to switch on Mise (deferred until the first paying chef).
- **Add a persistent disk** (`DATA_DIR=/var/data`) before real chefs — the free tier wipes the
  SQLite DB on every deploy/restart.
- Custom app domain (currently on `creatistecommand.onrender.com`).
- Plan switching from the chef dashboard (currently via admin/support).
