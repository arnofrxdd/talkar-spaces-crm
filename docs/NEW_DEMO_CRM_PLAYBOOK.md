# The Talkar Demo-Engine Playbook
## How We Build Zero-Loss, Reusable Demo CRMs for Any Industry
*The definitive guide to decision-making, Meta WhatsApp setup, n8n gateway contracts, Talkar Voice Agent tools, and full-stack architecture when management asks for a brand new CRM.*

---

## 1. How Decisions Are Made (The Arnav Decision Framework)

When management introduces a new prospective client and demands a custom CRM for an upcoming sales pitch:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │  Manager: "We need a CRM for [New Client in Industry X]"│
                  └────────────────────────────┬────────────────────────────┘
                                               │
                                               ▼
                         ┌───────────────────────────────────────────┐
                         │   STEP 1: The Client Ghosting Reality     │
                         │   60-70% of demo prospects ghost or drop. │
                         │   DO NOT build a custom, one-off CRM!     │
                         └─────────────────────┬─────────────────────┘
                                               │
                                               ▼
                         ┌───────────────────────────────────────────┐
                         │   STEP 2: The "3-Industry Abstraction"    │
                         │   What is the core transaction loop?      │
                         │   Can 3 completely different businesses   │
                         │   use this exact same database engine?    │
                         └─────────────────────┬─────────────────────┘
                                               │
                      ┌────────────────────────┴────────────────────────┐
                      ▼                                                 ▼
             [NO: Too Specific]                                 [YES: Universal Engine]
          Strip client-specific nouns.                       Build as Demo Archetype.
          Rename tables to generic concepts.                 Even if this client ghosts,
          Use `customFields: JSON`.                          we now own a permanent product!
```

### 1.1 The Golden Rules of Demo CRM Decisions
1. **Demo-Grade, Not Enterprise-Bloat:**
   - Real enterprise software takes 6 months of accounting, payroll, and compliance rules.
   - **Sales Demos are won or lost on 3 things only:**
     1. The client hears a human-like Talkar Voice Agent on a phone call.
     2. The client watches their screen update live via real-time SSE with call audio playback.
     3. The client receives an official WhatsApp confirmation message on their personal phone within 3 seconds of hanging up.
   - Everything else is distraction. Keep the code lightweight, fast, and stable.

2. **The "3-Industry Test" Before Touching Code:**
   - Before writing any database model or API, you must name **at least 3 industries** that can run on it without a database migration.
   - *Example (Hotel):* Boutique hotel, luxury resort, homestay, serviced apartment.
   - *Example (Clinic):* Dental clinic, dermatologist, physiotherapy, diagnostic lab.
   - *Example (Spaces):* Coworking space, luxury real estate villa, wedding banquet, sports turf.

3. **Never Hardcode Industry Nouns in the Database:**
   - ❌ Never create: `DentistAppointment`, `CoworkingDesk`, `CarChassisNumber`, `VillaUnit`.
   - ✅ Always create: `Asset`, `Lead`, `Booking`, `SiteVisit`, `Ticket`, `Record`.
   - Store all industry-specific details inside a `customFields: JSON` block.

---

## 2. Meta WhatsApp Architecture: Zero-Delay Demo Strategy

### 2.1 The Meta Review Bottleneck
- Meta takes between **30 minutes to 24 hours** to review newly submitted WhatsApp templates.
- **The Fatal Mistake:** Submitting a template with the client's specific name (e.g. `elite_coworks_booking`) 2 hours before a demo pitch. If Meta doesn't approve it in time, the demo breaks and the deal is lost.

### 2.2 The Universal Dynamic Template Rule
Always design templates using **dynamic parameters (`{{1}}`, `{{2}}`, etc.)** so any brand name, customer name, date, and reference code can be passed on the fly:

```
Template Name: [category]_confirmation (e.g., spaces_visit_confirmed)
Category: UTILITY
Header: {{1}} Confirmed - {{2}}
Body:
Hello {{1}},
Your {{2}} at {{3}} is confirmed! 🎉
📋 Reference: {{4}}
📅 Date: {{5}} at {{6}}
📍 Location: {{7}}
👤 Host / Specialist: {{8}}
We look forward to welcoming you!
```

### 2.3 The 2-Tier Fallback Strategy (In n8n)
Never let a demo fail due to template approval status:
1. **Tier 1 (Dedicated Template):** Submit the archetype template (e.g., `clinic_appointment_confirmed`) under `UTILITY`.
2. **Tier 2 (Universal Fallback):** If Tier 1 is still `PENDING`, n8n automatically dispatches via our pre-approved universal template:
   - `sales_appointment_confirmed` (Meta ID: `1631491317994105`, Approved `UTILITY`)
   - `sales_collateral_share` (Meta ID: `1135494772182769`, Approved `UTILITY`)
   The client still receives an instant official WhatsApp message on their phone without throwing an error.

---

## 3. n8n Gateway Engine: Standard Contract & Setup

When creating the n8n workflow for a new demo CRM:

### 3.1 Standard Webhook URL Pattern
Use clean, predictable webhook endpoints on `https://n8n.talkar.in`:
- `POST https://n8n.talkar.in/webhook/send-[archetype]-[action]`
- *Examples:*
  - `send-hotel-booking-confirmation`
  - `send-clinic-appointment-confirmation`
  - `send-spaces-visit-confirmation`
  - `send-spaces-booking-confirmation`

