import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { organizationsRouter } from './api/organizations.js';
import { bookingsRouter } from './api/bookings.js';
import { visitsRouter } from './api/visits.js';
import { leadsRouter } from './api/leads.js';
import { webhooksRouter } from './api/webhooks.js';
import { eventService } from './services/events.js';
import { prisma } from './lib/prisma.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 7578;
const HOST = process.env.HOST || '0.0.0.0';

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static public assets
app.use('/brochures', express.static(path.join(process.cwd(), 'public', 'brochures')));
app.use('/photos', express.static(path.join(process.cwd(), 'public', 'photos')));

// Helper to resolve dashboard html file
function getDashboardHtmlPath(): string | null {
  const possiblePaths = [
    path.join(__dirname, 'ui', 'dashboard.html'),
    path.join(__dirname, '..', 'src', 'ui', 'dashboard.html'),
    path.join(process.cwd(), 'src', 'ui', 'dashboard.html'),
    path.join(process.cwd(), 'dist', 'ui', 'dashboard.html'),
  ];
  return possiblePaths.find((p) => fs.existsSync(p)) || null;
}

// 1. Live Pitch Board UI (Root & Slug URLs)
app.get(['/', '/dashboard', '/:slug'], (req: Request, res: Response, next) => {
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }
  const dashboardPath = getDashboardHtmlPath();
  if (dashboardPath) {
    res.sendFile(dashboardPath);
  } else {
    res.status(404).send('Spaces Dashboard UI file not found');
  }
});

