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
- [x] Fixed JWT expiresIn parsing (was using parseInt on "7d" string) — **runtime fixed;** the matching TypeScript errors in `backend/src/routes/auth.ts` (4× `jwt.sign(...,{ expiresIn: config.jwtExpiresIn })` call sites) are *still open* — see [Known Issues](#current-state) and [Lower Priority tasks](#lower-priority).
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

- [ ] Message scheduling (future delivery) — BullMQ supports `delay` natively; wire `scheduledAt` from the campaigns route into the queue producer and verify the worker picks up delayed jobs. **Current recommended next step** (see [Recommended next steps](#recommended-next-steps)). Gap: `POST /campaigns/:id/send` in [backend/src/routes/campaigns.ts](backend/src/routes/campaigns.ts) stamps `Message.scheduledAt` but never passes it as `delay` to `messageQueue.add(...)`. [backend/src/workers/messageWorker.ts](backend/src/workers/messageWorker.ts) polls every 60s as a fallback so messages still ship, but with up to a minute of jitter and no true delayed-delivery guarantees.
- [ ] Campaign automation (birthday, recurring) — Recurrence rules (`daily`, `weekly`, `monthly`, `cron`) + a scheduler that enqueues per-window campaign runs. Not yet scoped.

**UI polish — form readability:**

- [ ] **Match form-input text + placeholder styling to the Messages-page search input** — Field inputs in modal forms inherit body color for their filled value and render the UA-default light gray for the placeholder — both too low-contrast against the modal's white surface. The platform's canonical reference is the Messages-page search input at [frontend/app/messages/page.tsx:95](frontend/app/messages/page.tsx#L95), which uses `text-slate-700 placeholder:text-slate-400 border border-slate-300 …`. The Clients-page search follows the same pattern at [frontend/app/clients/page.tsx:167](frontend/app/clients/page.tsx#L167), but modal forms drift from this convention (no `text-*` or `placeholder:*` token on their `<input>`/`<textarea>`/`<select>`).
  - Affected: [`ClientForm.tsx`](frontend/lib/components/ClientForm.tsx) (5 inputs + textarea, ~lines 108 / 129 / 145 / 166 / 187 / 202), [`TemplateForm.tsx`](frontend/lib/components/TemplateForm.tsx) (input + select + textarea, ~lines 101 / 123 / 143), [`CampaignForm.tsx`](frontend/lib/components/campaigns/CampaignForm.tsx) (3 inputs + textarea + 2 selects + 3 audience radios, ~lines 210 / 231 / 253 / 279 / 298 / 329), [`ClientPicker.tsx`](frontend/lib/components/campaigns/ClientPicker.tsx) (search input + checkbox + checked-row label inputs, ~lines 88 / 118).
  - Recommended fix: append `text-slate-700 placeholder:text-slate-400` to every `<input>` / `<textarea>` / `<select>` className, matching the Messages-page pattern. Preserve each form's existing focus-ring accent (cyan for the create/edit-client + create/edit-campaign forms, blue for templates + send-campaign + client-picker) — those are intentional and match the surrounding CTAs.
  - Out of scope: dark-mode tokens (the app is dark-bg / widget-white today; treat as future work if a theme switcher is added).

### Lower Priority
- [ ] **Fix `jsonwebtoken@9` overload errors in [backend/src/routes/auth.ts](backend/src/routes/auth.ts)** (lines 87, 132, 178, 213). Replace `Config.jwtExpiresIn: string` with a union that satisfies `jwt.SignOptions['expiresIn']` (`number | ms.StringValue | undefined`), or cast at the four call sites: `{ expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }`. The env value `"604800"` is currently accepted at runtime; this is purely a type cleanup.
- [ ] CSV import for clients
- [ ] Bulk message sending
- [ ] Template variable preview
- [ ] Export message history
- [ ] User settings page
- [ ] Audit logs viewer

### Testing
- [ ] Backend unit tests
- [ ] Backend integration tests
- [ ] Frontend component tests
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
- Messages list and compose
- Protected routes

### Known Issues
- **`backend/src/routes/auth.ts` JWT sign() type errors** (lines 87, 132, 178, 213). All four `jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn })` calls fail `tsc --noEmit`. Cause: `Config.jwtExpiresIn: string` ([backend/src/config/index.ts:32](backend/src/config/index.ts#L32)) doesn't satisfy the narrowed `StringValue | number | undefined` overload added in `jsonwebtoken@9`. **Runtime is fine** — the env value `"604800"` is accepted as a numeric-seconds string by jsonwebtoken, which is why the runtime JWT bugfix (PROGRESS entry #1) holds. Type-cleanup fix is tracked under [Lower Priority tasks](#lower-priority). Blockers: none — `tsc` exit code is non-zero but the backend still runs and tests work.

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
   - **Out of scope (current recommended next step):** `POST /campaigns/:id/send` still stamps `Message.scheduledAt` and drops it on the floor — the worker picks due messages up via a 60s polling sweep. Wiring `scheduledAt` into the BullMQ producer's `delay` field is tracked at [Medium Priority → Message scheduling](#medium-priority).

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

1. **Wire `scheduledAt` to the BullMQ `delay` field** — Medium Priority. **Current recommended next step** after entry #15. Local change, no Twilio-side dependency, removes the 60s polling jitter on delayed deliveries. See [Medium Priority → Message scheduling](#medium-priority).
2. Settle the **number-type decision** (toll-free) and wire production Twilio env vars — Medium Priority. Prerequisite for live-SMS testing of #1's downstream effects and for MMS support.
3. MMS support implementation — Medium Priority, *after* number type is chosen.
4. ~~Wire up the Send Campaign button~~ — **Done** in entry #15 above. The Send modal + audience preview are wired against `POST /campaigns/:id/send`. `PREV_YEAR_ACTIVE` will still resolve to an empty set until #5 ships CSV import.
5. CSV import to populate `Client.taxFiledDate` — Lower Priority, but unblocks production `PREV_YEAR_ACTIVE` audiences and is the only remaining gap before the Campaigns Send button is fully useful end-to-end.
6. **Testing**: write integration tests for the new `PUT /clients/:id` (E.164 + duplicate path), `DELETE /clients/:id` (already-opted-out path), the new `POST /campaigns` (audience validation + `MANUAL`-needs-≥1-recipient), `POST /campaigns/:id/send` (audience resolution + status flip + recipient creation), and `GET /clients/count` (audience parity) *while the contracts are fresh* — before more endpoints accumulate on top.

## How to Continue

If this conversation is lost, use these steps to get up to speed:

1. **Environment**: Copy `.env.example` to `.env` in both frontend and backend dirs
2. **Database**: Run `npx prisma db push` and `npm run db:seed` in backend
3. **Start Backend**: `cd backend && npm run dev`
4. **Start Frontend**: `cd frontend && npm run dev`
5. **Login**: admin@example.com / admin123

The frontend currently connects to the real backend (NEXT_PUBLIC_USE_MOCK=false).

---

*Last Updated: July 28, 2026*

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