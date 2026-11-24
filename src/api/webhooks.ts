import { Router, Request, Response } from 'express';
import { spacesService } from '../services/spaces.js';
import { prisma } from '../lib/prisma.js';
import { eventService } from '../services/events.js';

export const webhooksRouter = Router();

// 1. Payment Gateway Webhook (Razorpay / Cashfree)
webhooksRouter.post('/payment', async (req: Request, res: Response) => {
  try {
    const { event, payload } = req.body;

    // Handles standard Razorpay order.paid event or generic payment success
    let bookingReference = payload?.payment?.entity?.notes?.booking_reference || req.body?.booking_reference;
    let organizationSlug = payload?.payment?.entity?.notes?.organization_slug || req.body?.organization_slug || 'elite-coworks';
    let paymentId = payload?.payment?.entity?.id || req.body?.payment_id || `pay_${Date.now()}`;

    if (!bookingReference) {
      return res.status(200).json({ status: 'ignored', message: 'No booking reference found' });
    }

    const booking = await spacesService.confirmBooking(organizationSlug, bookingReference, paymentId);
    res.json({ success: true, message: 'Payment confirmed & booking pass dispatched', data: booking });
  } catch (error: any) {
    console.error('[Webhooks:Payment Error]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Talkar Telephony Post-Call Completed Webhook
webhooksRouter.post('/call-completed', async (req: Request, res: Response) => {
  try {
    const {
      organizationSlug = 'elite-coworks',
      callerPhone,
      callerName,
      email,
      companyName,
      intent,
      summary,
      transcript,
      recordingUrl,
      callRunId,
      customFields,
      slots,
    } = req.body;

    if (!callerPhone) {
      return res.status(400).json({ success: false, error: 'callerPhone is required' });
    }

    const lead = await spacesService.upsertLead({
      organizationSlug,
      phone: callerPhone,
      name: callerName,
      email,
      companyName,
      intent,
      customFields: customFields || slots || {},
      callRunId,
      summary,
      transcript,
      audioUrl: recordingUrl,
    });

    // Also broadcast audio waveform & state to live dashboard
    eventService.broadcastCall(
      {
        state: 'COMPLETED',
        callerPhone,
        callerName,
        recordingUrl,
        summary,
        leadScore: lead.leadScore,
        temperature: lead.temperature,
      },
      organizationSlug
    );

    res.json({ success: true, leadId: lead.id, leadScore: lead.leadScore, temperature: lead.temperature });
  } catch (error: any) {
    console.error('[Webhooks:CallCompleted Error]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Web Form Submission Hook ("Book Your Slot Now" popup)
webhooksRouter.post('/web-form', async (req: Request, res: Response) => {
  try {
    const { organizationSlug = 'elite-coworks', name, phone, email, preferredCentre, seats, moveInDate } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ success: false, error: 'name and phone are required' });
    }

    const lead = await spacesService.upsertLead({
      organizationSlug,
      phone,
      name,
      email,
      intent: 'ENQ_DESK',
      customFields: {
        centre: preferredCentre,
        seats: seats ? parseInt(String(seats), 10) : 1,
        moveInDate,
        source: 'WEB_FORM',
      },
      summary: `Inbound website form submission for ${seats || 1} seats in ${preferredCentre || 'any centre'}. Immediate callback queued.`,
    });

    res.json({ success: true, leadId: lead.id, callbackQueued: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
