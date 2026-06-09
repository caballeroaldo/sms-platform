# SMS Automation Platform

A full-stack SMS automation platform designed for small businesses to automate client communication workflows such as appointment reminders, promotional campaigns, birthday messages, and seasonal notifications.

This project is being developed for a tax preparation and bookkeeping business serving 200+ clients, with the goal of replacing a third-party communication platform while reducing operational costs and improving flexibility.

---

## Features

### Client Management
- Add, edit, and delete clients
- Store customer contact information (E.164 phone format)
- Track birthdays with automatic reminders
- SMS opt-in/opt-out tracking with full consent audit trail
- **CSV import** for bulk client creation

### Message Templates
- Create and manage reusable SMS templates
- Variable support: `{{firstName}}`, `{{date}}`, `{{appointmentTime}}`
- Template categories: Appointment Reminder, Birthday, Holiday, Promotional, Tax Season
- Safe preview rendering before sending

### SMS Campaigns
- One-time campaigns to all opted-in clients
- Recurring campaigns (daily, weekly, monthly, yearly)
- Appointment reminders
- Birthday texts
- Holiday notifications
- Tax season reminders

### Message Scheduling
- Schedule future messages with precise timing
- Recurring campaigns with CRON-style schedules
- Automated birthday workflows
- Delayed message delivery

### Twilio Integration
- SMS delivery via Twilio API
- Two-way messaging (replies)
- Delivery tracking (sent, delivered, undelivered, failed)
- Incoming message webhooks
- **STOP/HELP compliance handling** (auto opt-out, help responses)

### Dashboard & Analytics
- Message delivery status and statistics
- Failed delivery tracking
- Campaign performance monitoring
- Communication logs with audit trail
- Upcoming birthdays and scheduled messages

### Security & Compliance
- JWT-based authentication with role-based access
- HttpOnly cookies for tokens
- Complete audit logging
- Webhook signature validation
- A2P 10DLC compliance support

---

## Tech Stack

