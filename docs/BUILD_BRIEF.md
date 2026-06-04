# SMS Automation Platform — Build Brief for Coding Agent

> Reference architecture and implementation guide for the SMS Automation Platform.

## Project Goal

Build a full-stack SMS automation platform for a small tax preparation and bookkeeping business serving about 200 clients. The system must support:

- Appointment reminders
- Birthday texts
- Holiday texts
- Promotional campaigns
- Delivery tracking
- Reply handling
- Opt-out compliance

The app should replace or reduce dependence on a third-party communication platform while improving flexibility, auditability, and security.

---

## Recommended Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form

### Backend
- Node.js
- Express.js
- TypeScript

### Database
- PostgreSQL
- Prisma ORM
- Supabase or Neon

### Queue & Scheduling
- Redis
- BullMQ

### SMS Provider
- Twilio

---

## Architecture Principles

### Core Design Goals
- Keep the frontend as a presentation layer only.
- Keep all secrets, Twilio access, database access, and Redis access on the server.
- Use asynchronous job processing for all message sending.
- Make every webhook and every send idempotent.
- Minimize client-side exposure of sensitive data.
- Prefer maintainability over premature complexity.

### Recommended Topology

Frontend → Backend API → PostgreSQL

Scheduler → Redis/BullMQ → Worker → Twilio

Twilio Webhooks → Backend → Database

---

## Frontend Requirements

### Security
- Use Server Components where possible.
- Protect authenticated routes with middleware.
- Store session tokens in secure HttpOnly cookies.
- Enable CSRF protection.
- Use a strict Content Security Policy.
- Never expose secrets in browser code.
- Never call Twilio directly from the browser.
- Redact sensitive information by default.

### UI Modules
- Dashboard
- Clients
- Templates
- Campaigns
- Message History
- Settings

---

## Backend Requirements

### Core Endpoints

- POST /auth/register
- POST /auth/login
- GET /clients
- POST /clients
- PUT /clients/:id
- DELETE /clients/:id
- GET /templates
- POST /templates
- GET /campaigns
- POST /campaigns
- POST /messages/send-now
- POST /messages/schedule
- POST /webhooks/twilio/inbound
- POST /webhooks/twilio/status

### Twilio Rules

- Use Twilio's official Node SDK.
- Validate all webhook signatures.
- Handle STOP and HELP messages.
- Store Twilio SIDs and delivery status updates.
- Use Messaging Services where appropriate.
- Support A2P 10DLC registration for production.

---

## Security Requirements

### Secrets Management

#### Development

Create:

```env
.env
.env.example
```

Never commit `.env` files.

#### Production

Store secrets in platform-managed secret stores:

- Vercel Environment Variables
- Render Secrets
- Railway Variables
- Fly.io Secrets

Never deploy plaintext `.env` files.

### Required Secrets

```env
DATABASE_URL=
REDIS_URL=
JWT_SECRET=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_PHONE_NUMBER=
TWILIO_WEBHOOK_AUTH_TOKEN=
```

Frontend:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_BASE_URL=
```

Never expose private credentials using NEXT_PUBLIC_.

---

## Core Data Model

### users
- id
- email
- password_hash
- role

### clients
- id
- first_name
- last_name
- phone
- birthday
- notes
- opted_out

### consents
- id
- client_id
- consent_type
- source
- timestamp

### templates
- id
- name
- category
- content

### campaigns
- id
- name
- schedule_time
- status

### message_attempts
- id
- twilio_sid
- status
- retry_count
- sent_at
- delivered_at

### inbound_messages
- id
- client_id
- body
- received_at

### webhook_events
- id
- event_type
- payload_hash

### audit_logs
- id
- actor
- action
- timestamp

---

## Required Flows

### Client Management
- Manual creation
- CSV import
- Phone normalization to E.164
- Consent tracking

### Template Management
- Reusable templates
- Variable support
- Safe preview rendering

### Scheduling
- One-time campaigns
- Recurring campaigns
- Birthday automation
- Appointment reminders

### Message Sending
- Queue every outbound send
- Validate consent
- Send via Twilio
- Track status

### Inbound Processing
- STOP handling
- HELP handling
- Store replies

---

## Testing Requirements

### Backend
- Unit tests
- Integration tests
- Webhook validation tests
- Opt-out tests
- Retry tests

### Frontend
- Component tests
- Route protection tests
- Sensitive-data masking tests

---

## Folder Structure

```text
sms-platform/
├── frontend/
├── backend/
├── docs/
│   └── BUILD_BRIEF.md
└── README.md
```

---

## Development Order

1. Monorepo setup
2. Environment configuration
3. Prisma schema and migrations
4. Authentication and RBAC
5. Client CRUD
6. Templates
7. Campaign scheduling
8. Twilio outbound messaging
9. Twilio webhooks
10. Queue workers
11. Dashboard analytics
12. Testing and deployment

---

## Acceptance Criteria

- Secure login
- Client management
- Template management
- Campaign scheduling
- Asynchronous SMS sending
- Delivery tracking
- STOP/HELP compliance
- Validated webhooks
- Secure secret management
- Production-ready deployment

---

## Summary

Build a secure, production-minded SMS automation platform using:

- Next.js
- Node.js
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Twilio

Prioritize:

- Security
- Client confidentiality
- Server-side control of sensitive logic
- Webhook validation
- Compliance
- Maintainability
