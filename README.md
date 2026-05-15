# SMS Automation Platform

A full-stack SMS automation platform designed for small businesses to automate client communication workflows such as appointment reminders, promotional campaigns, birthday messages, and seasonal notifications.

This project is being developed for a tax preparation and bookkeeping business serving 200+ clients, with the goal of replacing a third-party communication platform while reducing operational costs and improving flexibility.

---

# Features

## Client Management
- Add, edit, and delete clients
- Store customer contact information
- Track birthdays and notes
- Manage SMS opt-in/opt-out status

## SMS Campaigns
- Appointment reminders
- Promotional campaigns
- Birthday texts
- Holiday notifications
- Tax season reminders

## Message Scheduling
- Schedule future messages
- Recurring campaigns
- Automated birthday workflows
- Delayed message delivery

## Twilio Integration
- SMS delivery
- Two-way messaging
- Delivery tracking
- Incoming message webhooks
- STOP/HELP compliance handling

## Dashboard & Analytics
- Message delivery status
- Failed delivery tracking
- Campaign monitoring
- Communication logs

---

# Tech Stack

## Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- React Query
- React Hook Form

## Backend
- Node.js
- Express.js
- TypeScript

## Database
- PostgreSQL
- Prisma ORM
- Supabase

## Queue & Scheduling
- Redis
- BullMQ

## Messaging Provider
- Twilio API

## Deployment
- Vercel (Frontend)
- Render/Railway (Backend)
- Upstash Redis

---

# System Architecture

```text
Frontend (Next.js)
        ↓
Backend API (Node.js/Express)
        ↓
Prisma ORM
        ↓
PostgreSQL Database
        ↓
Supabase Hosting

Background Workers
        ↓
Redis + BullMQ
        ↓
Twilio SMS API