### 3.2 Standard JSON Webhook Payload
Every Talkar agent or CRM backend sends this exact payload contract to n8n:
```json
{
  "phone": "+919876543210",
  "customerName": "Rahul Sharma",
  "businessName": "Elite Co-Works",
  "referenceId": "VIS-9021",
  "itemName": "Private Team Cabin (8 Pax)",
  "date": "2026-11-28",
  "time": "14:00",
  "location": "BTM Layout 1st Stage, Bengaluru",
  "hostOrDoctor": "Vikram Malhotra",
  "notes": "Arrive 10 minutes before tour."
}
```

### 3.3 n8n Workflow Construction (3 Nodes Only)
1. **Webhook Node (`POST`):**
   - Path: `send-[archetype]-[action]`
   - Authentication: None / Header Auth
   - Response Mode: `Using 'Respond to Webhook' Node`
2. **HTTP Request Node (`Send WhatsApp via Meta API`):**
   - Method: `POST`
   - URL: `https://graph.facebook.com/v23.0/1314579088403220/messages`
   - Authentication: Generic Credential Type $\rightarrow$ `Header Auth` (or `httpBearerAuth` with credential `A4TlqRpKEb5a6CGY`)
   - Headers: `Content-Type: application/json`
   - Body Parameters:
     ```json
     {
       "messaging_product": "whatsapp",
       "recipient_type": "individual",
       "to": "={{ $json.body.phone }}",
       "type": "template",
       "template": {
         "name": "spaces_visit_confirmed",
         "language": { "code": "en" },
         "components": [
           {
             "type": "header",
             "parameters": [{ "type": "text", "text": "={{ $json.body.businessName }}" }]
           },
           {
             "type": "body",
             "parameters": [
               { "type": "text", "text": "={{ $json.body.customerName }}" },
               { "type": "text", "text": "={{ $json.body.businessName }}" },
               { "type": "text", "text": "={{ $json.body.referenceId }}" },
               { "type": "text", "text": "={{ $json.body.date }}" },
               { "type": "text", "text": "={{ $json.body.time }}" },
               { "type": "text", "text": "={{ $json.body.location }}" },
               { "type": "text", "text": "={{ $json.body.hostOrDoctor }}" }
             ]
           }
         ]
       }
     }
     ```
3. **Respond to Webhook Node:**
   - Response Code: `200`
   - Response Body: `{ "success": true, "message": "WhatsApp dispatched successfully" }`

---

## 4. Talkar Voice Agent Architecture: The 3 Universal Tools

Never write 15 custom tools for a voice agent. An inbound voice agent only ever needs **3 core tools** to deliver a complete demo.

```
                     ┌──────────────────────────────────────────────┐
                     │          TALKAR INBOUND VOICE AGENT          │
                     │          (e.g., Sarvam 105B / Gemini)        │
                     └──────────────────────┬───────────────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
      ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
      │   TOOL 1:        │        │   TOOL 2:        │        │   TOOL 3:        │
      │   Check Inventory│        │   Hold / Reserve │        │   Send WhatsApp  │
      ├──────────────────┤        ├──────────────────┤        ├──────────────────┤
      │ • Query catalog  │        │ • Book resource  │        │ • Trigger n8n    │
      │ • Check slots    │        │ • Schedule visit │        │   webhook        │
      │ • Get pricing    │        │ • Capture lead   │        │ • Instant ping   │
      └──────────────────┘        └──────────────────┘        └──────────────────┘
```

### 4.1 Tool 1: `check_availability` / `query_catalog`
- **Purpose:** Looks up available dates, asset types, pricing, and slots in the CRM database.
- **Parameters:** `locationId`, `date`, `itemType` (optional).
- **Return:** List of available items with pricing and capacity.

### 4.2 Tool 2: `hold_or_book` / `create_record`
- **Purpose:** Locks the booking or schedules the site visit/consultation.
- **Parameters:** `customerName`, `customerPhone`, `itemId`, `date`, `timeSlot`, `customNotes`.
- **Return:** `referenceId`, status (`CONFIRMED`), and total amount.

