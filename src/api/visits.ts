import { Router, Request, Response } from 'express';
import { spacesService } from '../services/spaces.js';
import { prisma } from '../lib/prisma.js';

export const visitsRouter = Router({ mergeParams: true });

// 1. Track 2: Lock in Site Visit / In-Person Tour
visitsRouter.post('/book', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { locationCode, phone, name, email, date, timeSlot, notes, callRunId } = req.body;

    if (!locationCode || !phone || !name || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        error: 'locationCode, phone, name, date, and timeSlot are required',
      });
    }

    const visit = await spacesService.bookSiteVisit({
      organizationSlug: slug,
      locationCode,
      phone,
      name,
      email,
      date,
      timeSlot,
      notes,
      callRunId,
    });

    res.status(201).json({
      success: true,
      reference: visit.reference,
      status: visit.status,
      visitDate: visit.visitDate,
      timeSlot: visit.timeSlot,
      location: visit.location.name,
      hostName: visit.assignedHostName,
      data: visit,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2. Reschedule visit
visitsRouter.patch('/reschedule', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { reference, newDate, newTimeSlot } = req.body;

    if (!reference || !newDate || !newTimeSlot) {
      return res.status(400).json({
        success: false,
        error: 'reference, newDate, and newTimeSlot are required',
      });
    }

    const updated = await spacesService.rescheduleSiteVisit(slug, reference, newDate, newTimeSlot);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 3. List visits
visitsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) return res.status(404).json({ success: false, error: `Organization '${slug}' not found` });

    const visits = await prisma.siteVisit.findMany({
      where: { organizationId: org.id },
      include: { location: true, lead: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, count: visits.length, data: visits });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
