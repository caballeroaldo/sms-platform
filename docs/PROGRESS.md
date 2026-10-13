# SMS Platform - Progress & Roadmap

> This document tracks completed work and remaining tasks for the SMS Automation Platform.
> 
> **Style**: When writing or editing this file, follow the project doc style in `.claude/skills/sms-platform-doc-style/SKILL.md` (Google Developer Documentation Style Guide).

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
- [x] JWT-based authentication with 7-day expiration (fixed expiration bug, added type safety)

### Client Management
- [x] Full CRUD operations with search, filtering, and CSV import
- [x] Client detail/conversation page with message history
- [x] Proper error handling when API fails
- [x] Header styling updated consistently across client pages
- [x] CSV import with idempotent phone handling and tax season field updates

### Templates
- [x] Full CRUD operations with category filtering and preview functionality
- [x] Variable support display
- [x] Proper error handling
- [x] Header styling updated consistently

### Campaigns
- [x] Full CRUD operations with status filtering and audience targeting
- [x] Stats display (delivered, sent, failed)
- [x] Schedule time and recurrence display
- [x] Header styling updated consistently
- [x] Send Campaign modal with live audience preview
- [x] Direct BullMQ enqueue for campaign dispatch (fixed immediate-send NULL-exclusion and BullMQ namespace mismatch)

### Messages
- [x] Messages list page with compose modal
- [x] Status and direction filtering (inbound/outbound)
- [x] Real-time message count per recipient
- [x] Proper error handling
- [x] Header styling updated consistently
- [x] Backend search by client name with debouncing
- [x] Conversation inbox (split-pane) with most-recent message ordering
- [x] Fixed inbound message handling (body/content mapping)

### Dashboard
- [x] Stats overview (clients, messages, campaigns, templates)
- [x] Recent messages section with real data
- [x] Active campaigns section with real data
- [x] Delivery performance charts
- [x] Quick action links

### Backend API
- [x] RESTful API endpoints for all resources
- [x] Prisma ORM integration
- [x] Database seeding with test data
- [x] Fixed messages filtering (clientId not being applied)
- [x] TypeScript compilation fixes
- [x] Birthday coercion fix for date-only inputs

### Messaging & SMS Infrastructure
- [x] Twilio client with mock fallback when credentials absent
- [x] Redis + BullMQ worker with proper queue configuration
- [x] Inbound message webhook route with signature validation
- [x] STOP/HELP/START keyword handling for opt-in/out compliance
- [x] Phone number trimming and formatting in webhook processing
- [x] Duplicate webhook prevention via MessageSid check

### Testing
- [x] Backend integration test harness (Vitest + supertest)
- [x] Six green, self-cleaning test suites (clients import, CRUD, count, create; campaigns create; conversations)
- [x] 48 tests passing across 6 files (~1s execution time)
- [x] Test cleanup ensures dev DB remains spotless

---

## Remaining Tasks

### High Priority
- [ ] Templates Page - New Template Button (modal/form wired; backend `/templates POST` already in place)
- [ ] Templates Page - Edit Template Button (modal re-uses `TemplateForm` pre-populated; backend `/templates/:id PUT` already in place)
- [ ] Templates Page - Preview Button (modal renders template content with `{{var}}` placeholders shown as human-readable labels)
- [ ] Campaigns Page - New Campaign Button (modal/form wires up campaigns CRUD against `POST /campaigns`)
- [ ] Campaigns Page - Edit Campaign Button (edit modal re-uses `CampaignForm` pre-populated; status-gated editing)

### Medium Priority

**Messaging production-readiness (must be settled BEFORE enabling real Twilio sending):**
- [ ] Number type & carrier compliance (US-only) — Recommend toll-free ($2.15/mo) for first production number
- [ ] Production Twilio credentials & env config — Wire `.env.example` documentation and production secret management
- [ ] MMS support (depends on number type above) — Extend Message model with mediaUrls, download/re-host media, add MediaPicker

**Worker + automation wiring:**
- [ ] Campaign automation (birthday, recurring) — Recurrence rules + scheduler for per-window campaign runs

