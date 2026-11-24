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
