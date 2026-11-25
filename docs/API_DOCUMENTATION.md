# Talkar Universal Spaces, Assets & Visit Booking CRM — API & Architecture Manual

Comprehensive developer, telephony, and systems reference manual for **`talkar-spaces-crm`**, the multi-tenant Spaces, Assets, and Site Visit Booking platform powered by **Talkar Autonomous Voice AI (Riya)**.

Served locally on **Port `7578`** and configured for production at **`https://spaces.talkar.in`** (Target Server IP: `80.225.241.81`).

---

## Table of Contents
1. [Architecture & System Design](#1-architecture--system-design)
2. [Dual-Track Conversion Model](#2-dual-track-conversion-model)
3. [Multi-Tenant Database Schema](#3-multi-tenant-database-schema)
4. [REST API Specifications](#4-rest-api-specifications)
   - [4.1 Health & Diagnostics](#41-health--diagnostics)
   - [4.2 Organizations (Tenants)](#42-organizations-tenants)
   - [4.3 Catalog & Grounding](#43-catalog--grounding)
   - [4.4 Track 1: Desk & Meeting Room Bookings](#44-track-1-desk--meeting-room-bookings)
   - [4.5 Track 2: Site Visits & In-Person Tours](#45-track-2-site-visits--in-person-tours)
   - [4.6 Lead Intelligence & Progressive Slot Filling](#46-lead-intelligence--progressive-slot-filling)
   - [4.7 Webhooks & Inbound Gateways](#47-webhooks--inbound-gateways)
5. [Real-Time Server-Sent Events (SSE) Stream](#5-real-time-server-sent-events-sse-stream)
6. [Decoupled WhatsApp & n8n Architecture](#6-decoupled-whatsapp--n8n-architecture)
7. [Talkar Voice AI Agent & Tool Mappings](#7-talkar-voice-ai-agent--tool-mappings)
8. [MCP (Model Context Protocol) Server](#8-mcp-model-context-protocol-server)
9. [Verification & Telephony Testing Suite](#9-verification--telephony-testing-suite)

---

## 1. Architecture & System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CALLER & VOICE AI INTERFACES                          │
│   • Inbound/Outbound Telephony (Voice AI Advisor Riya - Workflow 127)      │
│   • Modern Spaces SaaS Operations Board (spaces.talkar.in - Port 7578)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 TALKAR SPACES CRM BACKEND (Port 7578)                       │
│   • Express / TypeScript Modular Micro-Engine                               │
│   • Prisma ORM / SQLite Persistence (Zero secret storage)                   │
│   • Real-Time Server-Sent Events (SSE) Stream (/api/v1/events/stream)       │
│   • Dual-Track Engine: Instant Hold/Checkout vs Site Visit Scheduling      │
│   • Post-Call Telephony Webhook Receiver (/api/v1/webhooks/call-completed) │
└──────────────┬──────────────────────────────────────────────┬───────────────┘
               │                                              │
               ▼                                              ▼
┌──────────────────────────────────────┐       ┌──────────────────────────────┐
│  Universal Production n8n Gateways   │       │  Static Collateral & Media   │
│  • send-spaces-visit-confirmed       │       │  • PDF Space Layouts         │
│  • send-spaces-booking-confirmed     │       │  • Centre Photo Assets       │
│  • send-spaces-payment-link          │       │  • Google Maps Location Pin  │
│  Meta Cloud API Graph v23.0          │       │                              │
└──────────────────────────────────────┘       └──────────────────────────────┘
```

---

## 2. Dual-Track Conversion Model

Talkar Spaces CRM supports two distinct conversion paths tailored to how commercial workspaces and venues close revenue:

```
                          Incoming Caller Enquiry
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
     [TRACK 1: SHORT-TERM]                   [TRACK 2: LONG-TERM]
   Instant Booking & Checkout               High-Touch Site Visit
  • Day Passes                             • Private Executive Cabins
  • Hourly Meeting Rooms (6-14 Pax)        • Dedicated Desks (Monthly)
  • Event Spaces / Boardrooms              • Managed Enterprise Suites (20+ Pax)
                 │                                       │
                 ▼                                       ▼
    15-Min Temporary Slot Hold              Scheduled Tour with Centre Host
         (HOLDS INVENTORY)                  (Host Phone Notified via WhatsApp)
                 │                                       │
                 ▼                                       ▼
     WhatsApp Razorpay Payment Link            WhatsApp Visit Pass & Maps Pin
                 │                                       │
                 ▼                                       ▼
         Confirmed Booking                       In-Person Visit & Proposal
```

---

## 3. Multi-Tenant Database Schema

The database model is defined in `prisma/schema.prisma` and persisted in SQLite (`prisma/dev.db`).

### Core Entities:
1. **`Organization`**: Represents a multi-tenant business (e.g., `elite-coworks`).
   - Fields: `id`, `slug` (unique), `name`, `brand`, `industry`, `tagline`, `description`, `phone`, `email`, `website`, `currency`, `timezone`, `locationNoun`, `assetNoun`, `visitNoun`, `visitCodePrefix`, `pipelineStages`, `scoringRules`, `customFieldsSchema`, `isActive`.
2. **`Location`**: Physical centres or project sites (e.g., BTM Layout, Koramangala).
   - Fields: `id`, `organizationId`, `code`, `name`, `address`, `city`, `state`, `postalCode`, `mapCoordinates`, `googleMapsUrl`, `operatingHours`, `managerName`, `managerPhone`, `managerEmail`, `amenities`, `photos`, `isActive`.
3. **`Asset`**: Sellable workspace units, rooms, or plans.
   - Fields: `id`, `organizationId`, `locationId`, `code`, `name`, `category` (`SHORT_TERM` | `LONG_TERM`), `description`, `pricingUnit`, `startingPrice`, `capacityPax`, `totalInventory`, `bookingMode` (`INSTANT_PAY` | `SITE_VISIT` | `SALES_HANDOFF`), `amenities`, `photos`, `brochurePdfUrl`, `isActive`.
4. **`Lead`**: Unified contact profile with caller score, stage, and telephony notes.
   - Fields: `id`, `organizationId`, `phone`, `name`, `email`, `companyName`, `stage`, `leadScore`, `temperature` (`HOT` | `WARM` | `COLD`), `intent`, `budget`, `teamSize`, `moveInDate`, `lastCallRunId`, `lastCallSummary`, `recordingConsent`, `customFields`.
5. **`Booking`**: Track 1 reservations with inventory hold and billing breakdown.
   - Fields: `id`, `organizationId`, `locationId`, `assetId`, `leadId`, `bookingReference`, `date`, `startTime`, `durationHours`, `paxCount`, `subtotal`, `taxAmount`, `totalAmount`, `currency`, `status` (`HELD` | `CONFIRMED` | `CANCELLED` | `EXPIRED`), `holdExpiresAt`, `paymentLinkUrl`, `source`, `callRunId`.
6. **`SiteVisit`**: Track 2 scheduled in-person tours and recce appointments.
   - Fields: `id`, `organizationId`, `locationId`, `leadId`, `reference` (`VISIT-XXXX`), `visitDate`, `timeSlot`, `status` (`SCHEDULED` | `COMPLETED` | `CANCELLED` | `NO_SHOW`), `assignedHostName`, `assignedHostPhone`, `notes`, `source`, `callRunId`.
7. **`AuditLog`**: Complete append-only timeline of bookings, visits, and telephony state updates.

---

## 4. REST API Specifications

### Base URLs:
- **Local:** `http://localhost:7578`
- **Production:** `https://spaces.talkar.in`

---

### 4.1 Health & Diagnostics

#### `GET /health` or `GET /api/v1/health`
Check service health and uptime status.
```json
{
  "status": "ok",
  "service": "talkar-spaces-crm",
  "version": "1.0.0",
  "port": 7578,
  "timestamp": "2026-11-25T09:47:00.000Z"
}
```

---

### 4.2 Organizations (Tenants)

#### `GET /api/v1/organizations`
List all active organizations.
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "uuid",
      "slug": "elite-coworks",
      "name": "Elite Co-Works",
      "industry": "COWORKING",
      "phone": "+918147446929",
      "locations": [ ... ]
    }
  ]
}
```

#### `GET /api/v1/organizations/:slug`
Fetch full profile of an organization including locations and assets.

#### `POST /api/v1/organizations`
Register a new workspace or enterprise tenant.
```json
{
  "name": "Hive Workspaces",
  "slug": "hive-workspaces",
  "industry": "COWORKING",
  "locationNoun": "Campus",
  "assetNoun": "Workspace Suite",
  "visitNoun": "Campus Tour",
  "phone": "+919876543210",
  "email": "sales@hiveworkspaces.com",
  "currency": "INR"
}
```

#### `DELETE /api/v1/organizations/:slug`
Delete an organization and cascade clean all its locations, assets, leads, and bookings.

---

### 4.3 Catalog & Grounding

#### `GET /api/v1/organizations/:slug/catalog`
Returns catalog data optimized for Talkar Voice AI prompt grounding.
- **Query Params:**
  - `location` *(optional)*: Filter by location code (e.g. `BTM`, `JPN`).
- **Response:**
```json
{
  "success": true,
  "data": {
    "organization": {
      "name": "Elite Co-Works",
      "brand": "Premium Executive Workspaces",
      "tagline": "Modern, high-productivity workspaces across Bengaluru"
    },
    "locations": [
      {
        "code": "BTM",
        "name": "BTM Layout 1st Stage",
        "address": "5a, 1A Cross Rd, Dollar Scheme Colony, BTM 1st Stage, Bengaluru 560068",
        "googleMapsUrl": "https://maps.google.com/?q=Elite+CoWorks+BTM",
        "managerName": "Kavita Reddy",
        "managerPhone": "+918147446929"
      }
    ],
    "assets": [
      {
        "code": "DAY",
        "name": "Day Pass (Single Seat)",
        "category": "SHORT_TERM",
        "startingPrice": 350,
        "pricingUnit": "per day",
        "capacityPax": 1,
        "bookingMode": "INSTANT_PAY",
        "amenities": ["High-Speed WiFi", "AC", "Unlimited Tea & Coffee"]
      },
      {
        "code": "CABIN",
        "name": "Private Executive Cabin (4-12 Seats)",
        "category": "LONG_TERM",
        "startingPrice": 7500,
        "pricingUnit": "per seat / month",
        "capacityPax": 6,
        "bookingMode": "SITE_VISIT",
        "amenities": ["Biometric Lock", "Acoustic Insulation", "Dedicated Router"]
      }
    ]
  }
}
```

#### `GET /api/v1/organizations/:slug/dashboard`
Returns live operational data, KPI metrics, tab counts, and recent bookings/visits for the Pitch Board UI.

---

### 4.4 Track 1: Desk & Meeting Room Bookings

#### `GET /api/v1/organizations/:slug/bookings/availability`
Check real-time slot and inventory availability.
- **Query Params:**
  - `location`: Location code (e.g. `BTM`)
  - `asset`: Asset code (e.g. `CONF`, `MTG`, `DAY`)
  - `date`: `YYYY-MM-DD`
  - `startTime`: e.g. `14:00`
  - `duration`: Duration in hours (e.g. `2`)
  - `pax`: Number of seats/attendees (e.g. `6`)
- **Response:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "remainingInventory": 1,
    "asset": {
      "code": "CONF",
      "name": "Boardroom & Conference Hall (14 Pax)",
      "startingPrice": 1200,
      "pricingUnit": "per hour"
    },
    "pricingEstimate": {
      "subtotal": 2400,
      "taxAmount": 432,
      "totalAmount": 2832,
      "currency": "INR",
      "taxRatePercent": 18
    }
  }
}
```

#### `POST /api/v1/organizations/:slug/bookings/hold`
Places a 15-minute temporary inventory hold and generates a payment link.
- **Request Body:**
```json
{
  "locationCode": "BTM",
  "assetCode": "CONF",
  "date": "2026-11-26",
  "startTime": "14:00",
  "durationHours": 2,
  "paxCount": 8,
  "phone": "9827953551",
  "name": "Rahul Verma",
  "email": "rahul.verma@example.com"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "bookingReference": "BK-8291",
  "status": "HELD",
  "subtotal": 2400,
  "taxAmount": 432,
  "totalAmount": 2832,
  "currency": "INR",
  "holdExpiresAt": "2026-11-25T10:15:00.000Z",
  "paymentLinkUrl": "https://pay.talkar.in/bk/BK-8291"
}
```

#### `POST /api/v1/organizations/:slug/bookings/confirm`
Manually or programmatically confirm a held booking.
- **Request Body:**
```json
{
  "bookingReference": "BK-8291",
  "gatewayRef": "pay_O7dZ1904Klmd"
}
```

#### `GET /api/v1/organizations/:slug/bookings`
List the 50 most recent bookings for the organization.

---

### 4.5 Track 2: Site Visits & In-Person Tours

#### `POST /api/v1/organizations/:slug/visits/book`
Schedule a guided in-person tour for an executive cabin, team suite, or enterprise floor.
- **Request Body:**
```json
{
  "locationCode": "BTM",
  "phone": "9827953551",
  "name": "Arnav Gupta",
  "email": "arnav@company.com",
  "date": "2026-11-27",
  "timeSlot": "11:30 AM",
  "notes": "Interested in 6-seater private cabin with high-speed fiber internet"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "reference": "VISIT-4091",
  "status": "SCHEDULED",
  "visitDate": "2026-11-27",
  "timeSlot": "11:30 AM",
  "location": "BTM Layout 1st Stage",
  "hostName": "Kavita Reddy",
  "data": { ... }
}
```
*(Automatically triggers WhatsApp Visit Confirmation Pass via n8n webhook `send-spaces-visit-confirmed`)*.

#### `PATCH /api/v1/organizations/:slug/visits/reschedule`
Reschedule an existing site visit appointment.
- **Request Body:**
```json
{
  "reference": "VISIT-4091",
  "newDate": "2026-11-28",
  "newTimeSlot": "03:00 PM"
}
```

#### `GET /api/v1/organizations/:slug/visits`
List recent site visits with assigned host details and lead information.

---

### 4.6 Lead Intelligence & Progressive Slot Filling

#### `GET /api/v1/organizations/:slug/leads/lookup`
Called by the telephony pre-call hook (`N0`) as soon as a prospective member's phone rings.
- **Query Params:** `phone=9827953551`
- **Response:**
```json
{
  "success": true,
  "data": {
    "isKnown": true,
    "lead": {
      "id": "uuid",
      "name": "Arnav Gupta",
      "phone": "+919827953551",
      "companyName": "TechSolutions Pvt Ltd",
      "stage": "VISIT_BOOKED",
      "leadScore": 75,
      "temperature": "HOT",
      "intent": "CABIN_6_SEATS",
      "activeVisits": [ ... ],
      "activeBookings": [ ... ]
    }
  }
}
```

#### `POST /api/v1/organizations/:slug/leads/upsert`
Progressively updates lead qualifications during or after a conversation.
- **Request Body:**
```json
{
  "phone": "9827953551",
  "name": "Arnav Gupta",
  "companyName": "TechSolutions",
  "intent": "CABIN_6_SEATS",
  "customFields": {
    "seatsRequired": 6,
    "targetLocation": "BTM Layout",
    "budgetPerSeat": 7500,
    "moveInTimeline": "Immediate"
  },
  "summary": "Looking for private acoustic cabin for 6 engineers starting next Monday."
}
```

#### `PATCH /api/v1/organizations/:slug/leads/:id/stage`
Updates the lead lifecycle stage (`NEW` &rarr; `QUALIFIED` &rarr; `VISIT_BOOKED` &rarr; `VISITED` &rarr; `PROPOSAL` &rarr; `WON` &rarr; `LOST`).

#### `GET /api/v1/organizations/:slug/leads`
List leads ranked by lead score and recency.

---

### 4.7 Webhooks & Inbound Gateways

#### `POST /api/v1/webhooks/payment`
Receives payment gateway notifications (Razorpay, Cashfree, Stripe). Confirms the slot hold and triggers the WhatsApp booking pass.

#### `POST /api/v1/webhooks/call-completed`
Fired by Talkar Telephony as soon as Riya hangs up.
- **Request Body:**
```json
{
  "organizationSlug": "elite-coworks",
  "callerPhone": "9827953551",
  "callerName": "Arnav Gupta",
  "summary": "Inquired about meeting room and confirmed site visit for BTM cabin.",
  "recordingUrl": "https://storage.talkar.in/recordings/call_abc123.mp3",
  "callRunId": "call_abc123",
  "slots": {
    "intent": "CABIN_6_SEATS",
    "seats": 6
  }
}
```

#### `POST /api/v1/webhooks/web-form`
Ingests website lead forms and immediately queues an outbound Talkar AI advisor call.

---

## 5. Real-Time Server-Sent Events (SSE) Stream

- **Endpoint:** `GET /api/v1/events/stream?organization=elite-coworks`
- **Headers:** `Accept: text/event-stream`

### Broadcast Event Types:
| Event Name | Trigger | Payload Summary |
| :--- | :--- | :--- |
| `connected` | Initial client connection handshake | `{ clientId, status: "connected" }` |
| `call:state` | Telephony state changes & live audio waveforms | `{ state: "RINGING" \| "CONNECTED" \| "COMPLETED", callerPhone, summary, leadScore }` |
| `visit:updated` | Site visit booked, rescheduled, or cancelled | Full `SiteVisit` record |
| `booking:updated` | Temporary hold created, paid, or expired | Full `Booking` record |
| `lead:updated` | Lead stage updated or score calculated | Full `Lead` record |

The Pitch Board dashboard automatically subscribes to this stream for zero-refresh real-time updates.

---

## 6. Decoupled WhatsApp & n8n Architecture

All WhatsApp Cloud API messages are decoupled through Universal Production n8n Webhooks. Credentials are isolated inside n8n:

### 1. Site Visit Confirmation
- **Webhook:** `POST https://n8n.talkar.in/webhook/send-spaces-visit-confirmed`
- **Workflow ID:** `FYDXCGheCtR9oTCc`
- **Payload:**
```json
{
  "phone": "9827953551",
  "callerName": "Arnav Gupta",
  "visitReference": "VISIT-4091",
  "locationName": "BTM Layout 1st Stage",
  "address": "5a, 1A Cross Rd, Dollar Scheme Colony, BTM 1st Stage",
  "visitDate": "2026-11-27",
  "timeSlot": "11:30 AM",
  "hostName": "Kavita Reddy",
  "hostPhone": "+918147446929",
  "googleMapsUrl": "https://maps.google.com/?q=Elite+CoWorks+BTM"
}
```

### 2. Instant Booking Pass
- **Webhook:** `POST https://n8n.talkar.in/webhook/send-spaces-booking-confirmed`
- **Workflow ID:** `kHiDjM2hY92G6k4U`
- **Payload:**
```json
{
  "phone": "9827953551",
  "callerName": "Rahul Verma",
  "bookingReference": "BK-8291",
  "assetName": "Boardroom & Conference Hall (14 Pax)",
  "locationName": "BTM Layout 1st Stage",
  "date": "2026-11-26",
  "startTime": "14:00",
  "durationHours": 2,
  "paxCount": 8,
  "totalAmount": 2832,
  "currency": "INR"
}
```

### 3. Temporary Hold Payment Link
- **Webhook:** `POST https://n8n.talkar.in/webhook/send-spaces-payment-link`
- **Payload:**
```json
{
  "phone": "9827953551",
  "callerName": "Rahul Verma",
  "bookingReference": "BK-8291",
  "assetName": "Meeting Room (6 Pax)",
  "totalAmount": 1416,
  "currency": "INR",
  "paymentLinkUrl": "https://pay.talkar.in/bk/BK-8291",
  "expiresInMinutes": 15
}
```

---

## 7. Talkar Voice AI Agent & Tool Mappings

The Voice AI Workspace Advisor **Riya** is published on Talkar as **Workflow `127`**:
- **Workflow Name:** `Elite Co-Works - Riya Inbound Workspace Advisor`
- **AI Brain (LLM):** Sarvam 105B Conversations (`sarvam-105b-conversations`), temperature `0.3`
- **Voice (TTS):** Smallest AI `lightning_v3.1_pro` (`voice: mishka`), polished executive tone
- **Speech-to-Text (STT):** Sarvam Saaras v4 (`saaras:v4`)
- **Extraction Model:** OpenAI `gpt-4.1-mini`, temperature `0.5`
- **Telephony Tuning:** `turn_silence_timeout_secs: 0.75`, `smart_turn_stop_secs: 1.7`, `ambient_noise: 0.4`.

### Registered Voice AI Tools:
| Tool Name | Method & Target URL | Purpose |
| :--- | :--- | :--- |
| **`spaces_get_catalog`** | `GET https://spaces.talkar.in/api/v1/organizations/elite-coworks/catalog` | Queries locations, desk/cabin plans, pricing, and amenities |
| **`spaces_check_slot_availability`** | `GET https://spaces.talkar.in/api/v1/organizations/elite-coworks/bookings/availability` | Checks real-time meeting room or day pass inventory |
| **`spaces_hold_slot`** | `POST https://spaces.talkar.in/api/v1/organizations/elite-coworks/bookings/hold` | Locks 15-minute slot and dispatches WhatsApp payment link |
| **`spaces_book_site_visit`** | `POST https://spaces.talkar.in/api/v1/organizations/elite-coworks/visits/book` | Schedules in-person centre tour and sends WhatsApp pass |
| **`spaces_reschedule_site_visit`** | `PATCH https://spaces.talkar.in/api/v1/organizations/elite-coworks/visits/reschedule` | Modifies tour date/time by reference number |

---

## 8. MCP (Model Context Protocol) Server

Spaces CRM includes an embedded Model Context Protocol (MCP) server for local tool execution by Antigravity or any MCP-compatible agent.

### Starting the MCP Server:
```bash
cd /Users/arnav/Internship/talkar-spaces-crm
npm run mcp
```

### Supported MCP Tools:
- **`spaces_get_catalog`**: Inspect workspace offerings and amenities.
- **`spaces_check_availability`**: Check date and time slot availability.
- **`spaces_hold_slot`**: Reserve a short-term desk or meeting room.
- **`spaces_book_site_visit`**: Schedule an in-person tour.
- **`spaces_lookup_lead`**: Query lead score and past interaction history.

---

## 9. Verification & Telephony Testing Suite

Run the end-to-end verification script to validate all endpoints:

```bash
# 1. Run local test suite
cd /Users/arnav/Internship/talkar-spaces-crm
npm run build
npm test

# 2. Trigger automated phone call from Riya
curl -X POST https://spaces.talkar.in/api/v1/organizations/elite-coworks/call-lead \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919827953551", "name": "Arnav"}'

# 3. Verify SQLite DB state
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([
  prisma.organization.findMany(),
  prisma.location.findMany(),
  prisma.asset.findMany(),
  prisma.siteVisit.findMany(),
  prisma.booking.findMany()
]).then(([orgs, locs, assets, visits, bookings]) => {
  console.log({ orgs: orgs.length, locs: locs.length, assets: assets.length, visits: visits.length, bookings: bookings.length });
});
"
```