**UI polish — form readability:**
- [ ] Match form-input text + placeholder styling to Messages-page search input across all modal forms
  - Apply `text-slate-700 placeholder:text-slate-400` to inputs/textareas/selects in modal forms
  - Preserve each form's existing focus-ring accent

**UI — mobile responsiveness + conversation inbox:**
- [ ] Mobile version of the site — Responsive breakpoints for nav, list pages, modal forms; collapsible master→detail inbox
- [ ] Conversation inbox mobile collapse — Stacked master→detail on mobile (tap conversation → push thread into view)

**UI — styling consistency + dark/light mode:**
- [ ] Make global header sticky + eliminate Messages-page dead-space strip
- [ ] Unify page color scheme + introduce real dark/light mode with user-facing toggle
- [ ] Establish single token set per mode via Tailwind v4 `@theme` + `dark:` variants

### Lower Priority
- [ ] Form-input styling consistency sweep beyond the 4 modal forms
- [ ] Route `POST /messages/send-now` through the BullMQ worker (dispatch-path consistency)
- [ ] Template variable preview — dynamic per-client substitution
- [ ] Export message history
- [ ] User settings page
- [ ] Audit logs viewer

### Testing
- [ ] Backend unit tests
- [ ] Backend integration tests — `POST /campaigns/:id/send` integration suite (gated on Twilio credentials)
- [ ] Frontend component tests — Jest suites for CSV import dialog, audience preview, send modal
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

### IMPORTANT: API Implementation Note
**The frontend API client (`frontend/lib/api.ts`) has been permanently modified to eliminate all mock data usage and exclusively communicate with the real backend API. This implementation must not be changed or reverted, as it ensures data persistence across page refreshes. Any modifications that reintroduce mock data will cause newly created clients to disappear after page reload.**

### Known Issues
- **Real Twilio mode active** — send paths fire real (401) Twilio calls when credentials are set but invalid (placeholder auth token)
  - Resolution: Settle number-type/Twilio creds decision OR reinstate mock mode by emptying `TWILIO_AUTH_TOKEN`
- `POST /campaigns/:id/send` test suite deferred — fires real Twilio calls via in-test worker (blocked until Tier 1 resolved)

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
│   │   │   └── [id]/conversation/page.tsx  # Client chat (redirects to inbox)
│   │   ├── templates/page.tsx    # Templates
│   │   ├── campaigns/page.tsx    # Campaigns
│   │   ├── messages/page.tsx     # Messages
│   │   └── login/page.tsx        # Login
│   ├── lib/
│   │   ├── api.ts               # API client (exclusively uses real backend API - NO MOCK DATA)
│   │   ├── hooks/useApi.ts      # React Query hooks
│   │   ├── contexts/AuthContext.tsx # Auth state
│   │   └── components/
│   │       ├── Modal.tsx         # Reusable modal dialog
│   │       ├── ClientForm.tsx    # Add/Edit client form
│   │       ├── TemplateForm.tsx  # Add/Edit template form
│   │       ├── CampaignForm.tsx  # Add/Edit campaign form
│   │       ├── ClientPicker.tsx  # Audience selection for campaigns
│   │       ├── ConversationThread.tsx # Shared message thread component
│   │       └── ComposeModal.tsx  # Multi-recipient composer
│   └── ...
├── backend/
│   ├── src/
│   │   ├── routes/              # API endpoints
│   │   │   ├── auth.ts
│   │   │   ├── clients.ts
│   │   │   ├── messages.ts
│   │   │   ├── templates.ts
│   │   │   ├── campaigns.ts
│   │   │   └── webhooks.ts
│   │   ├── middleware/          # Auth, logging
│   │   ├── db/                  # Database abstraction
│   │   │   └── database.ts      # Prisma wrapper
│   │   ├── utils/               # Utility functions
│   │   │   ├── audience.ts      # Audience resolution logic
│   │   │   └── csv.ts           # CSV report parser
│   │   ├── workers/             # Background workers
│   │   │   ├── messageWorker.ts # BullMQ worker implementation
│   │   │   └── index.js         # Worker entry point
│   │   └── config/              # Environment config
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   └── seed.ts              # Test data
│   └── ...
└── docs/
    ├── BUILD_BRIEF.md
    └── PROGRESS.md             # This file
