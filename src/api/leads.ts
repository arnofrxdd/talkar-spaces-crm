import { Router, Request, Response } from 'express';
import { spacesService } from '../services/spaces.js';
import { prisma } from '../lib/prisma.js';
import { eventService } from '../services/events.js';

export const leadsRouter = Router({ mergeParams: true });

// 1. Caller lookup on ring (Pre-call context N0)
leadsRouter.get('/lookup', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { phone } = req.query;

    if (!phone) return res.status(400).json({ success: false, error: 'phone query parameter is required' });

    const context = await spacesService.lookupCaller(slug, String(phone));
    res.json({ success: true, data: context });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2. Progressive slot filling & lead scoring
leadsRouter.post('/upsert', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const {
      phone,
      name,
      email,
      companyName,
      intent,
      customFields,
      callRunId,
      summary,
      transcript,
      audioUrl,
      recordingConsent,
    } = req.body;

    if (!phone) return res.status(400).json({ success: false, error: 'phone is required' });

    const lead = await spacesService.upsertLead({
      organizationSlug: slug,
      phone,
      name,
      email,
      companyName,
      intent,
      customFields,
      callRunId,
      summary,
      transcript,
      audioUrl,
      recordingConsent,
    });

    res.json({ success: true, data: lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 3. Update lead stage (Kanban drag-and-drop or status change)
leadsRouter.patch('/:id/stage', async (req: Request, res: Response) => {
  try {
    const { slug, id } = req.params;
    const { stage, notes } = req.body;

    if (!stage) return res.status(400).json({ success: false, error: 'stage is required' });

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        stage,
        updatedAt: new Date(),
      },
    });

    eventService.broadcastLead(updated, slug);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. List leads
leadsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) return res.status(404).json({ success: false, error: `Organization '${slug}' not found` });

    const leads = await prisma.lead.findMany({
      where: { organizationId: org.id },
      include: {
        bookings: { take: 5, orderBy: { createdAt: 'desc' } },
        siteVisits: { take: 5, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    res.json({ success: true, count: leads.length, data: leads });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
