import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Talkar Universal Spaces CRM database...');

  // -------------------------------------------------------------------------
  // 1. Primary Tenant: Elite Co-Works (Coworking Demo Client)
  // -------------------------------------------------------------------------
  const eliteCoworks = await prisma.organization.upsert({
    where: { slug: 'elite-coworks' },
    update: {},
    create: {
      slug: 'elite-coworks',
      name: 'Elite Co-Works',
      brand: 'Premium Executive Workspaces',
      industry: 'COWORKING',
      tagline: 'Modern, high-productivity workspaces across Bengaluru',
      description: 'Plug-and-play flex desks, private lockable cabins, and state-of-the-art conference halls with high-speed fiber internet and premium amenities.',
      phone: '+918147446929',
      email: 'sales@elitecoworks.com',
      website: 'https://elitecoworks.com',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locationNoun: 'Centre',
      assetNoun: 'Workspace Plan',
      visitNoun: 'Site Visit',
      visitCodePrefix: 'VISIT',
      pipelineStages: JSON.stringify(['NEW', 'QUALIFIED', 'VISIT_BOOKED', 'VISITED', 'PROPOSAL', 'WON', 'LOST']),
    },
  });

  // Locations for Elite Co-Works
  const btm = await prisma.location.upsert({
    where: { organizationId_code: { organizationId: eliteCoworks.id, code: 'BTM' } },
    update: {},
    create: {
      organizationId: eliteCoworks.id,
      code: 'BTM',
      name: 'BTM Layout 1st Stage',
      address: '5a, 1A Cross Rd, Dollar Scheme Colony, BTM 1st Stage, Bengaluru 560068',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560068',
      mapCoordinates: '12.9165,77.6101',
      googleMapsUrl: 'https://maps.google.com/?q=12.9165,77.6101',
      operatingHours: 'Monday–Saturday 9:00 AM – 8:00 PM (24/7 Member Biometric Access)',
      managerName: 'Kavita Reddy',
      managerPhone: '+918147446929',
      managerEmail: 'kavita@elitecoworks.com',
      amenities: JSON.stringify([
        'High-speed 500 Mbps WiFi',
        '100% DG Power Backup',
        'Central Air Conditioning',
        'Unlimited Tea/Coffee/Soups',
        'Pantry & Breakout Lounge',
        'Two-Wheeler & Reserved Parking',
        'Lockable Cabin Storage',
        'Private Calling Pods',
      ]),
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200',
        'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200',
      ]),
    },
  });

  const jpn = await prisma.location.upsert({
    where: { organizationId_code: { organizationId: eliteCoworks.id, code: 'JPN' } },
    update: {},
    create: {
      organizationId: eliteCoworks.id,
      code: 'JPN',
      name: 'JP Nagar 6th Phase',
      address: '14th Main Rd, Puttenahalli, JP Nagar 6th Phase, Bengaluru 560078',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560078',
      operatingHours: 'Monday–Saturday 9:00 AM – 8:00 PM',
      managerName: 'Rohan Mehta',
      managerPhone: '+918147446930',
      managerEmail: 'rohan@elitecoworks.com',
      amenities: JSON.stringify([
        'High-speed WiFi',
        'Power Backup',
        'Meeting Rooms with Smart TV',
        'Cafeteria Access',
        'Valet Parking',
      ]),
    },
  });

  const bng = await prisma.location.upsert({
    where: { organizationId_code: { organizationId: eliteCoworks.id, code: 'BNG' } },
    update: {},
    create: {
      organizationId: eliteCoworks.id,
      code: 'BNG',
      name: 'Bannerghatta Main Road',
      address: 'Arekere Junction, Bannerghatta Main Rd, Bengaluru 560076',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560076',
      operatingHours: 'Monday–Saturday 9:00 AM – 8:00 PM',
      managerName: 'Preeti Nair',
      managerPhone: '+918147446931',
      managerEmail: 'preeti@elitecoworks.com',
      amenities: JSON.stringify(['High-speed WiFi', 'Power Backup', 'Conference Hall', 'Free Parking']),
    },
  });

  // Assets for Elite Co-Works
  const assets = [
    {
      code: 'DAY',
      name: 'Day Pass (Single Seat)',
      category: 'SHORT_TERM',
      description: 'Single full-day access with high-speed WiFi, AC, and unlimited tea & coffee.',
      startingPrice: 350.0,
      pricingUnit: 'per day',
      capacityPax: 1,
      totalInventory: 30,
      bookingMode: 'INSTANT_PAY',
    },
    {
      code: 'MTG',
      name: 'Executive Meeting Room (6 Pax)',
      category: 'SHORT_TERM',
      description: 'Sound-dampened 6-seater meeting room with 4K display, HDMI screen mirroring, and whiteboard.',
      startingPrice: 600.0,
      pricingUnit: 'per hour',
      capacityPax: 6,
      totalInventory: 4,
      bookingMode: 'INSTANT_PAY',
    },
    {
      code: 'CONF',
      name: 'Boardroom & Conference Hall (14 Pax)',
      category: 'SHORT_TERM',
      description: 'Premium board meeting room with teleconferencing mic array, 65-inch screen, and executive leather chairs.',
      startingPrice: 1200.0,
      pricingUnit: 'per hour',
      capacityPax: 14,
      totalInventory: 2,
      bookingMode: 'INSTANT_PAY',
    },
    {
      code: 'VO',
      name: 'Virtual Office & GST Registration',
      category: 'LONG_TERM',
      description: 'Prime business mailing address with GST registration compliance and 10 hours monthly meeting room credits.',
      startingPrice: 999.0,
      pricingUnit: 'per month',
      capacityPax: 1,
      totalInventory: 100,
      bookingMode: 'SALES_HANDOFF',
    },
    {
      code: 'FLEXI',
      name: 'Flexi Hot Desk',
      category: 'LONG_TERM',
      description: 'Flexible seat in open-plan collaborative work zone with high-speed internet and power access.',
      startingPrice: 6000.0,
      pricingUnit: 'per seat / month',
      capacityPax: 1,
      totalInventory: 25,
      bookingMode: 'SITE_VISIT',
    },
    {
      code: 'FIXED',
      name: 'Dedicated Assigned Desk',
      category: 'LONG_TERM',
      description: 'Reserved personal desk with lockable storage pedestal and ergonomic chair.',
      startingPrice: 6500.0,
      pricingUnit: 'per seat / month',
      capacityPax: 1,
      totalInventory: 20,
      bookingMode: 'SITE_VISIT',
    },
    {
      code: 'CABIN',
      name: 'Private Executive Cabin (4-12 Seats)',
      category: 'LONG_TERM',
      description: 'Fully lockable private acoustic office suite with biometric door lock and custom branding.',
      startingPrice: 7000.0,
      pricingUnit: 'per seat / month',
      capacityPax: 8,
      totalInventory: 6,
      bookingMode: 'SITE_VISIT',
    },
    {
      code: 'ENT',
      name: 'Managed Enterprise Office (20+ Seats)',
      category: 'LONG_TERM',
      description: 'Bespoke custom-designed enterprise floor wing with dedicated meeting rooms and reception branding.',
      startingPrice: 9000.0,
      pricingUnit: 'per seat / month',
      capacityPax: 50,
      totalInventory: 2,
      bookingMode: 'SALES_HANDOFF',
    },
  ];

  for (const a of assets) {
    await prisma.asset.upsert({
      where: { organizationId_code: { organizationId: eliteCoworks.id, code: a.code } },
      update: {},
      create: {
        organizationId: eliteCoworks.id,
        locationId: btm.id,
        code: a.code,
        name: a.name,
        category: a.category,
        description: a.description,
        startingPrice: a.startingPrice,
        pricingUnit: a.pricingUnit,
        capacityPax: a.capacityPax,
        totalInventory: a.totalInventory,
        bookingMode: a.bookingMode,
      },
    });
  }

  // Pre-seed an initial lead and visit for live demo presentation
  const demoLead = await prisma.lead.upsert({
    where: { id: 'demo-lead-biswa' },
    update: {},
    create: {
      id: 'demo-lead-biswa',
      organizationId: eliteCoworks.id,
      phone: '+919845012345',
      name: 'Biswa Patnaik',
      email: 'biswa@patnaiktech.com',
      companyName: 'Patnaik Tech Solutions',
      stage: 'VISIT_BOOKED',
      temperature: 'HOT',
      leadScore: 75,
      ownerName: 'Kavita Reddy (Centre Manager)',
      intent: 'ENQ_CABIN',
      source: 'VOICE_AI',
      summary: 'Inbound enquiry for 4-person private cabin starting 1st December in BTM Layout. Booked walkthrough tour.',
      customFields: JSON.stringify({
        seats: 4,
        centre: 'BTM Layout',
        moveInDate: '2026-12-01',
        tenureMonths: 6,
      }),
    },
  });

  await prisma.siteVisit.upsert({
    where: { reference: 'VISIT-4029' },
    update: {},
    create: {
      organizationId: eliteCoworks.id,
      locationId: btm.id,
      leadId: demoLead.id,
      reference: 'VISIT-4029',
      visitDate: '2026-11-27',
      timeSlot: '11:30 AM',
      status: 'SCHEDULED',
      assignedHostName: 'Kavita Reddy',
      assignedHostPhone: '+918147446929',
      notes: 'Cabin tour & high-speed internet speed test requested.',
    },
  });

  // -------------------------------------------------------------------------
  // 2. Second Multi-Industry Tenant: Prestige Luxury Properties (Real Estate)
  // -------------------------------------------------------------------------
  const prestige = await prisma.organization.upsert({
    where: { slug: 'prestige-properties' },
    update: {},
    create: {
      slug: 'prestige-properties',
      name: 'Prestige Group Luxury Estates',
      brand: 'Prestige Living',
      industry: 'REAL_ESTATE',
      tagline: 'Iconic residential towers and gated golf villas in Bengaluru',
      phone: '+918025591234',
      email: 'sales@prestigeconstructions.com',
      currency: 'INR',
      locationNoun: 'Project Site',
      assetNoun: 'Apartment Unit',
      visitNoun: 'Model Flat Site Visit',
      visitCodePrefix: 'RECCE',
    },
  });

  const whitefield = await prisma.location.upsert({
    where: { organizationId_code: { organizationId: prestige.id, code: 'WHT' } },
    update: {},
    create: {
      organizationId: prestige.id,
      code: 'WHT',
      name: 'Prestige Golfshire & Lakeside',
      address: 'SH 104, Nandi Hills Road, Devanahalli, Bengaluru 562110',
      city: 'Bengaluru',
      managerName: 'Arjun Singhania',
      managerPhone: '+919886011223',
    },
  });

  await prisma.asset.upsert({
    where: { organizationId_code: { organizationId: prestige.id, code: 'VILLA-4BHK' } },
    update: {},
    create: {
      organizationId: prestige.id,
      locationId: whitefield.id,
      code: 'VILLA-4BHK',
      name: '4BHK Golf Course Luxury Villa',
      category: 'LONG_TERM',
      startingPrice: 38500000.0,
      pricingUnit: 'total price',
      capacityPax: 6,
      totalInventory: 8,
      bookingMode: 'SITE_VISIT',
      description: '4,500 sq.ft. private pool villa overlooking the 18-hole championship golf course.',
    },
  });

  console.log('✅ Database seeded successfully with multi-tenant spaces & locations!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