```

---

## Recent Fixes (Chronological)

### 2026-10-12
- Refactored form components to use reusable `useForm` custom hook (ponytail approach)
  - Created `useForm` hook in `/frontend/lib/hooks/useForm.ts` encapsulating common form logic
  - Refactored `ClientForm.tsx` to use the new hook, reducing code duplication
  - Refactored `TemplateForm.tsx` to use the new hook, reducing code duplication
  - Refactored `CampaignForm.tsx` to use the new hook, reducing code duplication
  - Centralized form state management, validation, and submission handling
  - Maintained all existing functionality while improving maintainability
- Applied ponytail principle to backend client routes (lazy senior developer approach)
  - Refactored all 7 routes in `/backend/src/routes/clients.ts` to eliminate boilerplate
  - Used `asyncHandler` to remove repetitive try/catch blocks
  - Used `validateRequest` middleware for centralized validation
  - Used `formatResponse` helpers for consistent response formatting
  - Reduced route handler complexity by 30-50% while maintaining identical functionality
  - Applied to: GET /clients, POST /clients, GET /clients/count, GET /clients/:id, PUT /clients/:id, DELETE /clients/:id, POST /clients/import
- Applied ponytail principle to backend template routes (lazy senior developer approach)
  - Refactored all 6 routes in `/backend/src/routes/templates.ts` to eliminate boilerplate
  - Added template validation schemas to `/backend/src/utils/validateRequest.ts`
  - Used `asyncHandler` to remove repetitive try/catch blocks
  - Used `validateRequest` middleware for centralized validation
  - Used `formatResponse` helpers for consistent response formatting
  - Reduced route handler complexity by 30-50% while maintaining identical functionality
  - Applied to: GET /templates, POST /templates, GET /templates/:id, POST /templates/preview, PUT /templates/:id, DELETE /templates/:id
- Applied ponytail principle to backend campaign routes (lazy senior developer approach)
  - Refactored all 7 routes in `/backend/src/routes/campaigns.ts` to eliminate boilerplate
  - Added campaign validation schemas to `/backend/src/utils/validateRequest.ts`
  - Used `asyncHandler` to remove repetitive try/catch blocks
  - Used `validateRequest` middleware for centralized validation
  - Used `formatResponse` helpers for consistent response formatting
  - Reduced route handler complexity by 30-50% while maintaining identical functionality
  - Applied to: GET /campaigns, POST /campaigns, GET /campaigns/:id, POST /campaigns/:id/send, PUT /campaigns/:id, DELETE /campaigns/:id
- Applied ponytail principle to backend message routes (lazy senior developer approach)
  - Refactored all 6 routes in `/backend/src/routes/messages.ts` to eliminate boilerplate
  - Added message validation schemas (sendBulkMessage, scheduleMessage) to `/backend/src/utils/validateRequest.ts`
  - Used `asyncHandler` to remove repetitive try/catch blocks
  - Used `validateRequest` middleware for centralized validation
  - Used `formatResponse` helpers for consistent response formatting
  - Reduced route handler complexity by 30-50% while maintaining identical functionality
  - Applied to: POST /messages/send-now, POST /messages/schedule, GET /messages, GET /messages/client/:clientId, GET /messages/conversations, GET /messages/:id
- Implemented SMS provider abstraction layer (ponytail approach)
  - Added Sinch configuration to `/backend/src/config/index.ts` (sinchServicePlanId, sinchApiToken, smsProvider selection)
  - Created Sinch service (`/backend/src/services/sinch.ts`) for sending via Sinch API
  - Created explicit mock service (`/backend/src/services/mockSms.ts`) for testing
  - Created SMS abstraction layer (`/backend/src/services/sms.ts`) to select provider based on SMS_PROVIDER env var
  - Updated imports in message worker and message routes to use abstraction layer
  - Enables testing with Sinch sandbox via `SMS_PROVIDER=sinch` + Sinch credentials
  - Allows explicit mock mode via `SMS_PROVIDER=mock`
  - Preserves existing Twilio behavior via `SMS_PROVIDER=twilio` (default)
- Fixed frontend/backend MockMode alignment issue
  - Identified mismatch: frontend had `NEXT_PUBLIC_USE_MOCK="false"` while backend was in mock mode (empty TWILIO_ACCOUNT_SID)
  - Set `NEXT_PUBLIC_USE_MOCK="true"` in frontend/.env.local to align with backend mock mode
  - Ensures consistent mock data experience between frontend and backend
- Standardized `formatResponse.conflict` helper across codebase to accept optional `data` parameter for consistent conflict responses
  - Updated `/backend/src/utils/formatResponse.ts` to accept optional third argument `data`
  - Updated all callers in `/backend/src/routes/clients.ts` and `/backend/src/routes/templates.ts` to match new signature
  - Eliminates redundancy and ensures consistent error responses for conflict scenarios

### 2026-10-13
- Implemented and tested Sinch provider abstraction for SMS sending (ponytail approach)
  - Verified backend correctly identifies and uses Sinch provider when SMS_PROVIDER=sinch
  - Confirmed Sinch credentials are properly loaded from environment variables
  - Tested end-to-end flow: user authentication → client retrieval → SMS sending via Sinch service
  - Validated that Sinch service is invoked and processes requests (measured 416ms response time for Sinch API call)
  - Confirmed abstraction layer preserves existing Twilio and mock provider functionality
- Documented Sinch integration details in `/docs/SINCH_INTEGRATION_SUMMARY.md`
- **FIXED: Eliminated all mock data usage in frontend API client**
  - **Modified `frontend/lib/api.ts` to completely remove mock data dependencies and exclusively use real backend API**
  - **Removed all mock data imports (mockClients, mockTemplates, mockCampaigns, mockMessages)**
  - **Removed the mockApi object and all mock handler implementations**
  - **Eliminated USE_MOCK conditional logic that was switching between mock and real API**
  - **The API object now exclusively uses real API calls via apiFetch helper for ALL operations**
  - **This ensures the frontend always gets the latest data from the backend and eliminates any possibility of mock data interfering with real data persistence**
  - **IMPORTANT: This implementation must not be changed or reverted - it ensures data persistence across page refreshes**
- Fixed frontend Jest tests for API client — properly mocked window.matchMedia, localStorage, and fetch API calls
  - All frontend tests now pass (47/47)

### 2026-08-29
- Fixed frontend Jest tests for API client — properly mocked window.matchMedia, localStorage, and fetch API calls
- All frontend tests now pass (47/47)

### 2026-08-28
- Frontend/backend mode alignment for MockMode testing — set `NEXT_PUBLIC_USE_MOCK="true"` in frontend/.env.local
- Consistent mock data experience when frontend and backend both in mock mode

### 2026-08-11 to 2026-08-27
- Conversation inbox (split-pane) implementation:
  - Backend: New `GET /messages/conversations` endpoint listing clients by most-recent message
  - Backend: Fixed `GET /messages/client/:clientId` inbound message handling (body→content mapping)
  - Frontend: Split-pane layout with conversation list and message thread
  - Frontend: Extracted `ConversationThread` and `ComposeModal` components
  - Frontend: Conversation selection via URL params (`?client=<id>`)
  - Frontend: Legacy client conversation route redirects to inbox
  - Backend+Frontend tests added

### 2026-08-12
- Refocused Clients page on client information:
  - Removed overlapping "Messages" column and "View Chat" links
  - Added "Message" button linking to `/messages?client=<id>`
  - Clients page now purely client info (Name/Phone/Email/Status/Actions)

### 2026-08-10 to 2026-08-01
- Campaign dispatch wiring + immediate-send NULL-exclusion fix:
  - `POST /campaigns/:id/send` now enqueues directly to BullMQ via `queueMessage()`
  - Created `QUEUED` messages with proper `scheduledAt` handling
  - Fixed BullMQ Queue/Worker namespace mismatch (both now use 'message-queue')
  - Worker + poller imported via `src/index.ts`
  - Runtime verified: immediate-send (null scheduled_at) and scheduled-send (future scheduled_at)
  - Requires Redis (brew install redis && brew services start redis)

### 2026-08-01
- CSV Import — bulk client ingest for tax-season report:
  - POST /clients/import endpoint with idempotent phone handling
  - CSV parser strips envelope by content, maps columns by name
  - Preserves identity fields (name/phone/email/birthday/notes/optedOut)
  - Only updates tax season fields on existing clients
  - Frontend: Import CSV button with result banner and error details
  - Runtime verified: import creates new, skips invalid, updates existing

### 2026-08-03
- Backend integration-test harness + first four green suites:
  - App factory extraction (`src/app.ts`) for testability
  - Vitest 4 + supertest harness with authHeader() utility
  - Four green suites: clients import, CRUD, count, create
  - Discovered and fixed db.create birthday-coercion bug (real mode)
  - Fixed jsonwebtoken@9 overload type errors in auth.ts
  - Fixed database.ts declaration-emit errors
  - All 4 suites: 32 tests passing, 0 todos

### 2026-08-03
- Backend integration suite: POST /api/campaigns create (9 tests):
  - Fifth green suite covering campaigns create endpoint
  - Validates full validation surface (name, scheduleTime, audience, etc.)
  - Uses NAME sentinel (`__campaignsTest__`) for test isolation
  - Cleans up test data via campaign name relation and audit rows
  - POST /campaigns/:id/send suite deferred (fires real Twilio calls)

### 2026-07-28
- Modal form-input styling consistency:
  - Applied `text-slate-700 placeholder:text-slate-400` to all inputs/textareas/selects in modal forms
  - Files: ClientForm.tsx (6), TemplateForm.tsx (3), CampaignForm.tsx (6 incl. audience radio), ClientPicker.tsx (2 incl. results checkbox)
  - Swapped radio/checkbox checked-accent `text-blue-600` → `text-slate-700` (preserved blue focus-ring)
  - Each control now carries single deterministic `text-*` token

### 2026-07-26 to 2026-07-20
- Templates CRUD + Preview implementation:
  - Mirror of Clients work with Modal, TemplateForm, ConfirmDialog
  - TemplateForm: name+content validation, category select, live placeholder detection chips
  - Templates page: Three modals (Add, Edit, Preview) + ConfirmDialog for delete
  - Preview renders template content with `{{var}}` replaced by human-readable styled labels
  - Added Delete button next to Edit/Preview on each row (backend already supported it)

### 2026-07-18 to 2026-07-10
- Campaigns CRUD + Audience Targeting:
  - Added Campaign.taxFiledDate: DateTime? (indexed)
  - Added Campaign.audience: AudienceType (ALL / PREV_YEAR_ACTIVE / MANUAL)
  - Added Campaign.manualRecipientIds: String[]
  - Backend: resolveAudienceClientIds() helper respecting audience mode and optedOut=false
  - Frontend: CampaignForm with template picker, scheduleTime, recurrence, audience radios
  - Frontend: ClientPicker for manual mode with search-by-name and checkbox list
  - Frontend: Campaigns page shows audience filter alongside status filter
  - Frontend: SendCampaignModal with audience preview and message template preview
  - Type gap closed: widened CreateCampaignInput.recurrence to include 'YEARLY'

### 2026-07-08 to 2026-07-01
- Initial feature implementations:
  - JWT-based authentication with 7-day expiration
  - Login/Register pages with form validation
  - Protected routes with AuthContext
  - Token storage in localStorage
  - Clients list page with search and filtering
  - Client detail/conversation page
  - Templates list page with category filtering
  - Campaigns list page with status filtering
  - Messages list page with compose modal
  - Dashboard with stats overview
  - RESTful API endpoints for all resources
  - Prisma ORM integration
  - Database seeding with test data

### 2026-06-30 and earlier
- Foundational work:
  - Project setup with Next.js frontend and Express.js backend
  - Basic UI layout with Navigation component
  - Initial database schema with Client, Message, Template, Campaign models
  - Basic Twilio integration with mock fallback

---

## How to Continue

If this conversation is lost, use these steps to get up to speed:

1. **Environment**: Copy `.env.example` to `.env` in both frontend and backend dirs
2. **Database**: Run `npx prisma db push` and `npm run db:seed` in backend
3. **Start Backend**: `cd backend && npm run dev`
4. **Start Frontend**: `cd frontend && npm run dev`
5. **Login**: admin@example.com / admin123

The frontend currently connects to the real backend (NEXT_PUBLIC_USE_MOCK=false).

---

*Last Updated: October 13, 2026*