// 1.5 Simulated Payment & Checkout Page
app.get('/pay/:reference', async (req: Request, res: Response) => {
  const { reference } = req.params;
  try {
    const booking = await prisma.booking.findUnique({
      where: { bookingReference: reference.toUpperCase() },
      include: { organization: true, location: true, asset: true, lead: true },
    });

    if (!booking) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Booking Not Found</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4 font-sans">
          <div class="bg-white max-w-md w-full p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
            <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl text-amber-600">⚠️</div>
            <h1 class="text-xl font-bold text-slate-800">Booking Reference Not Found</h1>
            <p class="text-slate-500 text-sm mt-2">The reservation reference <strong>${reference}</strong> does not exist or has expired.</p>
          </div>
        </body>
        </html>
      `);
    }

    const isConfirmed = booking.status === 'CONFIRMED';
    const expiresMs = booking.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() : Date.now() + 15 * 60 * 1000;
    const remainingSeconds = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${booking.organization.name} - Secure Payment (${booking.bookingReference})</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/lucide@latest"></script>
      </head>
      <body class="bg-slate-100 min-h-screen flex items-center justify-center p-4 font-sans text-slate-800">
        <div class="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <!-- Top Header -->
          <div class="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
            <div class="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
              <span>Verified 256-Bit SSL Demo Checkout</span>
            </div>
            <h1 class="text-2xl font-bold tracking-tight">${booking.organization.name}</h1>
            <p class="text-blue-100 text-xs mt-1">Official Workspace Reservation Pass & Payment</p>
          </div>

          <div class="p-6 sm:p-8 space-y-6">
            <!-- Reference & Status -->
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Booking Reference</span>
                <div class="text-lg font-bold font-mono text-slate-900">${booking.bookingReference}</div>
              </div>
              <div id="statusBadge">
                ${isConfirmed 
                  ? '<span class="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200"><i data-lucide="check-circle" class="w-3.5 h-3.5 mr-1.5"></i> PAID & CONFIRMED</span>'
                  : '<span class="inline-flex items-center px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200 animate-pulse"><i data-lucide="clock" class="w-3.5 h-3.5 mr-1.5"></i> 15-MIN HOLD ACTIVE</span>'}
              </div>
            </div>

            <!-- Booking Details Card -->
            <div class="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3 text-sm">
              <div class="flex justify-between items-start">
                <span class="text-slate-500 text-xs">Plan / Asset:</span>
                <span class="font-semibold text-slate-900 text-right">${booking.asset.name}</span>
              </div>
              <div class="flex justify-between items-start">
                <span class="text-slate-500 text-xs">Centre Location:</span>
                <span class="font-semibold text-slate-900 text-right">${booking.location.name}</span>
              </div>
              <div class="flex justify-between items-start">
                <span class="text-slate-500 text-xs">Date & Time:</span>
                <span class="font-semibold text-slate-900 text-right">${booking.bookingDate} at ${booking.startTime} (${booking.durationHours || 1} hr${(booking.durationHours || 1) > 1 ? 's' : ''})</span>
              </div>
              <div class="flex justify-between items-start">
                <span class="text-slate-500 text-xs">Guest / Member:</span>
                <span class="font-semibold text-slate-900 text-right">${booking.lead?.name || 'Customer'} (${booking.lead?.phone || ''})</span>
              </div>
            </div>

            <!-- Pricing Breakdown -->
            <div class="space-y-2 pt-2">
              <div class="flex justify-between text-xs text-slate-500">
                <span>Base Workspace Charge</span>
                <span>₹${booking.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div class="flex justify-between text-xs text-slate-500">
                <span>Applicable GST (18%)</span>
                <span>₹${booking.taxAmount.toLocaleString('en-IN')}</span>
              </div>
              <div class="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount Due</span>
                <span class="text-indigo-600 text-lg">₹${booking.totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <!-- Timer (if pending) -->
            ${!isConfirmed ? `
            <div id="timerContainer" class="bg-amber-50/80 rounded-lg p-3 text-center border border-amber-200/80">
              <span class="text-xs text-amber-800 font-medium">Slot held temporarily. Complete payment within:</span>
              <div id="countdown" class="text-lg font-mono font-bold text-amber-900 mt-0.5">14:59</div>
            </div>
            ` : ''}

            <!-- Action Area -->
            <div id="actionArea">
              ${isConfirmed ? `
              <div class="bg-emerald-50 rounded-xl p-6 text-center border border-emerald-200">
                <div class="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto text-white mb-3 shadow-md shadow-emerald-200">
                  <i data-lucide="check" class="w-6 h-6 stroke-[3]"></i>
                </div>
                <h3 class="text-emerald-900 font-bold text-base">Payment Completed Successfully!</h3>
                <p class="text-emerald-700 text-xs mt-1">Your official door access and booking pass have been sent to your WhatsApp.</p>
              </div>
              ` : `
              <button id="payBtn" onclick="completePayment()" class="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer">
                <i data-lucide="credit-card" class="w-4 h-4"></i>
                <span>Simulate Successful Payment (₹${booking.totalAmount.toLocaleString('en-IN')})</span>
              </button>
              <p class="text-center text-[11px] text-slate-400 mt-2">Instant demo confirmation. Dispatches WhatsApp confirmation pass upon completion.</p>
              `}
            </div>
          </div>
        </div>

        <script>
          lucide.createIcons();

          let secondsLeft = ${remainingSeconds};
          const countdownEl = document.getElementById('countdown');
          if (countdownEl && secondsLeft > 0) {
            const timer = setInterval(() => {
              if (secondsLeft <= 0) {
                clearInterval(timer);
                countdownEl.innerText = 'Hold Expired';
                return;
              }
              secondsLeft--;
              const m = Math.floor(secondsLeft / 60);
              const s = secondsLeft % 60;
              countdownEl.innerText = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
            }, 1000);
          }

          async function completePayment() {
            const btn = document.getElementById('payBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Processing Payment...';

            try {
              const res = await fetch('/api/v1/organizations/${booking.organization.slug}/bookings/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bookingReference: '${booking.bookingReference}',
                  gatewayRef: 'pay_sim_' + Date.now()
                })
              });
              const json = await res.json();
              if (json.success) {
                document.getElementById('actionArea').innerHTML = \`
                  <div class="bg-emerald-50 rounded-xl p-6 text-center border border-emerald-200 animate-fade-in">
                    <div class="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto text-white mb-3 shadow-md shadow-emerald-200">
                      <i data-lucide="check" class="w-6 h-6 stroke-[3]"></i>
                    </div>
                    <h3 class="text-emerald-900 font-bold text-base">Payment Completed Successfully!</h3>
                    <p class="text-emerald-700 text-xs mt-1">Your official door access and booking pass have been sent to your WhatsApp.</p>
                  </div>
                \`;
                document.getElementById('statusBadge').innerHTML = '<span class="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200"><i data-lucide="check-circle" class="w-3.5 h-3.5 mr-1.5"></i> PAID & CONFIRMED</span>';
                const tc = document.getElementById('timerContainer');
                if (tc) tc.remove();
                lucide.createIcons();
              } else {
                alert('Payment error: ' + (json.error || 'Unknown error'));
                btn.disabled = false;
                btn.innerText = 'Retry Payment';
              }
            } catch (err) {
              alert('Network error completing payment');
              btn.disabled = false;
              btn.innerText = 'Retry Payment';
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send('Server Error: ' + err.message);
  }
});

// 2. Health & Readiness Check
app.get(['/health', '/api/v1/health'], (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'talkar-spaces-crm',
    version: '1.0.0',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// 3. Server-Sent Events (SSE) Stream for Real-Time Pitch Board
app.get('/api/v1/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const organizationSlug = req.query.organization ? String(req.query.organization) : undefined;

  eventService.addClient(clientId, res, organizationSlug);

  // Initial connection handshake
  res.write(
    `event: connected\ndata: ${JSON.stringify({ clientId, status: 'connected', organization: organizationSlug })}\n\n`
  );

  req.on('close', () => {
    eventService.removeClient(clientId);
  });
});

// 4. API Endpoints
app.use('/api/v1/organizations/:slug/bookings', bookingsRouter);
app.use('/api/v1/organizations/:slug/visits', visitsRouter);
app.use('/api/v1/organizations/:slug/leads', leadsRouter);
app.use('/api/v1/organizations', organizationsRouter);
app.use('/api/v1/webhooks', webhooksRouter);

const DOMAIN = process.env.DOMAIN || 'spaces.talkar.in';
const baseUrl = process.env.NODE_ENV === 'production' || DOMAIN ? `https://${DOMAIN}` : `http://localhost:${PORT}`;

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`\n🏢 ========================================================`);
  console.log(`🚀 Talkar Universal Spaces, Assets & Visit Booking CRM`);
  console.log(`🌐 Live Dashboard:  http://localhost:${PORT} / ${baseUrl}`);
  console.log(`📡 Catalog API:     http://localhost:${PORT}/api/v1/organizations/elite-coworks/catalog`);
  console.log(`⚡ SSE Live Stream:  http://localhost:${PORT}/api/v1/events/stream`);
  console.log(`🤖 MCP Server:      npm run mcp`);
  console.log(`🏢 ========================================================\n`);
});
