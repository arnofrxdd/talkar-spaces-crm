import { prisma } from '../lib/prisma.js';
import { eventService } from './events.js';

export interface HoldSlotParams {
  organizationSlug: string;
  locationCode: string;
  assetCode: string;
  date: string;
  startTime?: string;
  durationHours?: number;
  paxCount?: number;
  phone: string;
  name: string;
  email?: string;
  callRunId?: string;
}

export interface BookVisitParams {
  organizationSlug: string;
  locationCode: string;
  phone: string;
  name: string;
  email?: string;
  date: string;
  timeSlot: string;
  notes?: string;
  callRunId?: string;
}

export interface UpsertLeadParams {
  organizationSlug: string;
  phone: string;
  name?: string;
  email?: string;
  companyName?: string;
  intent?: string;
  customFields?: Record<string, any>;
  callRunId?: string;
  summary?: string;
  transcript?: string;
  audioUrl?: string;
  recordingConsent?: boolean;
}

class SpacesService {
  /**
   * Safe fetch helper for external n8n/WhatsApp webhooks
   */
  private async dispatchWebhook(url: string, payload: any) {
    if (!url || url.includes('placeholder')) return;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await response.json().catch(() => ({ status: 'dispatched' }));
    } catch (err) {
      console.warn(`[SpacesService] Webhook dispatch notice to ${url}:`, (err as any).message);
    }
  }

  /**
   * Fetch single organization by slug with locations and assets
   */
  async getOrganization(slug: string) {
    return prisma.organization.findUnique({
      where: { slug },
      include: {
        locations: { where: { isActive: true } },
        assets: { where: { isActive: true } },
      },
    });
  }

  /**
   * List all active organizations
   */
  async listOrganizations() {
    return prisma.organization.findMany({
      where: { isActive: true },
      include: {
        locations: { select: { id: true, code: true, name: true, city: true } },
        _count: { select: { leads: true, bookings: true, siteVisits: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get active catalog for an organization with optional location filter
   */
  async getCatalog(organizationSlug: string, locationCode?: string) {
    const org = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        locations: locationCode ? { where: { code: locationCode.toUpperCase() } } : true,
        assets: true,
      },
    });

    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    let filteredAssets = org.assets;
    if (locationCode) {
      const loc = org.locations.find((l) => l.code === locationCode.toUpperCase());
      if (loc) {
        filteredAssets = org.assets.filter((a) => !a.locationId || a.locationId === loc.id);
      }
    }

    return {
      organization: {
        name: org.name,
        slug: org.slug,
        industry: org.industry,
        currency: org.currency,
        locationNoun: org.locationNoun,
        assetNoun: org.assetNoun,
        visitNoun: org.visitNoun,
      },
      locations: org.locations.map((loc) => ({
        code: loc.code,
        name: loc.name,
        address: loc.address,
        operatingHours: loc.operatingHours,
        managerName: loc.managerName,
        managerPhone: loc.managerPhone,
        amenities: JSON.parse(loc.amenities || '[]'),
      })),
      assets: filteredAssets.map((asset) => ({
        code: asset.code,
        name: asset.name,
        category: asset.category,
        startingPrice: asset.startingPrice,
        pricingUnit: asset.pricingUnit,
        capacityPax: asset.capacityPax,
        bookingMode: asset.bookingMode,
        description: asset.description,
        amenities: JSON.parse(asset.amenities || '[]'),
        photos: JSON.parse(asset.photos || '[]'),
        brochurePdfUrl: asset.brochurePdfUrl,
      })),
    };
  }

  /**
   * Real-time slot availability check
   */
  async checkAvailability(params: {
    organizationSlug: string;
    locationCode: string;
    assetCode: string;
    date: string;
    startTime?: string;
    durationHours?: number;
    pax?: number;
  }) {
    const { organizationSlug, locationCode, assetCode, date, startTime, durationHours = 1, pax = 1 } = params;

    const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    const location = await prisma.location.findUnique({
      where: {
        organizationId_code: { organizationId: org.id, code: locationCode.toUpperCase() },
      },
    });
    if (!location) throw new Error(`Location '${locationCode}' not found.`);

    const asset = await prisma.asset.findUnique({
      where: {
        organizationId_code: { organizationId: org.id, code: assetCode.toUpperCase() },
      },
    });
    if (!asset) throw new Error(`Asset '${assetCode}' not found.`);

    // Count active confirmed/held bookings for this asset, location, and date
    const activeBookings = await prisma.booking.count({
      where: {
        organizationId: org.id,
        locationId: location.id,
        assetId: asset.id,
        bookingDate: date,
        status: { in: ['HELD', 'CONFIRMED'] },
      },
    });

    const isAvailable = activeBookings < asset.totalInventory;
    const duration = durationHours || 1;
    const unitPrice = asset.startingPrice;
    const subtotal = unitPrice * (asset.pricingUnit.includes('hour') ? duration : 1);
    const taxRate = 0.18; // Standard 18% GST for commercial space rentals
    const taxAmount = Math.round(subtotal * taxRate);
    const totalAmount = subtotal + taxAmount;

    return {
      available: isAvailable,
      assetName: asset.name,
      locationName: location.name,
      pricing: {
        unitRate: unitPrice,
        pricingUnit: asset.pricingUnit,
        durationHours: duration,
        subtotal,
        taxAmount,
        totalAmount,
        currency: org.currency,
        quoteSummary: `₹${unitPrice.toLocaleString('en-IN')}/${asset.pricingUnit.includes('hour') ? 'hr' : 'seat'}, coming to ₹${totalAmount.toLocaleString('en-IN')} total (inclusive of 18% GST)`,
        baseRate: subtotal,
      },
      photos: JSON.parse(asset.photos || '[]'),
      paxMax: asset.capacityPax,
      operatingHours: location.operatingHours,
    };
  }

  /**
   * Track 1: Create 15-Minute Temporary Slot Hold & Payment Link
   */
  async holdSlot(params: HoldSlotParams) {
    const {
      organizationSlug,
      locationCode,
      assetCode,
      date,
      startTime = '10:00',
      durationHours = 1.0,
      paxCount = 1,
      phone,
      name,
      email,
      callRunId,
    } = params;

    const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    const location = await prisma.location.findUnique({
      where: { organizationId_code: { organizationId: org.id, code: locationCode.toUpperCase() } },
    });
    if (!location) throw new Error(`Location '${locationCode}' not found.`);

    const asset = await prisma.asset.findUnique({
      where: { organizationId_code: { organizationId: org.id, code: assetCode.toUpperCase() } },
    });
    if (!asset) throw new Error(`Asset '${assetCode}' not found.`);

    // Find or create lead
    let lead = await prisma.lead.findFirst({
      where: { organizationId: org.id, phone },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          organizationId: org.id,
          phone,
          name,
          email,
          intent: 'BOOK_SHORT',
          callRunId,
        },
      });
    }

    const subtotal = asset.startingPrice * (asset.pricingUnit.includes('hour') ? durationHours : 1);
    const taxAmount = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + taxAmount;

    const refNumber = Math.floor(1000 + Math.random() * 9000);
    const bookingReference = `BKG-${refNumber}`;

    const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes hold
    const baseUrl = process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://spaces.talkar.in');
    const paymentLinkUrl = `${baseUrl}/pay/${bookingReference}`;

    const booking = await prisma.booking.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        assetId: asset.id,
        leadId: lead.id,
        bookingReference,
        bookingDate: date,
        startTime,
        durationHours,
        paxCount,
        subtotal,
        taxAmount,
        totalAmount,
        currency: org.currency,
        paymentStatus: 'HELD',
        holdExpiresAt,
        paymentLinkUrl,
        paymentGatewayRef: `order_sim_${Date.now()}`,
        status: 'HELD',
        source: 'VOICE_AI',
        callRunId,
      },
      include: {
        location: true,
        asset: true,
        lead: true,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        leadId: lead.id,
        eventType: 'SLOT_HELD',
        payload: JSON.stringify({ bookingReference, asset: asset.name, totalAmount }),
      },
    });

    // Dispatch WhatsApp Payment Link via n8n
    const webhookUrl = process.env.N8N_WEBHOOK_PAYMENT_LINK || 'https://n8n.talkar.in/webhook/send-spaces-payment-link';
    await this.dispatchWebhook(webhookUrl, {
      phone,
      callerName: name,
      bookingReference,
      assetName: asset.name,
      locationName: location.name,
      totalAmount: `₹${totalAmount.toLocaleString('en-IN')}`,
      paymentLinkUrl,
      holdMinutes: 15,
    });

    // Broadcast Real-Time SSE
    eventService.broadcastBooking(booking, org.slug);

    return booking;
  }

  /**
   * Track 1: Confirm Booking on Payment Receipt
   */
  async confirmBooking(organizationSlug: string, bookingReference: string, gatewayRef?: string) {
    const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    const booking = await prisma.booking.findUnique({
      where: { bookingReference },
      include: { location: true, asset: true, lead: true },
    });
    if (!booking) throw new Error(`Booking '${bookingReference}' not found.`);

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentGatewayRef: gatewayRef || booking.paymentGatewayRef,
      },
      include: { location: true, asset: true, lead: true },
    });

    // If lead exists, move stage to WON
    if (booking.leadId) {
      await prisma.lead.update({
        where: { id: booking.leadId },
        data: { stage: 'WON', temperature: 'HOT' },
      });
    }

    // Dispatch WhatsApp Confirmation Pass
    const webhookUrl =
      process.env.N8N_WEBHOOK_BOOKING_CONFIRMED || 'https://n8n.talkar.in/webhook/send-spaces-booking-confirmed';
    await this.dispatchWebhook(webhookUrl, {
      phone: booking.lead?.phone,
      callerName: booking.lead?.name || 'Valued Member',
      bookingReference: booking.bookingReference,
      assetName: booking.asset.name,
      locationName: booking.location.name,
      locationAddress: booking.location.address,
      googleMapsUrl: booking.location.googleMapsUrl || 'https://maps.google.com',
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
    });

    // Broadcast SSE
    eventService.broadcastBooking(updated, org.slug);

    return updated;
  }

  /**
   * Track 2: Book In-Person Site Visit / Walkthrough Tour
   */
  async bookSiteVisit(params: BookVisitParams) {
    const { organizationSlug, locationCode, phone, name, email, date, timeSlot, notes, callRunId } = params;

    const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    const location = await prisma.location.findUnique({
      where: { organizationId_code: { organizationId: org.id, code: locationCode.toUpperCase() } },
    });
    if (!location) throw new Error(`Location '${locationCode}' not found.`);

    // Upsert Lead
    let lead = await prisma.lead.findFirst({
      where: { organizationId: org.id, phone },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          organizationId: org.id,
          phone,
          name,
          email,
          stage: 'VISIT_BOOKED',
          temperature: 'HOT',
          leadScore: 65,
          callRunId,
          ownerName: location.managerName || 'Senior Centre Manager',
        },
      });
    } else {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          name: name || lead.name,
          email: email || lead.email,
          stage: 'VISIT_BOOKED',
          temperature: 'HOT',
          leadScore: Math.min(100, lead.leadScore + 25),
          ownerName: location.managerName || lead.ownerName,
        },
      });
    }

    const refNum = Math.floor(1000 + Math.random() * 9000);
    const reference = `${org.visitCodePrefix || 'VISIT'}-${refNum}`;

    const siteVisit = await prisma.siteVisit.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        leadId: lead.id,
        reference,
        visitDate: date,
        timeSlot,
        status: 'SCHEDULED',
        assignedHostName: location.managerName || 'Centre Advisor',
        assignedHostPhone: location.managerPhone || org.phone,
        notes: notes || 'Scheduled via Talkar Voice Agent',
        callRunId,
      },
      include: {
        location: true,
        lead: true,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        leadId: lead.id,
        eventType: 'VISIT_BOOKED',
        payload: JSON.stringify({ reference, location: location.name, date, timeSlot }),
      },
    });

    // Dispatch WhatsApp Visit Confirmation Pass
    const webhookUrl =
      process.env.N8N_WEBHOOK_VISIT_CONFIRMED || 'https://n8n.talkar.in/webhook/send-spaces-visit-confirmed';
    await this.dispatchWebhook(webhookUrl, {
      phone,
      callerName: name || 'Valued Guest',
      visitReference: reference,
      locationName: location.name,
      locationAddress: location.address,
      googleMapsUrl: location.googleMapsUrl || 'https://maps.google.com',
      visitDate: date,
      timeSlot,
      hostName: siteVisit.assignedHostName,
      hostPhone: siteVisit.assignedHostPhone,
    });

    // Broadcast SSE
    eventService.broadcastVisit(siteVisit, org.slug);
    eventService.broadcastLead(lead, org.slug);

    return siteVisit;
  }

  /**
   * Reschedule an existing site visit
   */
  async rescheduleSiteVisit(organizationSlug: string, reference: string, newDate: string, newTimeSlot: string) {
    const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    const visit = await prisma.siteVisit.findUnique({
      where: { reference },
      include: { location: true, lead: true },
    });
    if (!visit) throw new Error(`Site visit '${reference}' not found.`);

    const updated = await prisma.siteVisit.update({
      where: { id: visit.id },
      data: {
        visitDate: newDate,
        timeSlot: newTimeSlot,
        status: 'SCHEDULED',
      },
      include: { location: true, lead: true },
    });

    eventService.broadcastVisit(updated, org.slug);
    return updated;
  }

  /**
   * Progressive Slot Filling & Algorithmic Lead Scoring
   */
  async upsertLead(params: UpsertLeadParams) {
    const {
      organizationSlug,
      phone,
      name,
      email,
      companyName,
      intent,
      customFields = {},
      callRunId,
      summary,
      transcript,
      audioUrl,
      recordingConsent = true,
    } = params;

    const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    let lead = await prisma.lead.findFirst({
      where: { organizationId: org.id, phone },
    });

    // Merge custom metadata
    const existingCustom = lead ? JSON.parse(lead.customFields || '{}') : {};
    const mergedCustom = { ...existingCustom, ...customFields };

    // Compute Lead Score (Section 8 Algorithm)
    let score = 20; // Baseline
    if (mergedCustom.seats && mergedCustom.seats >= 16) score += 30;
    else if (mergedCustom.seats && mergedCustom.seats >= 5) score += 20;

    if (mergedCustom.moveInDate || mergedCustom.timeline === 'immediate') score += 25;
    if (mergedCustom.tenureMonths && mergedCustom.tenureMonths >= 6) score += 10;
    if (email && email.includes('@') && !email.includes('@gmail.com') && !email.includes('@yahoo.com')) score += 5;
    if (mergedCustom.centre) score += 5;
    if (mergedCustom.justCheckingPrices) score -= 15;

    score = Math.max(0, Math.min(100, score));

    // Temperature & SLA Band
    let temperature = 'COLD';
    let stage = lead?.stage || 'NEW';
    let ownerName = 'Automated Nurture';
    let firstTouchSla: Date | undefined;

    if (score >= 60) {
      temperature = 'HOT';
      stage = stage === 'NEW' ? 'QUALIFIED' : stage;
      ownerName = 'Senior Sales / Centre Manager';
      firstTouchSla = new Date(Date.now() + 15 * 60 * 1000); // 15 min SLA
    } else if (score >= 30) {
      temperature = 'WARM';
      stage = stage === 'NEW' ? 'QUALIFIED' : stage;
      ownerName = 'Sales Executive';
      firstTouchSla = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hour SLA
    }

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          organizationId: org.id,
          phone,
          name,
          email,
          companyName,
          intent,
          stage,
          temperature,
          leadScore: score,
          ownerName,
          firstTouchSla,
          callRunId,
          summary,
          transcript,
          audioUrl,
          recordingConsent,
          customFields: JSON.stringify(mergedCustom),
        },
      });
    } else {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          name: name || lead.name,
          email: email || lead.email,
          companyName: companyName || lead.companyName,
          intent: intent || lead.intent,
          stage: lead.stage === 'NEW' ? stage : lead.stage,
          temperature,
          leadScore: score,
          ownerName: lead.ownerName || ownerName,
          summary: summary || lead.summary,
          transcript: transcript || lead.transcript,
          audioUrl: audioUrl || lead.audioUrl,
          customFields: JSON.stringify(mergedCustom),
        },
      });
    }

    eventService.broadcastLead(lead, org.slug);
    return lead;
  }

  /**
   * Look up caller phone number against CRM on ring
   */
  async lookupCaller(organizationSlug: string, phone: string) {
    const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    const lead = await prisma.lead.findFirst({
      where: { organizationId: org.id, phone },
      include: {
        bookings: { where: { status: { in: ['HELD', 'CONFIRMED'] } }, include: { location: true, asset: true } },
        siteVisits: { where: { status: 'SCHEDULED' }, include: { location: true } },
      },
    });

    if (!lead) {
      return {
        isKnownCaller: false,
        name: null,
        phone,
        leadScore: 0,
        activeBookings: [],
        upcomingVisits: [],
      };
    }

    return {
      isKnownCaller: true,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      stage: lead.stage,
      temperature: lead.temperature,
      leadScore: lead.leadScore,
      customFields: JSON.parse(lead.customFields || '{}'),
      lastSummary: lead.summary,
      activeBookings: lead.bookings.map((b) => ({
        reference: b.bookingReference,
        asset: b.asset.name,
        location: b.location.name,
        date: b.bookingDate,
        time: b.startTime,
        status: b.status,
      })),
      upcomingVisits: lead.siteVisits.map((v) => ({
        reference: v.reference,
        location: v.location.name,
        date: v.visitDate,
        timeSlot: v.timeSlot,
        host: v.assignedHostName,
      })),
    };
  }

  /**
   * Get Live Pitch Board Data for an Organization
   */
  async getDashboardData(organizationSlug: string) {
    const org = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        locations: { where: { isActive: true } },
        assets: { where: { isActive: true } },
        leads: { orderBy: { updatedAt: 'desc' }, take: 50 },
        bookings: { orderBy: { createdAt: 'desc' }, take: 25, include: { location: true, asset: true, lead: true } },
        siteVisits: { orderBy: { createdAt: 'desc' }, take: 25, include: { location: true, lead: true } },
      },
    });

    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    // Calculate executive KPIs
    const totalRevenueReserved = org.bookings
      .filter((b) => b.paymentStatus === 'PAID')
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const totalToursBooked = org.siteVisits.length;
    const hotLeadsCount = org.leads.filter((l) => l.temperature === 'HOT').length;
    const totalInquiries = org.leads.length;

    return {
      organization: {
        name: org.name,
        slug: org.slug,
        industry: org.industry,
        currency: org.currency,
        locationNoun: org.locationNoun,
        assetNoun: org.assetNoun,
        visitNoun: org.visitNoun,
      },
      kpis: {
        totalRevenueReserved,
        totalToursBooked,
        hotLeadsCount,
        totalInquiries,
      },
      locations: org.locations,
      assets: org.assets,
      leads: org.leads,
      bookings: org.bookings,
      siteVisits: org.siteVisits,
    };
  }

  /**
   * Send Asset Photos via n8n WhatsApp Webhook
   */
  async sendAssetPhoto(params: {
    organizationSlug: string;
    phone: string;
    assetCodeOrName: string;
    customerName?: string;
  }) {
    const { organizationSlug, phone, assetCodeOrName, customerName } = params;

    const org = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: { assets: true, locations: true },
    });
    if (!org) throw new Error(`Organization '${organizationSlug}' not found.`);

    const query = (assetCodeOrName || 'MTG').trim().toLowerCase();
    const asset =
      org.assets.find(
        (a) =>
          a.code.toLowerCase() === query ||
          a.name.toLowerCase().includes(query) ||
          query.includes(a.code.toLowerCase())
      ) || org.assets[0];

    const photos = JSON.parse(asset.photos || '[]');
    const primaryPhoto =
      photos[0] || 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200';
    const location = org.locations[0];

    const webhookUrl = process.env.N8N_WEBHOOK_PHOTO || 'https://n8n.talkar.in/webhook/send-spaces-photo';
    await this.dispatchWebhook(webhookUrl, {
      phone,
      customerName: customerName || 'Valued Guest',
      organizationName: org.name,
      assetName: asset.name,
      locationName: location?.name || org.name,
      photoUrl: primaryPhoto,
      amenities: asset.amenities ? JSON.parse(asset.amenities).join(', ') : 'High-speed WiFi, AC, Display',
    });

    return {
      success: true,
      assetCode: asset.code,
      assetName: asset.name,
      locationName: location?.name,
      photoUrl: primaryPhoto,
      phone,
    };
  }
}

export const spacesService = new SpacesService();
