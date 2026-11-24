import { Router, Request, Response } from 'express';
import { spacesService } from '../services/spaces.js';
import { prisma } from '../lib/prisma.js';

export const bookingsRouter = Router({ mergeParams: true });

// 1. Check slot availability
bookingsRouter.get('/availability', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { location, asset, date, startTime, duration, pax } = req.query;

    if (!location || !asset || !date) {
      return res.status(400).json({ success: false, error: 'location, asset, and date are required' });
    }

    const result = await spacesService.checkAvailability({
      organizationSlug: slug,
      locationCode: String(location),
      assetCode: String(asset),
      date: String(date),
      startTime: startTime ? String(startTime) : undefined,
      durationHours: duration ? parseFloat(String(duration)) : 1,
      pax: pax ? parseInt(String(pax), 10) : 1,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2. Track 1: Place 15-Minute Temporary Slot Hold & Payment Link
bookingsRouter.post('/hold', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { locationCode, assetCode, date, startTime, durationHours, paxCount, phone, name, email, callRunId } =
      req.body;

    if (!locationCode || !assetCode || !date || !phone || !name) {
      return res.status(400).json({
        success: false,
        error: 'locationCode, assetCode, date, phone, and name are required',
      });
    }

    const booking = await spacesService.holdSlot({
      organizationSlug: slug,
      locationCode,
      assetCode,
      date,
      startTime,
      durationHours,
      paxCount,
      phone,
      name,
      email,
      callRunId,
    });

    res.status(201).json({
      success: true,
      bookingReference: booking.bookingReference,
      status: booking.status,
      subtotal: booking.subtotal,
      taxAmount: booking.taxAmount,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt,
      paymentLinkUrl: booking.paymentLinkUrl,
      data: booking,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 3. Confirm booking (on payment or manual approval)
bookingsRouter.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { bookingReference, gatewayRef } = req.body;

    if (!bookingReference) {
      return res.status(400).json({ success: false, error: 'bookingReference is required' });
    }

    const booking = await spacesService.confirmBooking(slug, bookingReference, gatewayRef);
    res.json({ success: true, data: booking });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. List bookings for organization
bookingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) return res.status(404).json({ success: false, error: `Organization '${slug}' not found` });

    const bookings = await prisma.booking.findMany({
      where: { organizationId: org.id },
      include: { location: true, asset: true, lead: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