### 4.3 Tool 3: `send_details` / `trigger_whatsapp`
- **Purpose:** Calls the n8n webhook so the confirmation arrives before the caller hangs up.
- **Parameters:** `phone`, `customerName`, `referenceId`.
- **Return:** `{ "delivered": true }`.

### 4.4 The Call-Completion Webhook
Connect the agent's completion trigger to the CRM backend:
- URL: `https://[subdomain].talkar.in/api/v1/webhooks/call-completed`
- Talkar sends: `call_id`, `transcript`, `summary`, `recording_url`, `sentiment`, `caller_number`.
- The CRM saves this directly into the `Lead` and `AuditLog` tables and broadcasts it over SSE.

---

## 5. Database & API Architecture (Prisma + SQLite)

### 5.1 The Universal 6-Table Schema
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Organization {
  id        String     @id @default(uuid())
  name      String     // e.g. "Elite Co-Works" or "Prestige Estates"
  slug      String     @unique
  locations Location[]
  leads     Lead[]
  createdAt DateTime   @default(now())
}

model Location {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String   // e.g. "BTM Centre", "Whitefield Hub"
  address        String
  assets         Asset[]
}

model Asset {
  id           String    @id @default(uuid())
  locationId   String
  location     Location  @relation(fields: [locationId], references: [id])
  name         String    // "Hot Desk", "Meeting Room", "Villa 4BHK", "Court A"
  type         String    // DESK, CABIN, RESIDENTIAL, VENUE, TURF
  capacity     Int
  priceHourly  Float?
  priceDaily   Float?
  priceMonthly Float?
  amenities    String?   // JSON string
  isActive     Boolean   @default(true)
}

model Lead {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String
  phone          String
  email          String?
  stage          String       @default("NEW") // NEW, QUALIFIED, BOOKED, TOURED, LOST
  customFields   String?      // POLYMORPHIC JSON (team size, budget, preferences)
  callSummary    String?
  callRecording  String?
  createdAt      DateTime     @default(now())
}

model Booking {
  id           String    @id @default(uuid())
  assetId      String
  asset        Asset     @relation(fields: [assetId], references: [id])
  customerName String
  phone        String
  startDate    DateTime
  endDate      DateTime?
  status       String    @default("CONFIRMED")
  totalAmount  Float
  createdAt    DateTime  @default(now())
}

model SiteVisit {
  id           String    @id @default(uuid())
  locationId   String
  customerName String
  phone        String
  visitDate    DateTime
  timeSlot     String
  status       String    @default("SCHEDULED") // SCHEDULED, COMPLETED, CANCELLED
  hostName     String?
  createdAt    DateTime  @default(now())
}
```

---

## 6. Frontend Dashboard Standard (Industrial Modern SaaS)

The dashboard is the visual hero of the sales pitch. It must follow strict guidelines:

1. **Aesthetic:** Dark slate background (`#0B0F19`), clean border accents (`#1E293B`), emerald green for confirmed states (`#10B981`), amber for pending tours.
2. **Real-Time Live SSE Stream:**
   - Frontend connects to `/api/v1/stream` via `EventSource`.
   - When a call ends or a visit is booked, the row animates in **without the client having to refresh**.
3. **Embedded Audio Player:**
   - Every completed call card has a playable audio wave bar so the client can listen to the AI voice recording right on the board.
4. **Zero Developer Jargon:**
   - ❌ Never display: "HTTP 200", "Webhook Payload", "UUID: 47a-88f", "Schema".
   - ✅ Always display: "Live Inbound Call Board", "Confirmed Reservations", "Audio Recording", "Reference ID".

---

## 7. Step-by-Step 60-Minute Execution Blueprint (When A New CRM Is Demanded)

| Time Window | Target | Exact Action |
| :--- | :--- | :--- |
| **00:00 - 00:15** | **Abstraction & Schema** | Apply the 3-industry test. Clone the universal Prisma schema. Assign new port `757x`. |
| **00:15 - 00:30** | **n8n & WhatsApp** | Configure 3-node n8n workflow. Connect Meta Graph API v23.0 HTTP node. Test with curl to verify WhatsApp arrives on phone. |
| **00:30 - 00:45** | **Talkar Voice Agent** | Write 1-page grounding markdown. Clone base agent workflow in Talkar. Attach the 3 universal tools. |
| **00:45 - 00:55** | **UI & Docker Setup** | Spin up `docker-compose.yml` with SQLite auto-push. Verify live SSE stream on `dashboard.html`. |
| **00:55 - 01:00** | **Live End-to-End Test** | Dial the agent number. Book a slot. Hear audio, watch board update live, receive WhatsApp message. Pitch ready! |

---
*Created for Talkar Engineering & Product Architecture. Reusable across all future demo environments.*
