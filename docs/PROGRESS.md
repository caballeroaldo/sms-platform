# SMS Platform - Progress & Roadmap

> This document tracks completed work and remaining tasks for the SMS Automation Platform.

## Project Overview

A full-stack SMS automation platform for a small business serving ~200 clients. Built to support:
- Appointment reminders
- Birthday texts
- Holiday texts
- Promotional campaigns
- Delivery tracking
- Reply handling
- Opt-out compliance

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, TanStack Query |
| Backend | Node.js, Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| SMS Provider | Twilio |
| Queue/Scheduling | Redis + BullMQ |

---

## Completed Work

### Authentication & Security
- [x] JWT-based authentication with 7-day expiration
- [x] Login/Register pages with form validation
- [x] Protected routes with AuthContext
- [x] Token storage in localStorage
- [x] Auth middleware on backend endpoints
- [x] Fixed JWT expiration bug (was 7 seconds, now 7 days)

### Client Management
- [x] Clients list page with search and filtering
- [x] Client detail/conversation page
- [x] View message history per client
- [x] Send messages to clients
- [x] Mock data removed - now uses real API data
- [x] Proper error display when API fails
- [x] Header styling updated (description under title, compact button)
- [x] Backend search API with debouncing (300ms delay on typing)
- [x] **Add Client** - Modal form with validation (firstName, phone required)
- [x] **Edit Client** - Pre-populated form with update functionality
- [x] **Delete Client** - Confirmation dialog with soft-delete (opt-out)
- [x] **CSV Import** (`POST /clients/import`) — bulk-import the periodic tax-season
  client-list report. Parser (`utils/csv.ts`) strips the envelope (title / "As of" /
  Totals) by content, maps columns by name (not position), and classifies rows.
  Route is idempotent on phone: new → create, known → refresh *only* the tax-season
  fields (taxFiledDate, taxReturnType, taxpayerStatus, inactive, clientLY, clientNew);
  identity (name/phone/email/birthday/notes) and the legal `optedOut` flag are never
  overwritten by an import. Skipped/invalid rows surfaced with reasons. Frontend
  "Import CSV" button (hidden file input, `file.text()` → raw CSV body) with a result
  banner. **Verified at runtime (mock Twilio, 2026-08-01)** — see Recent Fixes.

### Templates
- [x] Templates list page
- [x] Category filtering
- [x] Mock data removed - now uses real API data
- [x] Variable support display
- [x] Proper error display
- [x] Header styling updated (description under title, compact button)

### Campaigns
- [x] Campaigns list page with status filtering
- [x] Mock data removed - now uses real API data
- [x] Stats display (delivered, sent, failed)
- [x] Schedule time display
- [x] Recurrence display
- [x] Header styling updated (description under title, compact button)

