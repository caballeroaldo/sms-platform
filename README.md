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
- [Next.js](https://nextjs.org/) - React Framework
- [React](https://react.dev/) - UI Library
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [TanStack Query](https://tanstack.com/query) - Data Fetching
- [React Hook Form](https://react-hook-form.com/) - Form Management

### Backend
- [Node.js](https://nodejs.org/) - Runtime
- [Express.js](https://expressjs.com/) - Web Framework
- [TypeScript](https://www.typescriptlang.org/) - Type Safety

### Database
- [PostgreSQL](https://www.postgresql.org/) - Primary Database
- [Prisma ORM](https://www.prisma.io/) - Database ORM
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

- Node.js 18+
- PostgreSQL database
- Redis server
- Twilio account

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd sms-platform

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Environment Configuration

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
```

**Required environment variables:**

```env
# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."

# Authentication
JWT_SECRET="your-secret-key"

# Twilio
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1..."
```

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
```

### 3. Database Setup

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations (creates tables)
npm run prisma:migrate

# Or push schema directly
npm run prisma:push
```

### 4. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health Check: http://localhost:4000/api/health
- Prisma Studio: `npm run prisma:studio`

---

## Folder Structure

```
sms-platform/
├── frontend/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth pages
│   │   ├── (dashboard)/       # Dashboard pages
│   │   ├── api/               # API routes
│   │   └── page.tsx           # Landing page
│   ├── components/            # React components
│   ├── lib/                   # Utilities and API client
│   ├── hooks/                 # Custom React hooks
│   └── .env.example           # Environment template
│
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration
│   │   ├── middleware/        # Express middleware
│   │   ├── prisma/           # Prisma client & schema
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Utility functions
│   │   ├── workers/          # Background workers
│   │   └── index.ts          # Entry point
│   └── .env.example          # Environment template
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

## License

ISC