### Frontend
- [Next.js](https://nextjs.org/) 16 - React Framework with App Router
- [React](https://react.dev/) 19 - UI Library
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [Tailwind CSS](https://tailwindcss.com/) v4 - Styling
- [TanStack Query](https://tanstack.com/query) v5 - Data Fetching & Caching
- [React Hook Form](https://react-hook-form.com/) - Form Management
- [Jest](https://jestjs.io/) + Testing Library - Unit Testing

### Backend
- [Node.js](https://nodejs.org/) - Runtime (ESM modules)
- [Express.js](https://expressjs.com/) 5 - Web Framework
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Password hashing
- [BullMQ](https://docs.bullmq.io/) - Job Queue
- [Prisma](https://www.prisma.io/) - Database ORM

### Database
- [PostgreSQL](https://www.postgresql.org/) - Primary Database
- [Supabase](https://supabase.com/) or [Neon](https://neon.tech/) - Database Hosting

### Queue & Scheduling
- [Redis](https://redis.io/) - Message Queue Backend
- [BullMQ](https://docs.bullmq.io/) - Job Queue

### Messaging Provider
- [Twilio](https://www.twilio.com/) - SMS API

### Deployment
- **Frontend**: [Vercel](https://vercel.com/)
- **Backend**: [Render](https://render.com/) or [Railway](https://railway.app/)
- **Redis**: [Upstash](https://upstash.com/)
- **Database**: Supabase or Neon

---

## Quick Start (Development)

The platform supports **mock mode** for both frontend and backend — no external services required to get started.

### Option 1: Frontend Only (Mock Data)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — uses built-in mock data (6 clients, 6 templates, 4 campaigns).

### Option 2: Full Stack with Mock Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs at http://localhost:4000 — falls back to in-memory mock database when `DATABASE_URL` is empty.

### Option 3: Full Stack with Real Services

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL, Redis, and Twilio credentials
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login and get JWT |
| GET | `/api/auth/me` | Get current user |

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List all clients |
| POST | `/api/clients` | Create new client |
| GET | `/api/clients/:id` | Get client details |
| PUT | `/api/clients/:id` | Update client |
| DELETE | `/api/clients/:id` | Soft delete (opt-out) |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List all templates |
| POST | `/api/templates` | Create template |
| GET | `/api/templates/:id` | Get template |
| POST | `/api/templates/preview` | Preview rendered template |
| PUT | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |

### Campaigns
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List all campaigns |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/:id` | Get campaign details |
| PUT | `/api/campaigns/:id` | Update campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign |
| POST | `/api/campaigns/:id/send` | Send campaign |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages` | List messages |
| POST | `/api/messages/send-now` | Send immediately |
| POST | `/api/messages/schedule` | Schedule for later |
| GET | `/api/messages/:id` | Get message details |

### Webhooks (Twilio)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/twilio/inbound` | Incoming SMS |
| POST | `/api/webhooks/twilio/status` | Delivery status |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Overview statistics |
| GET | `/api/dashboard/activity` | Recent activity |
| GET | `/api/dashboard/upcoming` | Upcoming messages |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│                    http://localhost:3000                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express.js)                      │
│                    http://localhost:4000                      │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   Routes    │  │  Middleware  │  │   Services         │  │
│  │  - Auth     │  │  - JWT Auth  │  │  - Twilio          │  │
│  │  - Clients  │  │  - RBAC      │  │  - SMS              │  │
│  │  - Messages │  │  - Logging   │  │                    │  │
│  │  - Webhooks │  │              │  │                    │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                                    │
          │                                    │ Queue Jobs
          ▼                                    ▼
┌──────────────────┐              ┌──────────────────────────┐
│    PostgreSQL    │              │  Background Worker       │
│   (Prisma ORM)   │              │  (BullMQ + Redis)        │
│                  │              │                          │
│  - Users         │              │  - Scheduled messages    │
│  - Clients       │              │  - Campaign processing   │
│  - Templates     │              │  - Retry failed sends    │
│  - Campaigns     │              └──────────────────────────┘
│  - Messages      │
│  - Audit Logs    │
└──────────────────┘
                                           │
                                           ▼
                                   ┌──────────────────┐
                                   │   Twilio API      │
                                   │                   │
                                   │  - Send SMS       │
                                   │  - Receive replies│
                                   │  - Webhook status │
                                   └──────────────────┘
```

---

## Development Setup

### Prerequisites

- Node.js 18+ (tested with 26)
- PostgreSQL database (optional for mock mode)
- Redis server (optional for mock mode)
- Twilio account (optional for mock mode)

### Environment Modes

The platform has three operating modes:

1. **Frontend-only**: No backend needed. Uses mock data from `frontend/lib/mockData.ts`
2. **Backend mock mode**: Backend uses in-memory database when `DATABASE_URL` is empty
3. **Full stack**: All services connected (PostgreSQL, Redis, Twilio)

View the frontend at **http://localhost:3000** to see the SMS client dashboard with:
- Stats overview (clients, messages, campaigns)
- Client list with search/filter
- Template management by category
- Campaign tracking by status
- Message history with send capabilities

---

## Folder Structure

```
sms-platform/
├── frontend/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Dashboard
│   │   ├── clients/           # Client management
│   │   ├── campaigns/          # Campaign management
│   │   ├── templates/         # Template management
│   │   └── messages/          # Message history
│   ├── lib/
│   │   ├── api.ts             # Dual-mode API client
│   │   ├── mockData.ts        # Mock data & filters
│   │   ├── types/             # TypeScript interfaces
│   │   ├── hooks/             # React Query hooks
│   │   └── components/         # UI components
│   └── tests/                 # Jest unit tests (45 passing)
│
├── backend/
│   ├── src/
│   │   ├── config/            # Environment configuration
│   │   ├── db/               # Mock database (fallback)
│   │   ├── middleware/       # Express middleware
│   │   ├── prisma/           # Prisma schema & client
│   │   ├── routes/          # API routes
│   │   ├── services/         # Twilio service
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Utilities
│   │   └── workers/          # Background workers
│   └── .env                  # Environment config
│
├── docs/
│   └── BUILD_BRIEF.md        # Implementation spec
│
└── README.md
```

---

## Data Models

### Users
| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier |
| email | String | User email (unique) |
| passwordHash | String | Bcrypt hashed password |
| role | Enum | ADMIN or USER |
| createdAt | DateTime | Creation timestamp |

### Clients
| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier |
| firstName | String | Client first name |
| lastName | String | Client last name |
| phone | String | E.164 format (+1234567890) |
| email | String? | Optional email |
| birthday | DateTime? | Birthday date |
| notes | String? | Internal notes |
| optedOut | Boolean | SMS opt-out status |

### Templates
| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier |
| name | String | Template name |
| category | Enum | Template category |
| content | String | Template with {{variables}} |

### Campaigns
| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier |
| name | String | Campaign name |
| templateId | String? | Linked template |
| status | Enum | DRAFT, SCHEDULED, RUNNING, etc. |
| scheduleTime | DateTime? | When to send |
| recurrence | Enum? | Recurring schedule |

### Messages
| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier |
| clientId | String | Recipient client |
| twilioSid | String? | Twilio message SID |
| content | String | Message body |
| status | Enum | PENDING, QUEUED, SENT, DELIVERED, FAILED |
| scheduledAt | DateTime? | Scheduled send time |
| sentAt | DateTime? | Actual send time |
| retryCount | Int | Retry attempts |

---

## Testing

### Frontend Tests
```bash
cd frontend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Current test coverage:
- 45 passing tests
- Mock data validation
- API client operations
- UI component rendering

---

## License

ISC