### Messages
- [x] Messages list page
- [x] Compose modal for sending messages
- [x] Status filtering
- [x] Mock data removed - now uses real API data
- [x] Real-time message count per recipient
- [x] Header styling updated (description under title, compact button)
- [x] Backend search by client name with debouncing (300ms delay)
- [x] Direction filter (inbound/outbound) with API support
- [x] **Conversation inbox (split-pane)** — desktop inbox at `/messages` (left column lists all client conversations, with-message first by most-recent message desc then zero-message by `createdAt` desc; right pane shows the selected client's thread). Backed by new `GET /messages/conversations` + fixed `GET /messages/client/:id` (inbound rows now shape-consistent). Legacy `/clients/[id]/conversation` reuses the shared `<ConversationThread>`. See Recent Fixes #24.

### Dashboard
- [x] Stats overview (clients, messages, campaigns, templates)
- [x] Recent messages section (now with real data)
- [x] Active campaigns section (now with real data)
- [x] Delivery performance charts
- [x] Quick action links

### Backend API
- [x] RESTful API endpoints for all resources
- [x] Prisma ORM integration
- [x] Database seeding with test data
- [x] Fixed messages filtering (clientId not being applied)
- [x] TypeScript compilation fixes

### Messaging & SMS Infrastructure
- [x] Twilio client (`services/twilio.ts`) — real `sendSMS` against Twilio Programmable Messaging with mock fallback when credentials absent
- [x] Redis + BullMQ worker (`workers/messageWorker.ts`) — `bullmq@5.x` + `ioredis@5.x`, `message-queue` defined, retries configured
- [x] Inbound message webhook route (`routes/webhooks.ts`) — stores inbound replies, fires status callbacks
- [x] Twilio webhook signature validation — `validateTwilioSignature` rejects unknown senders with HTTP 403
- [x] STOP / UNSUBSCRIBE / STOPALL keyword handling — flips `optedOut: true`, writes an audit row
- [x] HELP / INFO keyword handling — auto-replies with support info
- [x] START / UNSTOP / YES re-subscribe handling — restores `optedOut: false`

### Bug Fixes
- [x] Fixed JWT expiresIn parsing (was using parseInt on "7d" string) — **runtime fixed.** The matching `typescript@jsonwebtoken@9` overload errors in `backend/src/routes/auth.ts` (4× `jwt.sign(...,{ expiresIn: config.jwtExpiresIn })` call sites) are **also fixed (2026-08-03, Recent Fixes #21)** by typing `Config.jwtExpiresIn` as `ms.StringValue`.
- [x] Fixed messages GET endpoint ignoring clientId filter
- [x] Fixed messages/client/:id endpoint TypeScript errors
- [x] Removed all mock data fallbacks in frontend pages
- [x] Added cache invalidation when switching between clients

---

## Remaining Tasks

### High Priority
- [x] ~~**Clients Page - Add Client Button**: Implement modal/form to create a new client (name, phone, email, notes)~~
- [x] ~~**Clients Page - Edit Client Button**: Implement edit modal to update client details~~
- [x] ~~**Clients Page - Delete Client Button**: Implement delete functionality with confirmation dialog~~
- [x] **Templates Page - New Template Button**: Modal/form wired; backend `/templates POST` already in place.
- [x] **Templates Page - Edit Template Button**: Modal re-uses `TemplateForm` pre-populated with the template; backend `/templates/:id PUT` already in place.
- [x] **Templates Page - Preview Button**: Modal renders template content with `{{var}}` placeholders shown as human-readable labels (`firstName` → `First Name`); also lists "Variables referenced" footer.
- [x] **Campaigns Page - New Campaign Button**: Modal/form wires up campaigns CRUD against `POST /campaigns`. Form has name + description, template picker, schedule time, recurrence, and an Audience section (ALL / Previous tax year active / Manual selection).
- [x] **Campaigns Page - Edit Campaign Button**: Edit modal re-uses `CampaignForm` pre-populated. Status-gated: editing disabled on RUNNING/COMPLETED per backend rule ("Cannot update a running or completed campaign").

### Medium Priority

**Messaging production-readiness (must be settled BEFORE enabling real Twilio sending):**

- [ ] **Number type & carrier compliance (US-only)** — Recommend **toll-free** ($2.15/mo) for the first production number. Avoids 10DLC brand/campaign registration (~$4+ per campaign, days-to-weeks of carrier review) and avoids short-code's $1k+/qtr. Reconsider only if expected throughput exceeds ~1 SMS/client/day, at which point a 10DLC long code is cheaper per-message. **Owner**: deployment.
- [ ] **Production Twilio credentials & env config** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`), `REDIS_URL`. Currently the app falls back to mock mode if any are absent. Wire `.env.example` documentation and the production secret-management story below in DevOps before turning the live switch on.
- [ ] **MMS support** *(depends on number type above)* — Stack-rank rationale below in `## Stack-Rank Notes`.
  - Backend: extend `Message` model with `mediaUrls: String[]`; add `mediaUrl[]` to Twilio `messages.create()` payload in `services/twilio.ts`.
  - Inbound: parse `NumMedia`, `MediaUrl0..9` in `routes/webhooks.ts`; **download each URL with HTTP Basic Auth and re-host** on our own storage (local disk acceptable to start; S3-compatible bucket recommended before host migration). Twilio-hosted URLs don't auto-expire but are auth-gated — they can never be embedded in a browser `<img>` directly.
  - Frontend: `MediaPicker` in the compose modal; render thumbnails in the conversation view.
  - Pruning: TTL or LRU on stored media to keep storage bounded.

**Worker + automation wiring:**

- [x] **Campaign dispatch wiring (true scheduling + immediate-send fix)** — **Done (2026-08-01), see Recent Fixes #17.** `POST /campaigns/:id/send` in [backend/src/routes/campaigns.ts](backend/src/routes/campaigns.ts) now enqueues directly to BullMQ via the existing `queueMessage()` helper instead of leaning on the 60s poller. It uses `createManyAndReturn` to create `QUEUED` (not `PENDING`) messages with `scheduledAt = campaign.scheduleTime ?? null`, then enqueues each — `scheduledFor = campaign.scheduleTime` for scheduled campaigns (native BullMQ `delay`, true delayed delivery, no jitter) and no `scheduledFor` for immediate sends. Two bugs fixed:
  1. **Immediate-send NULL-exclusion (confirmed at runtime)** — the route stamps `scheduledAt: null` for unscheduled (DRAFT) campaigns, and the poller's `where: { status: 'PENDING', scheduledAt: { lte: now } }` excluded `NULL` (`NULL ≤ value` is false in SQL). Poller WHERE patched to `OR: [{ scheduledAt: { lte: now } }, { scheduledAt: null }]` as a safety net; the route enqueues directly so it doesn't depend on the poller. Reproduced before the fix (null row missed, past-`scheduledAt` control picked up), verified after (message `QUEUED` → `SENT`).
  2. **BullMQ Queue/Worker namespace mismatch (deeper bug, found while wiring the worker)** — the worker was constructed with first arg `'message-worker'` while the `Queue` produces to `'message-queue'`. A BullMQ `Worker`'s first arg is the **queue name to consume** (it `extends QueueBase`, keys under `bull:<name>:*`), so the worker listened on an empty `bull:message-worker:*` namespace and **never processed a single job since it was written** — which is why the worker module had never been imported by `src/index.ts`. Both now share `QUEUE_NAME = 'message-queue'`; `WORKER_NAME` removed.
  Worker + poller are now imported by `src/index.ts` via `import './workers/index.js'`. `resolveAudienceClientIds()` widened to return `phone` so the route can enqueue without re-querying. **Requires Redis** (`brew install redis && brew services start redis`; the stock `/opt/homebrew/etc/redis.conf` had four broken `loadmodule` directives pointing at missing modules that aborted every launch — commented out). Twilio stays mock unless real creds are set, so dispatch is safe to test locally without live SMS. **Both paths verified at runtime (mock Twilio):** the immediate-send path (message `QUEUED` with null `scheduled_at` → drained from `wait` → `SENT`) and the scheduled-send path (message `QUEUED` with a future `scheduled_at` → held in `bull:message-queue:delayed` → fired on cue at `scheduleTime` → `SENT`); see Recent Fixes #17 for the scheduled test.
- [ ] Campaign automation (birthday, recurring) — Recurrence rules (`daily`, `weekly`, `monthly`, `cron`) + a scheduler that enqueues per-window campaign runs. Not yet scoped.

**UI polish — form readability:**

- [x] **Match form-input text + placeholder styling to the Messages-page search input** — Field inputs in modal forms inherit body color for their filled value and render the UA-default light gray for the placeholder — both too low-contrast against the modal's white surface. The platform's canonical reference is the Messages-page search input at [frontend/app/messages/page.tsx:95](frontend/app/messages/page.tsx#L95), which uses `text-slate-700 placeholder:text-slate-400 border border-slate-300 …`. The Clients-page search follows the same pattern at [frontend/app/clients/page.tsx:167](frontend/app/clients/page.tsx#L167), but modal forms drift from this convention (no `text-*` or `placeholder:*` token on their `<input>`/`<textarea>`/`<select>`).
  - Affected: [`ClientForm.tsx`](frontend/lib/components/ClientForm.tsx) (5 inputs + textarea, ~lines 108 / 129 / 145 / 166 / 187 / 202), [`TemplateForm.tsx`](frontend/lib/components/TemplateForm.tsx) (input + select + textarea, ~lines 101 / 123 / 143), [`CampaignForm.tsx`](frontend/lib/components/campaigns/CampaignForm.tsx) (3 inputs + textarea + 2 selects + 3 audience radios, ~lines 210 / 231 / 253 / 279 / 298 / 329), [`ClientPicker.tsx`](frontend/lib/components/campaigns/ClientPicker.tsx) (search input + checkbox + checked-row label inputs, ~lines 88 / 118).
  - Recommended fix: append `text-slate-700 placeholder:text-slate-400` to every `<input>` / `<textarea>` / `<select>` className, matching the Messages-page pattern. Preserve each form's existing focus-ring accent (cyan for the create/edit-client + create/edit-campaign forms, blue for templates + send-campaign + client-picker) — those are intentional and match the surrounding CTAs.
  - **Done (2026-07-28):** Applied across all four files (ClientForm 6, TemplateForm 3, CampaignForm 6 incl. audience radio, ClientPicker 2 incl. results checkbox). Per explicit user direction the radio (CampaignForm) + checkbox (ClientPicker) checked-accent was swapped `text-blue-600` → `text-slate-700`, each with its blue `focus:ring-*` preserved, so every control carries a single deterministic `text-*` token. Broader app-wide sweep tracked under Lower Priority. See Recent Fixes #16.
  - Out of scope: dark-mode tokens (the app is dark-bg / widget-white today; treat as future work if a theme switcher is added).

**UI — mobile responsiveness + conversation inbox:**

- [ ] **Mobile version of the site** — The app is desktop-only today. The global nav ([frontend/lib/components/Navigation.tsx](frontend/lib/components/Navigation.tsx)) lays out five links + logo + auth chrome in a single `flex space-x-1` row (`max-w-7xl`, only `sm:`/`lg:` padding breakpoints, **no hamburger / collapse**), so on a phone the row cramps and overflows horizontally. Each list page (clients/templates/campaigns/messages/dashboard), the four modal forms (`ClientForm`, `TemplateForm`, `CampaignForm`, `ClientPicker`), and the Send/Preview modals need responsive breakpoints: stacked toolbar+search, horizontally-scrolling or stacked cards, full-width modals on narrow screens. Touch targets ≥44px; the viewport meta is already set by the Next root layout. **Cross-cut with the inbox redesign below:** the two-pane inbox is a desktop-first layout and MUST collapse to a stacked master→detail on mobile (tap a conversation → push the active thread into view; back returns to the list) — the inbox's mobile fallback is in scope for this sweep, not a separate follow-up.
- [x] **Conversation inbox (split-pane)** — **Done (2026-08-11), see Recent Fixes #24.** Originally spec'd as: replace the single-client-per-route chat with an inbox view: **left column** = all client conversations ordered by most-recent message (avatar initials, name, last-message preview + timestamp, opted-out affordance), **right side** = the selected client's thread. The thread UI already exists at [frontend/app/clients/[id]/conversation/page.tsx](frontend/app/clients/[id]/conversation/page.tsx) (date-grouped bubbles, per-message status glyphs, composer, opt-out notice) and can be lifted into the right pane. The global site header ([Navigation](frontend/lib/components/Navigation.tsx), rendered by the root layout) must stay present and clickable across the top — **the five page nav buttons (Dashboard, Clients, Campaigns, Templates, Messages) must remain navigable from the conversation view, exactly like every other page** (the current conversation route already inherits them from the root layout). The inbox should fill viewport height beneath the 64px nav (the current conversation page already does `h-[calc(100vh-64px)]`), not go full-bleed. **Backend gap:** there is no "conversations ordered by most-recent message" endpoint today — `GET /messages` ([backend/src/routes/messages.ts](backend/src/routes/messages.ts)) returns a flat, filterable message log (by client/name/status/direction), and `GET /clients` returns clients with no last-message timestamp. The left column needs a new aggregate query — e.g. `GET /conversations` returning per-client `{ clientId, firstName, lastName, phone, lastMessage: { content, status, createdAt }, unreadCount? }` ordered by `messages.createdAt desc`, or a `lastMessageAt` join added to the clients query. **Open build-time decisions:** (a) where the inbox lives — a new `/conversations` (or `/inbox`) route vs. reworking the existing `/messages` page into a threaded inbox (today `/messages` is a flat message log, not a threaded view); (b) whether `/clients/[id]/conversation` survives as a deep-link that opens the inbox pre-selected on a client, or is removed. Recommended: dedicated inbox route + keep the conversation deep-link as an entry point.
- [x] **Refocus the Clients page on client information (view/edit)** — **Done (2026-08-12), see Recent Fixes #25.** The Clients page no longer overlaps the Messages inbox: the "Messages" column (outbound count) and "View Chat" link to `/clients/[id]/conversation` are gone; the per-row chat affordance is now a "Message" button → `/messages?client=<id>` (opens that client's thread in the inbox).

### Lower Priority
- [ ] **Form-input styling consistency sweep beyond the 4 modal forms** — Other white-surface text inputs not covered by the Medium-Priority fix above should get the same `text-slate-700 placeholder:text-slate-400` + matching focus-ring treatment so the convention holds app-wide. Candidates to audit: login form inputs ([frontend/app/login/page.tsx](frontend/app/login/page.tsx)), the Messages compose modal ([frontend/app/messages/page.tsx](frontend/app/messages/page.tsx) compose section + any shared compose component), the Send Campaign modal ([frontend/lib/components/campaigns/SendCampaignModal.tsx](frontend/lib/components/campaigns/SendCampaignModal.tsx) confirmation checkbox), the AuthContext or any settings/audit-log pages once built, and the search inputs on remaining list-page headers (templates / campaigns / messages) for parity with the Messages + Clients search inputs. Carry-forward rule: a control's checked-accent should match its filled-text token (`text-slate-700` for inputs/checkboxes/radios) unless a colored accent is intentionally called for by the surrounding CTA.
- [x] **Fix `jsonwebtoken@9` overload errors in [backend/src/routes/auth.ts](backend/src/routes/auth.ts)** — **Done (2026-08-03, Recent Fixes #21).** Narrowed `Config.jwtExpiresIn` from `string` to `ms.StringValue` (+ a type-only `import { StringValue } from 'ms'` and an `as StringValue` cast at the assignment) in [backend/src/config/index.ts](backend/src/config/index.ts). All 4 call sites now typecheck unchanged (`tsc --noEmit`: auth.ts TS2769 ×4 → 0). The env value `"604800"` (and `"7d"`/`"1h"`) stay valid. This unmasked 2 pre-existing latent `database.ts` declaration-emit errors — now also fixed (Recent Fixes #22).
- [ ] **Route `POST /messages/send-now` through the BullMQ worker (dispatch-path consistency)** — Currently this route calls `sendSMS()` **inline within the HTTP request** at [backend/src/routes/messages.ts:57](backend/src/routes/messages.ts#L57), bypassing the queue/worker entirely. The project actually has **three** message-dispatch paths, only two of which use the worker:

  | route | dispatch mechanism | worker? |
  |---|---|---|
  | `POST /messages/send-now` | inline `sendSMS()` in the request handler | **No** |
  | `POST /messages/schedule` | writes a `PENDING` + future `scheduledAt` row; the 60s poller (`processScheduledMessages`) sweeps and enqueues it | Yes, via poller → `queueMessage` |
  | `POST /campaigns/:id/send` | enqueues directly to BullMQ as `QUEUED` (the path fixed + runtime-verified in Recent Fixes #17) | Yes, directly |

  The inline `send-now` path loses every benefit the worker exists to provide: **no automatic retry** (a thrown error surfaces as a plain per-recipient error in the response, message effectively lost), **no rate limiting** (a large `clientIds` array calls Twilio as fast as the loop resolves — could exceed per-number throughput and trip carrier throttling), **no durability** (a crash mid-loop loses the unsent remainder), and **no decoupling** (the HTTP request blocks until every Twilio call finishes). The campaign path was specifically refactored to avoid exactly this — see [Recent Fixes #17](#recent-fixes-chronological).

  **Recommended fix:** make `send-now` create the `Message` row(s) as `QUEUED` (not `PENDING`) with `scheduledAt: null`, then call the existing `queueMessage()` helper from [backend/src/workers/messageWorker.ts](backend/src/workers/messageWorker.ts) with `scheduledFor = undefined` — the same pattern the campaign send route uses (Immediate-send path verified in #17). This unifies all three paths on the worker for immediate sends and deletes the inline `sendSMS` call from the route; the poller continues to own the `POST /messages/schedule` path. Optionally keep an inline fast-path only for the single-recipient case if latency matters, but simplest + safest is to always enqueue. **Not blocking** today — `send-now` works and stays mock unless real Twilio creds are set — but it should be unified before live SMS is enabled so the worker's rate limiting protects real carrier throughput. Discovered while explaining the Redis/BullMQ architecture (2026-08-01).
- [ ] CSV import for clients
- [ ] Bulk message sending
- [ ] Template variable preview
- [ ] Export message history
- [ ] User settings page
- [ ] Audit logs viewer

### Testing
- [ ] Backend unit tests
- [ ] Backend integration tests — **in progress (2026-08-02; see Recent Fixes #19, #23).** Harness is live: Vitest 4 + supertest, `backend/vitest.config.ts` (node env, 20s timeouts), `backend/tests/setup.ts` (`authHeader()` mints a seeded-admin Bearer; `app` is imported from the extracted app factory `src/app.ts` so tests drive routes via supertest without spawning the BullMQ worker or binding a port). Six green, self-cleaning suites (each `afterAll` removes every row the suite touched; dev DB left spotless, 0 orphans verified across all five phone blocks + the campaign name sentinel):
  - `backend/tests/clients.import.test.ts` (5) — `POST /clients/import`: create-new + skipped + asOf; idempotent re-import; tax-field refresh preserves identity (direct DB); 400 empty; 401 unauth.
  - `backend/tests/clients.crud.test.ts` (10) — `PUT`/`DELETE /clients/:id`: identity/notes update + tax-field-preservation (direct DB); 404; phone-change E.164 normalization; reserved NPA `555`→400; phone owned by another→409; soft opt-out (row survives) + 200; 400 already-opted-out; 401 unauth.
  - `backend/tests/clients.count.test.ts` (8) — `GET /clients/count`: ALL + PREVYear parity vs `buildAudienceWhere` (bracketed so concurrent import/CRUD suites can't flake); prefix-scoped predicate matrix (ALL=3 opted-in fixtures, opted-out excluded; PREV_YEAR_ACTIVE=1, excludes wrong-year + NULL-taxFiledDate + opted-out-despite-filing); MANUAL→400; invalid audience→400; default→ALL; 401 unauth. **Phone block `+1212999`** (NPA 212), disjoint from import (+1408) and CRUD (+1415).
  - `backend/tests/clients.create.test.ts` (8 passing) — `POST /clients`: happy-path 201 + bare-10-digit→E.164 normalize + clean tax-field defaults via direct DB (all null/false so a later import's "new → create" isn't polluted); missing `firstName`/`phone`→400 with no row; invalid format (NPA 555)→400 no row; duplicate-active→409 one row; duplicate-opted-out→409 (soft-deleted phones aren't reusable via POST — locks that contract); optional-fields persist + `optedOut=false` + **date-only `YYYY-MM-DD` birthday accepted** (regression test for the `db.create` coercion fix — see Recent Fixes #20); 401 unauth. **Phone block `+1312999`** (NPA 312).
  - `backend/tests/campaigns.create.test.ts` (9 passing) — `POST /campaigns`: minimal 201 + clean defaults (audience ALL, status DRAFT, `manualRecipientIds:[]`, recurrence NONE, `templateId:null`, direct DB); future `scheduleTime`→status SCHEDULED; MANUAL+ids persisted (create doesn't validate id existence); non-MANUAL with junk ids→route forces `[]` (HTTP + DB); missing name→400 no row; past scheduleTime→400 no row; MANUAL with ids omitted→400 no row; MANUAL with `[]`→400 no row; 401 unauth. **Isolation:** NAME sentinel `__campaignsTest__` (campaigns use CUID ids, no phone analog — won't collide with seed "Summer Welcome Series"/"July Promo"/"Birthday Messages"); `afterAll` deletes messages-via-campaign-name filter + `campaign_created` audit rows by `details::text LIKE '%<id>%'` (double-encoded jsonb string, see #18) + campaigns by name. ✅ **No client fixtures, no enqueue, no Twilio — safe in real mode.** See Recent Fixes #23.
  - `backend/tests/conversations.test.ts` (7) — `GET /messages/conversations`: 401 unauth; authed 200 (guards route ordering — `GET /:id` would shadow `/conversations` into a 404 if placed after it); outbound recency ordering (newer B before older A, `direction` outbound); inbound reply beats older outbound (`direction` inbound, `content` from `body`, `inboundCount` 1); zero-message clients after all with-message (`lastMessage` null); pagination across the with/zero boundary (3 with + 3 zero, `limit=2` → p1=2 with, p2=1 with+1 zero, p3=2 zero, `total=6` `pages=3`); substring `?search=` returns only matches. **Isolation:** disjoint phone block `+1503999` (NPA 503 — a real area code, not reserved `555` which the normalizer rejects); each test bakes a unique `Zcb<label>` token into `lastName` + requests `?search=<token>` to scope the route's "list all clients" semantics to exactly that test's fixtures; explicit timestamps for deterministic ordering; `afterAll` `deleteMany({phone:{startsWith:PREFIX}})` (cascade sweeps Message + InboundMessage). Read-only route — **no enqueue, no Twilio — safe in real mode.** See Recent Fixes #24.
  - **Run:** `cd backend && npm test` → 6 files / 48 passed / green ~1s. The harness + the first two suites were committed in `768fd30 "Backend testing implementation"`; the **count + create (clients) suites + the `db.create` birthday fix (Recent Fixes #20)** are committed (`b8c70cc`/`55d0c5d`/`d66fd91`); the **campaigns.create suite** in `3534544 "Campaigns Create Suite Tests"`; the **conversations suite + these doc updates + the whole inbox feature stack** are committed in `e026059 "Clients and Messages page redesign and other recent fixes"`.
  - **Remaining backend:** `POST /campaigns/:id/send` — **deferred** (see Known Issues "Real Twilio mode"). The create route never enqueues/sends (covered by the green suite above); the send route enqueues to BullMQ and calls `sendSMS`, which in the current env makes a real (401) Twilio call — blocked until the number-type / Twilio-creds decision is settled (Medium Priority). Then frontend Jest component suites, then Playwright E2E.
- [ ] Frontend component tests — extend the existing Jest 30 + ts-jest + Testing Library setup (`frontend/tests/`: `mockData.test.ts`, `components.test.tsx`, `api.test.ts`) with component integration tests (CSV import dialog + result banner, audience preview, campaign send modal).
- [ ] E2E tests with Playwright

### DevOps
- [ ] Docker Compose setup
- [ ] Environment configuration documentation
- [ ] Deployment guide (Vercel/Railway/Render)
- [ ] Production secret management

---

## Current State

### Working Features
- User login/logout
- Dashboard with real data
- Clients list and conversation view
- Templates listing
- Campaigns listing
- Messages list, compose, and conversation inbox (split-pane)
- Protected routes

### Known Issues
- **`auth.ts` JWT sign() type errors: FIXED (2026-08-03, Recent Fixes #21).** `Config.jwtExpiresIn` is now typed `ms.StringValue` (narrowed from `string` + a type-only `import { StringValue } from 'ms'` + an `as StringValue` cast at the assignment in [backend/src/config/index.ts](backend/src/config/index.ts)); all 4 `jwt.sign(...)` call sites typecheck unchanged. `tsc --noEmit`: auth.ts `TS2769` ×4 → 0. Runtime was already correct (the env `"604800"` is a valid `ms` duration) — this was purely a type cleanup. No longer a Lower Priority open task.
- **`backend/src/db/database.ts` declaration-emit errors (TS4023, TS4082): FIXED (2026-08-03, Recent Fixes #22).** Surfaced after the JWT fix (#21) removed the auth.ts errors that were masking them (verified pre-existing: they appear with the unmodified HEAD `database.ts` once auth.ts typechecks; proven not caused by the birthday or JWT edits). `export const clients` (line 14) and the default `export { clients, messages }` (line 481) had inferred types that reference `mockDatabase`'s non-exported `Client` interface ([backend/src/db/mockDatabase.ts:30](backend/src/db/mockDatabase.ts#L30)); under `tsconfig`'s `"declaration": true`, TS couldn't name that private type in the generated `.d.ts` → `TS4023 "cannot be named"` + `TS4082 "private name 'Client'"`. Fix #22 exports `Client` (matching the existing precedent of `export interface Message`) and normalizes the mock `findByPhone` branch to the same ISO-serialized shape as mock `findUnique`. `tsc --noEmit` → exit 0; 32 tests still green. No longer an open issue.
- **`POST /clients` 500 on date-only `birthday` (real mode): FIXED (2026-08-03, Recent Fixes #20).** Was: `db.create` real-mode passed `data.birthday` raw → Prisma `DateTime` "premature end of input" → 500 on the `<input type=date>` value the Add/Edit Client form sends; masked by mock (mock coerces). One-line coercion fix applied; the suite's `it.todo` is now a passing regression test (8 passing). No longer an open issue.
- **Real Twilio mode active — send paths fire real (401) Twilio calls (2026-08-10, surfaced writing the campaigns send suite).** `isMockMode = !databaseUrl || !twilioAccountSid` ([backend/src/config/index.ts:92](backend/src/config/index.ts#L92)) — both are set in the current `.env` (`DATABASE_URL` len 82, `TWILIO_ACCOUNT_SID` len 37) → **`isMockMode = false`**. [twilio.ts:13](backend/src/services/twilio.ts#L13) constructs the real client when `!isMockMode && twilioAccountSid && twilioAuthToken`; `TWILIO_AUTH_TOKEN` is a **truthy 2-char placeholder** (not empty/falsy), so the gate is satisfied and `client` is built with a junk auth token. Consequently **every send path** — `POST /campaigns/:id/send` (the Send Campaign button), `POST /messages/send-now`, the 60s scheduled-message poller, `POST /messages/schedule` — now places a real outbound call to Twilio's API → 401 on the junk token → message flips `FAILED` (no SMS delivered, but it's the real-mode operation). Blocking: (1) the **campaigns send integration suite** (deferred — would fire real 401s via the in-test worker, which `app.ts` loads transitively through `campaigns.ts` → `messageWorker.ts` → module-level `new Worker` + `setInterval`); (2) any manual click of "Send Campaign" today is a live-app hazard. **Resolution paths:** settle the **number-type / production Twilio creds** decision (Medium Priority) and set real creds — **or** reinstate mock mode by emptying `TWILIO_AUTH_TOKEN` (and/or `TWILIO_ACCOUNT_SID`) in `.env` so the twilio.ts gate leaves `client=null` → `sendSMS` returns `SM_MOCK_*` sids (the shape #17's runtime verification used). The earlier PROGRESS notes asserting "safe to test locally without live SMS / mock Twilio" (#17, #18) predate this env change and are now stale for the *send* paths — the non-send routes (clients, the new campaigns.create suite) remain safe (they never enqueue).

### Environment Setup
```
Frontend: http://localhost:3000
Backend:  http://localhost:4000
Database: PostgreSQL on localhost:5432

Test Credentials:
- admin@example.com / admin123
- user@example.com / user123
```

---

## File Structure

```
sms-platform/
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Dashboard
│   │   ├── clients/
│   │   │   ├── page.tsx         # Clients list
│   │   │   └── [id]/conversation/page.tsx  # Client chat
│   │   ├── templates/page.tsx    # Templates
│   │   ├── campaigns/page.tsx    # Campaigns
│   │   ├── messages/page.tsx     # Messages
│   │   └── login/page.tsx        # Login
│   ├── lib/
│   │   ├── api.ts               # API client
│   │   ├── hooks/useApi.ts      # React Query hooks
│   │   ├── contexts/AuthContext.tsx # Auth state
│   │   └── mockData.ts          # Deprecated — fallback path removed
│   └── components/
├── backend/
│   ├── src/
│   │   ├── routes/              # API endpoints
│   │   │   ├── auth.ts
│   │   │   ├── clients.ts
│   │   │   ├── messages.ts
│   │   │   ├── templates.ts
│   │   │   └── campaigns.ts
│   │   ├── middleware/          # Auth, logging
│   │   ├── db/                  # Database abstraction
│   │   │   └── database.ts      # Prisma wrapper
│   │   └── config/              # Environment config
│   └── prisma/
│       ├── schema.prisma        # Database schema
│       └── seed.ts              # Test data
└── docs/
    ├── BUILD_BRIEF.md
    └── PROGRESS.md             # This file
```

---

## Recent Fixes (Chronological)

1. **JWT Expiration Bug** - Tokens were set to expire in 7 seconds instead of 7 days because `parseInt("7d")` returns 7. Fixed by using the raw config value.

2. **Messages Filter Not Applied** - `getMessages` API endpoint was building a `where` clause but not passing it to `findAll()`. Fixed to pass the filter.

3. **TypeScript Errors in Messages Route** - Fixed type mismatches in `/messages/client/:clientId` endpoint with proper type assertions.

4. **Mock Data Fallbacks** - Removed mock data fallbacks from all frontend pages that were causing stale/fake data to display when API failed.

5. **Client Conversation Cache** - Added cache invalidation when switching between clients to ensure fresh data loads.

6. **Header Styling** - Updated all page headers to match Dashboard styling:
   - Description moved under the page title (inside the header div)
   - Compact button styling with smaller padding and gap
   - White text for titles, slate-300 for descriptions
   - Consistent dark border-bottom styling

7. **Non-Functional Buttons** - Identified that "Add Client", "New Template", and "New Campaign" buttons on list pages have no click handlers. Marked for implementation.

8. **Search Filtering with Debouncing** - Implemented backend search API for clients page with 300ms debounce to prevent excessive API calls. Updated React Query key structure for proper cache invalidation on filter changes.

9. **Messages Page Search & Direction Filter** - Added search by client name and direction (inbound/outbound) filtering to messages page with full backend API support. Includes client data in message responses.

10. **Clients optedOut Filter** - Fixed the "Show opted-out" checkbox to properly filter clients via the backend API. Previously the filter wasn't being passed to the database layer.

11. **Client CRUD Completion** - Implemented full CRUD operations for clients:
    - Added `update()` and `delete()` functions to backend database layer (both Prisma and mock modes)
    - Created reusable frontend components: Modal, ClientForm, ConfirmDialog
    - Added `useDeleteClient` hook to React Query hooks
    - Wired up Add/Edit/Delete buttons in clients page with proper validation, error handling, and loading states

12. **Roadmap refresh + Clients CRUD hardening** - After auditing the codebase against PROGRESS.md, the messaging infrastructure (Twilio client, BullMQ worker, inbound webhook, signature validation, STOP/HELP/START keyword handling) was already implemented but hadn't been promoted out of "Medium Priority". Moved those into a new **Messaging & SMS Infrastructure** section under Completed Work, then re-stacked the real pending items. Clients CRUD added duplicate-phone-409 check + E.164 normalization on `PUT /clients/:id`, double-opt-out guard on `DELETE`, and a reusable `ConfirmDialog`. Favicon wired in `app/layout.tsx`. Stack-ranked **MMS support** into Medium Priority with cost, URL-expiry, and storage notes; recommended **toll-free** number for the US-only deployment to skip 10DLC registration.

13. **Templates CRUD + Preview** - Mirror of the Clients work, completes Templates High Priority. Backend already had `POST /templates`, `PUT /templates/:id` (with name-uniqueness 409 + audit log), `DELETE /templates/:id` (with "used in campaigns" 409 + audit log), and `POST /templates/preview` — no backend changes needed. Frontend additions:
    - `frontend/lib/api.ts` — added `updateTemplate` and `deleteTemplate` to both real and mock APIs; mock API also enforces the `usedIn` guard so behavior is consistent across modes.
    - `frontend/lib/hooks/useApi.ts` — added `useUpdateTemplate` and `useDeleteTemplate`; the delete hook attaches `usedIn` data to the thrown error so the page can surface the 409 conflict.
    - **NEW** `frontend/lib/components/TemplateForm.tsx` — add/edit form with name+content validation, category `<select>` (5 enum values), live placeholder detection chips, and reuse of existing modal/loading patterns.
    - `frontend/app/templates/page.tsx` — full re-wire. Three `Modal`s (Add, Edit, Preview) + `ConfirmDialog` for delete. Two new state machines: `usedInCampaigns` banner (yellow) shows the campaigns blocking delete, and `errorMessage` banner (red) for general mutation failures. Preview renders template content with `{{var}}` placeholders replaced by human-readable styled labels; safe — every char is React children (no `dangerouslySetInnerHTML`).
    - Added a Delete button next to Edit/Preview on each row (backend supported it; PROGRESS.md didn't list it explicitly but consistency with the Clients CRUD pattern warranted it). If you'd prefer a dropdown menu instead, say so.

14. **Campaigns CRUD + Audience Targeting** - Completes Campaigns High Priority and adds audience resolution to the platform. Reused the Modal / ConfirmDialog / Form pattern from Clients and Templates.
   - **Schema:** `Client.taxFiledDate: DateTime?` (indexed). `Campaign.audience: AudienceType` (`ALL` / `PREV_YEAR_ACTIVE` / `MANUAL`, default `ALL`) and `Campaign.manualRecipientIds: String[]`. New `AudienceType` enum in Prisma.
   - **Backend:** `routes/campaigns.ts` accepts the new fields in `POST` and `PUT` (with MANUAL-needs-≥1-recipient validation). `POST /campaigns/:id/send` resolves recipients via a new `resolveAudienceClientIds()` helper that respects the audience mode and always intersects with `optedOut=false`. Empty recipient set returns a context-aware 400. `taxFiledDate` is stamped on a few seeded clients so dev-mode `PREV_YEAR_ACTIVE` returns something nonzero.
   - **Forward-looking caveat:** `taxFiledDate` is the field for the future CSV import (Lower Priority). Until the CSV flow ships, `PREV_YEAR_ACTIVE` will return an empty set in production. The schema and route are ready for it when the import lands.
   - **Frontend:** `useUpdateCampaign` / `useDeleteCampaign` hooks added; `updateCampaign` / `deleteCampaign` calls in both real and mock APIs (mock enforces the same RUNNING-on-update, RUNNING-on-delete, and MANUAL-needs-≥1-recipient rules as the backend). New `frontend/lib/components/campaigns/CampaignForm.tsx` (basics, template picker backed by `useTemplates`, datetime-local `<input>` for scheduleTime, recurrence select including YEARLY, audience radio section). New `frontend/lib/components/campaigns/ClientPicker.tsx` for manual mode (search-by-name with 300ms debounce → `useClients({ optedOut: false })` → checkbox list, opted-out warning). Campaigns page wires up: Add modal, Edit modal (status-gated), Delete confirm (RUNNING-disabled), error banner, audience filter alongside status filter, audience badge on each card.
   - **Type gap closed:** `CreateCampaignInput.recurrence` widened to include `'YEARLY'` to align with the Prisma enum (was a pre-existing inconsistency).
   - **Out of scope:** Campaign send (`POST /:id/send`) is now segmentation-aware when wired, but the SEND button itself is still not in the UI. CSV import (which populates `taxFiledDate`) also still pending.

15. **Send Campaign + Live Audience Preview** — Wires the audience-aware `POST /campaigns/:id/send` endpoint into the UI and surfaces a live audience-resolved recipient count before sending. Mirrors the Templates preview/edit/delete mutation patterns; no new backend schema.
   - **Backend:** New [backend/src/utils/audience.ts](backend/src/utils/audience.ts) extracts `buildAudienceWhere(audience, manualIds?)`, `resolveAudienceClientIds()`, and `emptyAudienceReason()` so the route and the count endpoint share one implementation. `routes/campaigns.ts` now imports from it. New `GET /clients/count?audience=ALL|PREV_YEAR_ACTIVE` in `routes/clients.ts` returns the opted-in client count for the requested audience, reusing `buildAudienceWhere`. `MANUAL` is intentionally rejected (it would require a recipient-id list, which a GET shouldn't carry).
   - **Frontend types:** `lib/types/index.ts` adds `SendCampaignResult`, `ClientCountResult`, and `CountAudienceMode = 'ALL' | 'PREV_YEAR_ACTIVE'`.
   - **API:** `lib/api.ts` adds `sendCampaign(id)` and `getClientCount({ audience })` in both real and mock branches. Mock mirrors the backend: rejects `RUNNING` / no-template / empty-audience, mirrors audience resolution, creates N `PENDING` Message rows, flips campaign → `RUNNING`, returns `{ campaignId, recipientCount }`.
   - **Hooks:** `lib/hooks/useApi.ts` adds `useSendCampaign` (invalidates `['campaigns']`, `['campaigns', id]`, `['messages']`, `['dashboard']` on success so the messages view reflects the new `PENDING` rows immediately) and `useClientCount` (30s stale time, disabled for `MANUAL`).
   - **NEW** [frontend/lib/components/campaigns/SendCampaignModal.tsx](frontend/lib/components/campaigns/SendCampaignModal.tsx) — three-section modal: Overview (audience + recipient count via `useClientCount`, `MANUAL` count derived locally from picked IDs), Message Preview (template content with `{{var}}` rendered as styled labels — same code path as the Templates preview), and a confirmation checkbox required to enable the Send CTA. The CTA stays disabled when there's no template, the recipient count is 0, or the campaign is already `RUNNING`.
   - **Page wiring:** [frontend/app/campaigns/page.tsx](frontend/app/campaigns/page.tsx) adds a green Send button per card (next to Edit/Delete), gate-matched to `canSend = status !== 'RUNNING'`. The `useSendCampaign` mutation closes the modal on success and surfaces the backend's specific 400 string verbatim in the existing red banner — so "no opted-in clients filed taxes in the prior calendar year" becomes a contextual message rather than a 400 foot-gun.
   - **Form:** [frontend/lib/components/campaigns/CampaignForm.tsx](frontend/lib/components/campaigns/CampaignForm.tsx) subscribes to `useClientCount` and renders a live count line below the audience radios: *"Will target N opted-in clients."* `MANUAL` derives the count locally from picked IDs. An inline `PREV_YEAR_ACTIVE` empty warning surfaces the CSV-import-not-yet-populated caveat before the user clicks Send.
   - **Dispatch gap resolved (2026-08-01):** `POST /campaigns/:id/send` previously created `PENDING` rows and leaned on a 60s poller that never ran. It now enqueues directly to BullMQ, and two related bugs were fixed (immediate-send NULL-exclusion + BullMQ Queue/Worker namespace mismatch). See [Medium Priority → Campaign dispatch wiring](#medium-priority) and Recent Fixes #17.

16. **Modal form-input styling consistency** — Resolves the Medium-Priority "UI polish — form readability" item. Appended `text-slate-700 placeholder:text-slate-400` to every text-entry `<input>` / `<textarea>` / `<select>` className in the four doc-listed forms so filled values and placeholders read correctly against the white modal surface (they previously inherited the dark body text color / UA-default gray). Files: [ClientForm.tsx](frontend/lib/components/ClientForm.tsx) (6 — cyan focus-ring preserved), [TemplateForm.tsx](frontend/lib/components/TemplateForm.tsx) (3 — blue ring preserved), [CampaignForm.tsx](frontend/lib/components/campaigns/CampaignForm.tsx) (6 incl. audience radio — blue ring preserved), [ClientPicker.tsx](frontend/lib/components/campaigns/ClientPicker.tsx) (2 incl. results checkbox — blue ring preserved). Per explicit user decision, the radio + checkbox checked-accent was swapped `text-blue-600` → `text-slate-700` (blue `focus:ring-*` retained) so each control carries a single deterministic `text-*` token rather than two competing ones. No structural/logic changes — purely classNames. Broader app-wide sweep tracked under [Lower Priority](#lower-priority).

17. **Campaign dispatch wiring + immediate-send NULL-exclusion fix** — Resolves the Medium-Priority "Campaign dispatch wiring" item and a deeper BullMQ bug found while wiring it. `POST /campaigns/:id/send` now enqueues directly to BullMQ via the existing `queueMessage()` helper (was: created `PENDING` rows and leaned on a 60s poller that never ran). Files touched:
   - [backend/src/routes/campaigns.ts](backend/src/routes/campaigns.ts) — `createManyAndReturn` creates `QUEUED` messages (`scheduledAt = scheduleTime ?? null`), then enqueues each with `scheduledFor = scheduleTime` (scheduled) or `undefined` (immediate). Response + audit log now include a `queued` count.
   - [backend/src/workers/messageWorker.ts](backend/src/workers/messageWorker.ts) — (1) poller WHERE patched to `OR: [{ scheduledAt: { lte: now } }, { scheduledAt: null }]` so null-`scheduledAt` rows are eligible (the immediate-send NULL-exclusion bug, confirmed at runtime before the fix). (2) Fixed BullMQ Queue/Worker namespace mismatch: the `Worker` consumed from `'message-worker'` while the `Queue` produced to `'message-queue'`; a BullMQ Worker's first arg is the queue name to consume (it `extends QueueBase`), so the worker was a silent no-op since it was written. Both now share `QUEUE_NAME = 'message-queue'`; `WORKER_NAME` removed.
   - [backend/src/index.ts](backend/src/index.ts) — now `import './workers/index.js'` so the worker + poller actually run (the worker never loaded before because the module was never imported).
   - [backend/src/utils/audience.ts](backend/src/utils/audience.ts) — `resolveAudienceClientIds()` now returns `phone` so the route can enqueue without a re-query (single caller updated).
   - **Verified at runtime — immediate-send (mock Twilio):** an unscheduled DRAFT campaign (MANUAL, one opted-in client) → `POST /:id/send` returned `queued: 1` → message went `QUEUED` (`scheduled_at` null) → the BullMQ worker drained it from `bull:message-queue:wait` → row flipped to `SENT` with a `SM_MOCK_*` sid (no real SMS). Test artifacts cleaned, dev DB restored to baseline.
   - **Verified at runtime — scheduled-send (mock Twilio, 2026-08-01):** a `SCHEDULED` campaign with `scheduleTime` ~2 min in the future (same audience/template) → `POST /:id/send` returned `queued: 1` → message created `QUEUED` with a **future** `scheduled_at` → job held in `bull:message-queue:delayed` (delayed=1, wait=0) by BullMQ's native `delay`, not handed to the worker → fired on cue at `scheduleTime` (`sent_at` = 08:46:27.084, within the same second as the scheduled time, not the enqueue time) → row flipped to `SENT` with a `SM_MOCK_*` sid masking the 08:46:27 instant. `delayed/wait/active/completed/failed` all returned to 0 (`removeOnComplete`). This exercises the `scheduledFor` branch of `queueMessage()` — the native-delay path the immediate test did not touch. Test artifacts cleaned, dev DB restored to baseline (DRAFT 1 / SCHEDULED 1 / COMPLETED 1).
   - **Ops note:** requires Redis. `brew install redis && brew services start redis` (the stock `/opt/homebrew/etc/redis.conf` had four broken `loadmodule` directives pointing at missing modules that aborted every launch — commented out).

18. **CSV Import — bulk client ingest for the tax-season report** — Adds the periodic-upload feature flagged in earlier entries (#14, #15: "until the CSV flow ships, `PREV_YEAR_ACTIVE` returns an empty set"). The same report shape is re-uploaded throughout a season, so the route is **idempotent on phone**: new phones create; known phones refresh *only* the tax-season fields, never identity. No real SMS is involved (import never enqueues messages).
   - **Schema** ([backend/prisma/schema.prisma](backend/prisma/schema.prisma)) — five new `Client` fields, applied via `prisma db push`: `taxFiledDate DateTime?` (indexed), `taxReturnType String?`, `taxpayerStatus String?`, `inactive Boolean`, `clientLY Boolean`, `clientNew Boolean`. Comment in-file records the semantics locked with the business owner: `inactive` ("Client Inactive") is **not** `optedOut` — `optedOut` is revoked SMS consent (a legal flag); `inactive` means carried over / not seen this season. Identity fields (name/phone/email/birthday/notes/optedOut) are never overwritten by an import.
   - **CSV parser** ([backend/src/utils/csv.ts](backend/src/utils/csv.ts) — new) — `parseCsvReport(text)` strips the report envelope (title line, "As of <date>" line, "Totals (N)" row) *by content, not line number*, so regenerated reports with different dates/counts still parse. Headers mapped by lowercased name, not position. One row = one client. Rows missing identity (firstName/phone) or with an unparseable phone land in `skipped` with a reason; they never reach the DB. `parseUSDate` (`MM/DD/YYYY` → UTC-midnight `Date`), `yesNoToBool`, and a hand-rolled RFC-4180-ish `splitCsv` (handles quoted fields / embedded commas / doubled-quote escapes — no new dep).
   - **Import route** ([backend/src/routes/clients.ts](backend/src/routes/clients.ts)) — new `POST /clients/import`, mounted **before** `/:id` so `/import` isn't captured by the dynamic param. Accepts the raw CSV string (route-scoped `express.text({ type: ['text/csv','text/plain'], limit: '10mb' })` — no multer). Per-row `findUnique({where:{phone}})` → exists: `update` tax fields only → `existing++`; new: `create` identity + tax → `created++`; P2002 (dup phone within the same file, findUnique race) → `existing++` (treated as known, not error). Response: `{ created, existing, skipped[], errors[], totalRows, asOf }`. Writes a `clients_imported` audit row.
   - **Frontend** — `Client` type + 5 new fields + `ImportClientsResult` ([frontend/lib/types/index.ts](frontend/lib/types/index.ts)); `importClients(csvText)` in both real and mock `api` (real posts `Content-Type: text/csv` raw body, overriding `apiFetch`'s JSON default; mock reports a no-op summary); `useImportClients` hook (reads `file.text()`, invalidates `['clients']` + `['dashboard']`, hands the summary to `onSuccess`); `Import CSV` button + hidden `<input type="file" accept=".csv">` + green result banner (created/updated/skipped/errors counts, collapsible skipped/error row lists) on [frontend/app/clients/page.tsx](frontend/app/clients/page.tsx). Mock data refreshed to the new shape.
   - **Verified at runtime (mock Twilio, 2026-08-01):** imported the sanitized real sample (`Sample CSV Report for SMS Platform.csv`, 208 data rows) → `created: 1` (JOHN DOE +14081234567), `skipped: 207` (blank rows, reason "Unrecognized phone number"), `asOf: "08-01-2026"`; totals reconcile (1+207=208 = the report's "Totals (208)"). **Re-importing the same file → `existing: 1`, `created: 0`** — proves the duplicate-avoidance the business owner asked for. A 3-row synthetic fixture with distinct statuses (EF Accepted / Updated From 2024 / New Client) confirmed flag mapping (`MM/DD/YYYY`→date, blank Date Changed→NULL `tax_filed_date`, `Yes/No`→bool), and re-importing the same phones with a **changed first name** confirmed identity is preserved while tax fields refreshed — `Alice_identity_preserved=true`, `tax_filed_date` v1→v2 (2026-01-10→2026-02-20), `taxpayer_status` refreshed, `inactive` refreshed. Audit `clients_imported` `details` written. Test rows + 5 audit rows deleted, dev DB restored to baseline.
   - **Concurrent fix:** the import route passes audit `details` as a plain object (not `JSON.stringify`) so Postgres stores a proper jsonb object — `details->>'created'` is queryable. The older `JSON.stringify` convention in `routes/campaigns.ts` double-encodes `details` as a jsonb string (pre-existing, noted here; left untouched).
   - **Stubbed:** mock `importClients` returns a no-op summary (doesn't parse) — mock mode can exercise the UI flow without a backend but won't reflect real counts.

19. **Backend integration-test harness + first four green suites** — Lays the testing foundation and the first coverage. No source-route behavior changed (one structural extraction for testability); everything runs in mock Twilio (import/CRUD/create never enqueue or send).
   - **App factory extraction** ([backend/src/app.ts](backend/src/app.ts) — new) — the Express app (middleware + routes + health + error handlers) split out of `src/index.ts` so tests import the app *without* `import './workers/index.js'` (BullMQ worker + 60s poller) or `app.listen()` (port bind). `src/index.ts` is now slim: imports `app` from `./app.js`, keeps the worker import + banner + listen, re-exports app. Tests drive routes via supertest against the real app, never binding a port or racing the worker.
   - **Harness** — Vitest 4 + supertest (`backend/vitest.config.ts`, `backend/tests/setup.ts`). `setup.ts` exports `request` (supertest), `app` (from `src/app.ts`), and `authHeader()` (POSTs `/api/auth/login` as the seeded admin → Bearer header). `node` env, 20s test/hook timeouts. devDeps `vitest` + `supertest` added to `backend/package.json`.
   - **`tests/clients.import.test.ts` (5, green)** — ordered suite on a single phone (`+14089990001`, valid NPA 408 — `normalizeToE164` rejects reserved 555, which the seed bypasses by inserting raw E.164). create-new + skipped-row report + asOf capture; idempotent re-import (existing=1, created=0); tax-field refresh preserves identity (direct DB: first name NOT clobbered, `taxFiledDate`/`taxReturnType`/`taxpayerStatus` refreshed); 400 empty body; 401 unauth. `afterAll` deletes the test client + the `clients_imported` audit rows by a distinctive `asOf` marker.
   - **`tests/clients.crud.test.ts` (10, green)** — `PUT`/`DELETE /clients/:id` on a shared phone block (`+1415999*`, valid NPA 415, disjoint from the seed and import blocks). PUT: identity/notes update + 200 with a tax-field-preservation DB assertion (symmetric to import's identity-preservation); 404 unknown; phone-change E.164 normalization (bare `41599900NN`→`+1415999…`); reserved NPA `555`→400 with row untouched; phone owned by another client→409. DELETE: soft opt-out (`optedOut=true`, row survives — confirmed `db.delete` is a soft opt-out, so the `400 "already opted out"` guard is reachable); 404 unknown; 400 already-opted-out; 401 unauth. `afterAll` hard-deletes the whole phone block (catches soft-opted-out rows too). These routes write no audit rows — nothing else to clean.
   - **`tests/clients.count.test.ts` (8, green)** — `GET /clients/count` on a dedicated phone block (`+1212999`, NPA 212, disjoint from the seed + import + CRUD blocks). Locks the contract that the campaign-form audience preview matches what the send path targets: it shares `buildAudienceWhere` with `POST /campaigns/:id/send`. **Parity** is "bracketed" — a direct count is taken immediately before AND after the endpoint read, and the endpoint value must lie within `[min, max]` of the two — so the import/CRUD suites (which run in parallel against the same dev DB and mutate their own disjoint phone blocks) cannot flake the aggregate-count assertions. **Predicate semantics** are proved prefix-scoped via 4 fixtures covering the matrix: qualifying (opted-in + filed mid prior year → ALL + PREV), outside-year (opted-in + filed this year → ALL only), null-filed (opted-in + never filed → ALL only), opted-out (opted-out despite filing prior year → neither). Asserts ALL=3 (opted-out excluded) and PREV_YEAR_ACTIVE=1 (excludes wrong-year + NULL `taxFiledDate` + opted-out). Also: MANUAL→400 (a GET can't carry a recipient-id list), invalid audience→400, default-no-param→ALL, 401 unauth. `afterAll` hard-deletes the block; count tests write no audit rows.
   - **`tests/clients.create.test.ts` (8 passing, green)** — `POST /clients` on a dedicated phone block (`+1312999` prefix, NPA 312, disjoint from the seed + import + CRUD + count blocks). The API sends bare 10-digit phones (`bareFor(NN)` strips the `+1`) to exercise the route's `normalizeToE164`; fixtures are created directly via Prisma with raw E.164 (bypassing normalize, like the seed). Happy path: 201 + E.164 normalization (`3129990011`→`+13129990011`) + a direct-DB assertion that POST owns identity only and leaves the import-owned tax-season fields at clean-neutral defaults (`taxFiledDate`/`taxReturnType`/`taxpayerStatus` null; `inactive`/`clientLY`/`clientNew` false; `lastName` defaulted to `""`). Validation: missing `firstName`→400 "First name and phone are required" (no row created); missing `phone`→400; reserved NPA `555`→400 "Invalid phone number format" (no row at the would-be `+15550000000`). Duplicates: active client→409 (exactly one row); **soft-deleted (opted-out) client→409** — locks the contract that a soft-deleted phone is NOT reusable via POST (`db.findByPhone` returns opted-out rows, so POST can't "re-create" the number as fresh opted-in; the original stays opted-out with its original `firstName`, un-overwritten). Optional fields (`lastName`/`email`/`birthday`/`notes`) persist; `optedOut` defaults false; **date-only `YYYY-MM-DD` birthday accepted** (the regression test added by fix #20). 401 unauth. `afterAll` hard-deletes the block; POST writes no audit rows.
   - **Real bug surfaced by the create suite — fixed in Recent Fixes #20:** `db.create` real-mode (`backend/src/db/database.ts`) passed `data.birthday` raw to Prisma's `DateTime` scalar, which rejects a bare `YYYY-MM-DD` ("premature end of input") → the route threw → **500** on exactly the date-only string the form's `<input type="date">` sends (reachable from the real UI; masked by mock mode). [`db.update`](backend/src/db/database.ts#L181) and the mock `create` both coerce via `new Date()` — real `create` was the odd one out. Fix #20 applies the one-line coercion and converts the `it.todo` into a passing regression test.
   - **Verified:** `cd backend && npm test` → 4 files / 32 tests passed (0 todos) / green ~1s; post-run sweep: 0 orphaned rows across all four phone blocks (`+14089990001`, `+1415999*`, `+1212999*`, `+1312999*`). Test-discovered bug (import/crud suites): the first run used NPA `555` (`+15559990001`), which `normalizeToE164` rejects — switched the fixtures to valid NPAs `408`/`415`/`212`/`312` (the import-route comment already warns about this).
   - **Committed** in `768fd30 "Backend testing implementation"`: the harness (`src/app.ts`, `vitest.config.ts`, `tests/setup.ts`, `package.json` devDeps, slimmed `src/index.ts`) plus the import + CRUD suites. The **count suite** and the **create suite** (`tests/clients.count.test.ts`, `tests/clients.create.test.ts`) and the PROGRESS.md edits recording both were committed later in `b8c70cc`/`55d0c5d`/`d66fd91` (see Recent Fixes #20).

20. **`db.create` birthday-coercion fix (real mode) + create-suite `it.todo` → regression test** — First production-source change driven by the integration tests. **Symptom uncovered by `tests/clients.create.test.ts`:** `POST /clients` returned **500** whenever `birthday` was a date-only `YYYY-MM-DD` string — exactly what the Add/Edit Client form's `<input type="date">` ([frontend/lib/components/ClientForm.tsx:188](frontend/lib/components/ClientForm.tsx#L188)) sends. **Root cause:** `db.create` real-mode ([backend/src/db/database.ts:~140](backend/src/db/database.ts#L140)) passed `data.birthday` *raw* to `prisma.client.create`; Prisma's `DateTime` scalar rejects a bare date-only string with "premature end of input. Expected ISO-8601 DateTime" → the route threw → the catch-all returned 500. `db.update` real-mode ([database.ts:181](backend/src/db/database.ts#L181)) and the mock `create` ([database.ts:125](backend/src/db/database.ts#L125)) both coerce via `new Date(data.birthday)` — real `create` was the odd one out, so mock mode masked the bug for the project's entire life (the mock coerces before storing). **Fix:** in `db.create` real-mode, mirror the other two branches — `birthday: data.birthday ? new Date(data.birthday) : null` (one line; spreads the rest of `data` unchanged; [backend/src/db/database.ts:140-148](backend/src/db/database.ts#L140-L148)). **Test:** converted the suite's `it.todo` into a passing regression test that sends exactly the form's date-only shape (`{ firstName: 'DateOnly', phone: bareFor(81), birthday: '1990-05-15' }`), asserts 201 + a serialized response birthday, and a direct-DB round-trip to `1990-05-15T00:00:00.000Z` (`new Date('YYYY-MM-DD')` is UTC midnight per the ISO date-only spec, so the assertion is time-zone-independent). The optional-fields test still sends a full ISO datetime to cover that shape too. **Verified:** `cd backend && npm test` → 4 files / **32 passed (0 todos)** / green ~1s; all four phone blocks still 0 orphans; `npx tsc --noEmit` reports no new errors on `database.ts` (only the pre-existing `auth.ts` JWT errors — see Known Issues). Now live in real mode — Add-Client with a birthday set returns 201 instead of 500.

21. **`jsonwebtoken@9` overload type fix (`auth.ts` TS2769 ×4 → 0)** — Second production-source change driven by working through the test harness's `tsc` signal. **Symptom:** `npx tsc --noEmit` failed with 4× `TS2769 "No overload matches this call"` at the four `jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn })` sites in [backend/src/routes/auth.ts](backend/src/routes/auth.ts#L87) (lines 87, 132, 178, 213). **Root cause:** `@types/jsonwebtoken@9` narrowed `SignOptions.expiresIn` from `string` to `StringValue | number` (`StringValue` is a branded template-literal union imported from `ms`: `` `${number}` | `${number}d` | `${number}h` … ``); `config.jwtExpiresIn` was typed plain `string` ([backend/src/config/index.ts:32](backend/src/config/index.ts#L32)), which isn't assignable to that branded union → the HS256 overload rejected the options object at every call site. **Runtime was already fine** — the env `"604800"` is a valid `ms` numeric-seconds string (matches `` `${number}` ``), so tokens minted/verified/expired correctly and the runtime JWT bugfix (entry #1) held. This was purely a typecheck gap. **Fix (Option A — narrow at the source, one cast):** in [backend/src/config/index.ts](backend/src/config/index.ts) — a type-only `import { StringValue } from 'ms'`, widen the interface field `jwtExpiresIn: string` → `jwtExpiresIn: StringValue`, and cast the assignment `optional('JWT_EXPIRES_IN', '604800') as StringValue`. No `auth.ts` edits; all 4 call sites typecheck unchanged (DRY — one assertion at the single source of truth). `"604800"` / `"7d"` / `"1h"` all stay valid env values; a malformed value fails at the first `jwt.sign` (fail-fast). `ms` + `@types/ms` ship transitively with jsonwebtoken, so the import adds no runtime/bundle cost and mirrors `@types/jsonwebtoken`'s own internal import. **Verified:** `tsc --noEmit` → auth.ts TS2769 ×4 → **0** (full pass: only 2 `database.ts` declaration-emit errors remain — pre-existing latent, see Known Issues, proven not caused by this fix or #20). `npm test` → 32 passed / 0 todos / green. Cross-doc: the historical Bug-Fixes line #1 and the [Lower Priority](#lower-priority) auth.ts task are marked done.

22. **`database.ts` declaration-emit fix + mock `findByPhone` shape normalization (TS4023/TS4082 → 0)** — Third production-source change in the `tsc`-cleanup cluster (#20 birthday, #21 JWT, #22 this). Both edits verified together; neither changed real-mode runtime behavior. **Symptom:** after fix #21 cleared the 4 `auth.ts` TS2769 errors, `tsc --noEmit` still failed on 2 pre-existing latent `database.ts` errors — `TS4023 "cannot be named"` + `TS4082 "private name 'Client'"` at `export const clients` and the default `export { clients, messages }`. **Root cause (proven pre-existing):** both exports have inferred types that reference `mockDatabase`'s non-exported `Client` interface ([backend/src/db/mockDatabase.ts:30](backend/src/db/mockDatabase.ts#L30)); under `tsconfig`'s `"declaration": true`, TS can't name a private type in the generated `.d.ts`. A stash-based repro proved these were latent all along (they appear with the *unmodified HEAD* `database.ts` once `auth.ts` typechecks — i.e. auth.ts's errors were blocking the declaration-emit phase and masking them), so they're not a consequence of #20 or #21. **Fix (2 edits):**
   - (1) [backend/src/db/mockDatabase.ts:30](backend/src/db/mockDatabase.ts#L30) — `interface Client` → `export interface Client`, matching the existing precedent of `export interface Message` (line 35 of the same file). Minimal + consistent: `Client` is the only non-exported mock interface `database.ts` references; the other five stay private.
   - (2) [backend/src/db/database.ts:109](backend/src/db/database.ts#L109) — normalized the mock `findByPhone` branch to return the ISO-serialized shape (Dates → `.toISOString()`, plus `_count`) that mock `findUnique` already returns. Previously `findByPhone` was the **only** `clients.*` method that returned the raw `Client` record with `Date`-typed fields — every sibling (`findUnique`, `findMany`, `create`, `update`, `delete`) already serialized. Safe by construction: both call sites ([clients.ts:90](backend/src/routes/clients.ts#L90) `if (existing)` → 409; [clients.ts:327](backend/src/routes/clients.ts#L327) `existingPhone.id !== id` → 409) read only existence / `.id`, never Date fields. Real mode (the `prisma.client.findUnique` branch) is untouched.
   - **Verified:** `tsc --noEmit` → **exit 0** (the only remaining errors — the 2 `database.ts` ones — are now gone; full clean pass); `npm test` → 4 files / **32 passed (0 todos)** / green ~1s (the mock-branch edit is dead code under tests — `isMockMode` is false with a real `DATABASE_URL`). No new test added: this is a mock-only shape-consistency fix, not a real-path behavior change.

23. **Backend integration suite: `POST /api/campaigns` create (9 tests)** — Fifth green suite; first coverage of a non-`clients` route. [backend/tests/campaigns.create.test.ts](backend/tests/campaigns.create.test.ts) — drives the real app via supertest (create never enqueues/ sends, so it's safe in the current env's real-Twilio mode — see Known Issues). Locks the create route's full validation surface: minimal 201 + clean DB defaults (audience `ALL`, status `DRAFT`, `manualRecipientIds:[]`, recurrence `NONE`, `templateId:null`, `scheduleTime` null — asserted via direct-DB read, mirroring clients.create's tax-field check); future `scheduleTime`→status `SCHEDULED`; audience `MANUAL` + ids persisted (create doesn't validate id existence, so bogus IDs are fine); non-MANUAL with junk `manualRecipientIds`→route forces `[]` (asserted on both HTTP response AND DB row — a `buildAudienceWhere` misread would otherwise leak to `/send`); missing name→400 "Campaign name is required"; past `scheduleTime`→400 "Schedule time must be in the future"; MANUAL with ids omitted→400; MANUAL with `[]`→400 (same guard, `!Array.isArray || length===0`); 401 unauth. Each 400 path asserts the would-be campaign is absent (`findFirst({where:{name}})` — `Campaign.name` is **not** unique, so `findUnique` can't scope it).
   - **Isolation:** campaigns use CUID ids (no phone-block analog), so scoping is by a NAME sentinel — every test campaign `name` startsWith `__campaignsTest__` (won't collide with seed "Summer Welcome Series"/"July Promo"/"Birthday Messages"). `afterAll`: collect test campaign ids → delete messages via `campaign.name` relation filter (create makes none; generalizable) → delete the route's `campaign_created` audit rows by raw-SQL `details::text LIKE '%<id>%'` (the audit `details` is a double-encoded jsonb string from `JSON.stringify`, see #18 — Prisma's path-based Json filters don't apply to a bare scalar, so a text cast is the robust scoped match; CUIDs are unique so this never touches another suite's or the live app's rows) → delete campaigns by name. No client fixtures needed (the MANUAL test uses bogus recipient IDs).
   - **Verified:** `cd backend && npm test` → 5 files / **41 passed (0 todos)** / green ~1s; post-run sweep: 0 sentinel-named campaigns, 0 `campaign_created` audit rows, 0 messages; `tsc --noEmit` → exit 0. The **`POST /campaigns/:id/send` suite (Suite B) is deferred** — that route enqueues to BullMQ and calls `sendSMS`, which in the current env's real-Twilio mode fires real (401) Twilio calls via the in-test worker (loaded transitively through `campaigns.ts` → `messageWorker.ts`). Filed as a Known Issue; blocked until the number-type / Twilio-creds decision is settled.

24. **Conversation inbox (split-pane) + backend `GET /messages/conversations` + inbound shape fix** — Desktop inbox at `/messages` replacing the flat message log. **Backend (2 changes in [backend/src/routes/messages.ts](backend/src/routes/messages.ts)):** (1) new route `GET /messages/conversations` — lists every client as a conversation, with-message clients first (ordered by most-recent outbound-or-inbound message desc), zero-message clients after (`createdAt` desc); per client returns `{ client, lastMessage: {content, direction, timestamp}|null, outboundCount, inboundCount }` + pagination. Prisma-native (no raw SQL): `groupBy` on `Message` + `InboundMessage` → `Map<clientId, summary>`, `count` for totals, page-slice across the with/zero boundary in Node, then `distinct(['clientId'])` + `orderBy desc` to fetch the single latest message per page client. Optional `?search=` (client name/phone/email, insensitive contains) scopes the universe. **Inserted before `GET /:id`** — the existing single-segment catch-all would shadow `/conversations` (`:id='conversations'`) → silent 404; a test asserts authed-200 to guard this. (2) **bug fix in `GET /messages/client/:clientId`** — inbound rows were spreading `body` not `content` and missing `type`, so the old thread's `getMessageType()` defaulted everything to `outbound` and the inbound bubble branch was dead code (client replies never rendered). Now sets `content: m.body`, `type: 'inbound' as const`, `status: null`, `campaignId: null` — inbound replies render as left-white bubbles.

   **Frontend (2 new files, 4 modified):**
   - New [`frontend/lib/components/ConversationThread.tsx`](frontend/lib/components/ConversationThread.tsx) — extracted shared thread (header via `useClient`, merged thread via `useConversation` — the endpoint fixed above — composer via `useSendMessage`, date-grouped bubbles, status ticks, opt-out notice, scroll-to-bottom). Props `{ clientId, showBackButton?, backHref? }`.
   - New [`frontend/lib/components/ComposeModal.tsx`](frontend/lib/components/ComposeModal.tsx) — extracted multi-recipient composer (recipient checkboxes via `useClients({limit:100, optedOut:false})` → `useSendMessage`).
   - [`frontend/app/messages/page.tsx`](frontend/app/messages/page.tsx) replaced — Suspense-wrapped split-pane: left `<aside w-[340px]>` lists conversations (name/opted-out, phone, ↗/↙ + 60-char preview, relative time, `out:N`/`in:M`), search (debounced 300ms) + Compose + pagination; right pane renders `<ConversationThread>` or empty state. Selection lives in the URL (`?client=<id>` via `useSearchParams` + `router.replace`, `{scroll:false}`) — survives refresh, shareable, and is the entry point for the Clients-page "open in inbox" button. Next 16 requires the `useSearchParams()` caller inside `<Suspense>` (build-verified).
   - [`frontend/app/clients/[id]/conversation/page.tsx`](frontend/app/clients/[id]/conversation/page.tsx) — originally a thin wrapper reusing `<ConversationThread>` (showBackButton, backHref="/clients") so the legacy deep-link + Clients-list link both keep working. **Later redirected to the inbox** in Recent Fixes #25 — the own-presentation route was dropped in favor of a single messaging surface; `<ConversationThread>` no longer carries the back-button props.
   - [`frontend/lib/types/index.ts`](frontend/lib/types/index.ts) — added `ConversationMessage`, `ConversationListItem`, `ConversationsResponse`.
   - [`frontend/lib/api.ts`](frontend/lib/api.ts) — added `getConversations` + `getClientMessages` to both the real `api` and `mockApi`; mock respects `mockMessages` `type:'inbound'` rows (`dirOf` helper, per-client split counts) so mock mode exercises the with/zero + inbound ordering too.
   - [`frontend/lib/hooks/useApi.ts`](frontend/lib/hooks/useApi.ts) — added `useConversations` + `useConversation` (both `refetchInterval: 12_000` to surface new replies via polling, no WebSockets); `useSendMessage` + `useSendCampaign` `onSuccess` now also invalidate `['conversations']` + `['conversation']` (prefix) so a send bumps the left list and refreshes the open thread.

   **Tests:** new backend suite [`backend/tests/conversations.test.ts`](backend/tests/conversations.test.ts) (7 tests — see Testing section). 2 frontend mock assertions added to [`frontend/tests/api.test.ts`](frontend/tests/api.test.ts): `getConversations` returns `{conversations, pagination}` with with-message rows before null-`lastMessage` rows; `getClientMessages('cl-1')` returns the merged thread with inbound rows tagged `direction:'inbound'`.

   **Verified:** `cd backend && npm test` → **6 files / 48 passed (0 todos)** / green ~1s; `cd backend && npx tsc --noEmit` → exit 0; `cd frontend && npm test -- api` → 17/17 mock assertions green; `cd frontend && npm run build` → success (no `useSearchParams` Suspense error). The read path is safe in real-Twilio mode (Prisma reads only); the composer's `POST /messages/send-now` fires real (401) Twilio calls in the current env — pre-existing hazard, surfaces via `onError` (does not block UI build). **Mobile responsive collapse deferred this session.** Committed in `e026059 "Clients and Messages page redesign and other recent fixes"`.

25. **Refocus the Clients page on client info + redirect the legacy conversation route + prune dead `<ConversationThread>` code** — Follow-up to the inbox work (#24) so the Clients page stops overlapping the Messages inbox and there's a single messaging surface. Three changes:
   - [`frontend/app/clients/page.tsx`](frontend/app/clients/page.tsx) — dropped the "Messages" column (header + the `{client._count?.outboundMessages}` count cell) so the page is purely client info (Name / Phone / Email / Status / Actions via the existing Edit/Delete); fixed the empty-state `colSpan` 6 → **5** to match the new column count; repointed the per-row chat affordance "View Chat" → `/clients/<id>/conversation` into **"Message"** → `/messages?client=<id>`, which the inbox reads via `useSearchParams().get('client')` and opens as the selected client's thread in the right pane.
   - [`frontend/app/clients/[id]/conversation/page.tsx`](frontend/app/clients/[id]/conversation/page.tsx) — replaced the thin-wrapper `<ConversationThread>` render with a **server-component `redirect('/messages?client=<id>')`** (307, via `redirect` from `next/navigation`; async `params` per Next 16). Deep links / bookmarks to the old route now resolve to the inbox. The redundant in-thread "back to Clients" affordance it provided is covered by the always-present global **Clients** nav button. Verified `next/navigation` `redirect` + `params: Promise<…>` patterns against the bundled Next 16 docs (`node_modules/next/dist/docs`).
   - [`frontend/lib/components/ConversationThread.tsx`](frontend/lib/components/ConversationThread.tsx) — pruned the now-dead `showBackButton` / `backHref` props (declared alongside defaults `= false` / `= '/clients'`), the **two** gated render blocks behind them (the header back-arrow and the "Client not found" `← Back` button), and the now-unused `useRouter` import + `const router = useRouter()` (those buttons were its only consumers). The component is now strictly the inbox thread: `ConversationThread({ clientId })`. Updated the module doc comment (the inbox is the sole mounter; the legacy route redirects rather than renders). With this, `ConversationThread`'s only caller is the inbox right pane at [`app/messages/page.tsx:219`](frontend/app/messages/page.tsx#L219).
   - **Verified:** `cd frontend && npx tsc --noEmit` → exit 0; `npm test -- api` → 17/17; `npm run build` → success (route map shows `/clients/[id]/conversation` demoted to `ƒ (Dynamic)` — server redirect, server-rendered on demand — and `/messages` stays `○ (Static)`, Suspense boundary intact). All work **committed in `e026059 "Clients and Messages page redesign and other recent fixes"`**.

---

## Stack-Rank Notes

### Why MMS lands in Medium Priority (not High)

- Templates + Campaigns CRUD are genuine UI gaps that block basic management UX. MMS is a **feature addition** on a working messaging pipeline.
- The inbound-webhook handler that MMS depends on (`routes/webhooks.ts`) already exists — so MMS doesn't gate on missing infrastructure.
- The non-trivial work MMS adds (~2–4 days baseline): data-model change, file-upload UI, media rehost pipeline, conversation-render support, storage lifecycle policy.

### What MMS actually costs us on Twilio (US)

- **Outbound MMS**: $0.022 + carrier fees (~$0.007–$0.01 depending on carrier) vs $0.0083 for SMS — ~3× per message.
- **Inbound MMS**: $0.0165–$0.02 + carrier fees.
- **Limits**: 10 attachments per message, 5 MB per file, 150 MB aggregate.
- **Inbound URLs**: hosted at `api.twilio.com`, HTTP Basic Auth-gated, **do not auto-expire** but cannot be served to browsers without credentials → must download + rehost.
- Budget impact for this app at ~200 clients with low message volume (a few campaigns/month + birthday/holiday): **a few dollars per month at most** — not a financial blocker, more of a feature-coverage and storage decision.

### Recommended next steps (after this doc update)

1. ~~**Campaign dispatch wiring (enqueue from `POST /:id/send`)**~~ — Medium Priority. **Done (2026-08-01)** in Recent Fixes #17. The send route enqueues directly to BullMQ; both the immediate-send NULL-exclusion and a deeper BullMQ Queue/Worker namespace mismatch are fixed, and the worker is now loaded by `src/index.ts`. See [Medium Priority → Campaign dispatch wiring](#medium-priority).
2. Settle the **number-type decision** (toll-free) and wire production Twilio env vars — Medium Priority. **Current recommended next step.** Prerequisite for live-SMS testing of the dispatch path and for MMS support.
3. MMS support implementation — Medium Priority, *after* number type is chosen.
4. ~~Wire up the Send Campaign button~~ — **Done** in entry #15 above. The Send modal + audience preview are wired against `POST /campaigns/:id/send`. `PREV_YEAR_ACTIVE` will still resolve to an empty set until #5 ships CSV import.
5. CSV import to populate `Client.taxFiledDate` — Lower Priority, but unblocks production `PREV_YEAR_ACTIVE` audiences and is the only remaining gap before the Campaigns Send button is fully useful end-to-end.
6. **Testing** — *in progress (2026-08-11; see Testing section + Recent Fixes #19–#24).* Harness live (Vitest + supertest + `src/app.ts` app-factory extraction). **Done:** the four `clients`-router suites (import, CRUD, count, create — see #19/#20) **plus `POST /campaigns` create (#23, 9 tests) plus `GET /messages/conversations` (#24, 7 tests)** — **48 tests green across 6 files** (~1s; dev DB left spotless, 0 orphans across all five phone blocks + the campaign name sentinel). The create suite also surfaced a real `db.create` birthday-coercion bug — **fixed in #20**. ✅ `tsc --noEmit` is a full clean pass (the #21/#22 cluster cleared the last type errors). **Remaining, while the contracts are fresh:** `POST /campaigns/:id/send` — **deferred** (see Known Issues "Real Twilio mode"); the env's real-Twilio mode + the in-test worker make the suite fire real (401) Twilio calls. Unblocks once the number-type / Twilio-creds decision (Medium Priority) is settled or mock mode is reinstated. Then frontend Jest component suites, then Playwright E2E.

## How to Continue

If this conversation is lost, use these steps to get up to speed:

1. **Environment**: Copy `.env.example` to `.env` in both frontend and backend dirs
2. **Database**: Run `npx prisma db push` and `npm run db:seed` in backend
3. **Start Backend**: `cd backend && npm run dev`
4. **Start Frontend**: `cd frontend && npm run dev`
5. **Login**: admin@example.com / admin123

The frontend currently connects to the real backend (NEXT_PUBLIC_USE_MOCK=false).

---

*Last Updated: August 12, 2026*

## Project Structure

The Client CRUD implementation added the following files:

```
frontend/lib/components/
├── Modal.tsx         # Reusable modal dialog component
├── ClientForm.tsx    # Add/Edit client form with validation
└── ConfirmDialog.tsx # Delete confirmation dialog

frontend/app/clients/
└── page.tsx          # Updated with CRUD functionality
```

And modified:
```
frontend/lib/api.ts           # Added deleteClient to both real and mock APIs
frontend/lib/hooks/useApi.ts   # Added useDeleteClient hook
backend/src/db/database.ts     # Added update() and delete() functions
backend/src/routes/clients.ts  # Implemented PUT and DELETE endpoints