# Talkar Universal Spaces, Assets & Visit Booking CRM (`talkar-spaces-crm`)

> **Universal Dual-Track Space & Visit CRM with Prisma, REST API, SSE Live Pitch Board, and MCP Server for Inbound Voice Agents.**  
> Built for Coworking Chains, Real Estate Developers, Banquet & Event Venues, Auto Dealerships, and Healthcare Clinics.

Served locally on **Port `7578`** and configured for production at **`https://spaces.talkar.in`**.

---

## 🌟 Executive Overview & The "Zero-Loss" Formula

When building software for a single demo client (e.g. *Elite Co-Works, Bengaluru*), prospective clients expect to see their real centres, cabins, pricing, and live site visits during the call. 

`talkar-spaces-crm` is designed so you never build custom software for a single client again:
1. **80% Universal Core:** Caller identity, call recordings, live SSE feed, WhatsApp dispatch, lead scoring ($0-100$), and the dual-track funnel.
2. **20% Configurable Metadata:** Centres/Locations, custom slot schemas, and dynamic terminology nouns (`assetNoun`, `visitNoun`).

### The Dual-Track Conversion Funnel

```
                          ┌───────────────────────────────────────┐
                          │   Inbound Voice / Web / WhatsApp Call │
                          └──────────────────┬────────────────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     ▼                                               ▼
          [Track 1: Instant Checkout]                     [Track 2: High-Ticket Lead]
        Low-friction, fixed-time slot                 Needs human trust & physical inspection
        ─────────────────────────────                 ───────────────────────────────────────
        • Check availability                          • Qualify requirements (Seats, Date, Tenure)
        • 15-min temporary hold                       • Lock in in-person Site Visit / Tour
        • Payment link via SMS/WA                     • Lead score: Hot / Warm / Cold (0-100)
        • Auto-confirmation on webhook                • Route to Closer + WhatsApp brochure
```

---

## 🚀 Quickstart & Local Setup

```bash
cd /Users/arnav/Internship/talkar-spaces-crm

# 1. Install dependencies
npm install

# 2. Generate Prisma Client, push SQLite schema, and seed demo tenants
npm run setup

# 3. Start local server (Port 7578)
npm run dev

# 4. (Optional) Run MCP Server on stdio for Talkar Agent integration
npm run mcp
```

Open your browser at **`http://localhost:7578`** or **`http://localhost:7578/elite-coworks`**.

---

## 🏢 Multi-Tenant & Multi-Location Architecture

A single server instance hosts multiple organizations with multiple centres:

| Organization (`slug`) | Industry | Primary Location (`Location`) | Asset Offering (`assetNoun`) | Visit Type (`visitNoun`) |
| :--- | :--- | :--- | :--- | :--- |
| **`elite-coworks`** | Coworking | BTM Layout, JP Nagar, Bannerghatta | Day Pass, Meeting Room, Cabin | In-Person Centre Tour |
| **`prestige-properties`** | Real Estate | Whitefield Golfshire, Lakeside | 3BHK, 4BHK Golf Villa | Model Flat Site Visit |

---

## 📡 REST API Reference (Port 7578)

All routes are mounted under `/api/v1` and are tenant-scoped:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Health & system readiness check |
| `GET` | `/api/v1/organizations` | List all active client tenants |
| `GET` | `/api/v1/organizations/:slug/catalog` | Get centres, asset plans, and live pricing |
| `GET` | `/api/v1/organizations/:slug/dashboard` | Get KPIs, active tours, and slot holds for live board |
| `GET` | `/api/v1/organizations/:slug/bookings/availability` | Check real-time inventory for date & duration |
| `POST` | `/api/v1/organizations/:slug/bookings/hold` | **Track 1:** Create 15-min hold & send WhatsApp payment link |
| `POST` | `/api/v1/organizations/:slug/bookings/confirm` | **Track 1:** Confirm booking on payment receipt |
| `POST` | `/api/v1/organizations/:slug/visits/book` | **Track 2:** Lock in in-person site visit / tour |
| `PATCH` | `/api/v1/organizations/:slug/visits/reschedule` | **Track 2:** Reschedule an existing site visit |
| `GET` | `/api/v1/organizations/:slug/leads/lookup` | Pre-call context lookup by caller phone on ring (N0) |
| `POST` | `/api/v1/organizations/:slug/leads/upsert` | Progressive slot filling & lead score calculation |
| `GET` | `/api/v1/events/stream` | Server-Sent Events (SSE) live pitch stream |
| `POST` | `/api/v1/webhooks/payment` | Razorpay payment success webhook |
| `POST` | `/api/v1/webhooks/call-completed` | Talkar telephony post-call sync webhook |

---

## 🤖 Model Context Protocol (MCP) Tools

When creating or configuring your Talkar Voice Agent, enable the embedded MCP tools:

1. **`spaces_lookup_caller`**: Looks up caller by phone on ring to retrieve past history and upcoming visits.
2. **`spaces_get_catalog`**: Returns active centres, workspace options, pricing, and amenities.
3. **`spaces_check_availability`**: Checks whether a room, cabin, or slot is open for date & time.
4. **`spaces_hold_slot`**: Places a 15-minute temporary hold and generates a payment link.
5. **`spaces_book_site_visit`**: Locks in a site visit with location manager and sends calendar invite.
6. **`spaces_upsert_lead`**: Fills custom fields dynamically, scores lead ($0-100$), and updates stage.

---

## 🌐 Production Domain & SSL Setup (`spaces.talkar.in`)

### Option A: Caddy (`/etc/caddy/Caddyfile`)
```caddy
spaces.talkar.in {
    reverse_proxy 127.0.0.1:7578 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
        transport http {
            keepalive 120s
        }
    }
}
```

### Option B: Nginx (`/etc/nginx/sites-available/spaces.talkar.in`)
```nginx
server {
    server_name spaces.talkar.in;

    location / {
        proxy_pass http://127.0.0.1:7578;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}
```

---

## 📄 License
Proprietary — Talkar AI & Antigravity Engineering.
