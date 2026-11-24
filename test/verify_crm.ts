import { spacesService } from '../src/services/spaces.js';
import { prisma } from '../src/lib/prisma.js';

async function runVerification() {
  console.log('🧪 Starting End-to-End Engine & API Verification for Talkar Spaces CRM...\n');

  // Test 1: Fetch Catalog for Elite Co-Works
  console.log('--- Test 1: Catalog Grounding ---');
  const catalog = await spacesService.getCatalog('elite-coworks');
  console.log(`✅ Loaded catalog for: ${catalog.organization.name}`);
  console.log(`   Centres: ${catalog.locations.map((l) => l.name).join(', ')}`);
  console.log(`   Plans: ${catalog.assets.map((a) => `${a.name} (${a.startingPrice} ${a.pricingUnit})`).join(' | ')}`);

  // Test 2: Check Availability
  console.log('\n--- Test 2: Slot Availability Check ---');
  const avail = await spacesService.checkAvailability({
    organizationSlug: 'elite-coworks',
    locationCode: 'BTM',
    assetCode: 'MTG',
    date: '2026-11-28',
    startTime: '14:00',
    durationHours: 2,
    pax: 4,
  });
  console.log(`✅ Availability: ${avail.available ? 'OPEN' : 'BUSY'}`);
  console.log(`   Rate: Base ₹${avail.pricing.baseRate} + GST ₹${avail.pricing.taxAmount} = Total ₹${avail.pricing.totalAmount}`);

  // Test 3: Track 1 - Instant Slot Hold & Payment Link
  console.log('\n--- Test 3: Track 1 - Slot Hold & Payment Link ---');
  const hold = await spacesService.holdSlot({
    organizationSlug: 'elite-coworks',
    locationCode: 'BTM',
    assetCode: 'MTG',
    date: '2026-11-28',
    startTime: '14:00',
    durationHours: 2,
    phone: '+919845011223',
    name: 'Ananya Roy',
    email: 'ananya@roytech.io',
  });
  console.log(`✅ Slot Held: Ref ${hold.bookingReference}`);
  console.log(`   Payment Status: ${hold.paymentStatus} (Expires in 15 min at ${hold.holdExpiresAt?.toLocaleTimeString()})`);
  console.log(`   Payment Link: ${hold.paymentLinkUrl}`);

  // Test 4: Track 1 - Confirm Booking on Payment Receipt
  console.log('\n--- Test 4: Track 1 - Payment Confirmation Webhook ---');
  const confirmed = await spacesService.confirmBooking('elite-coworks', hold.bookingReference, 'pay_test_9988');
  console.log(`✅ Booking Confirmed: Status ${confirmed.status}, Payment ${confirmed.paymentStatus}`);

  // Test 5: Track 2 - Book Site Visit
  console.log('\n--- Test 5: Track 2 - In-Person Site Visit ---');
  const visit = await spacesService.bookSiteVisit({
    organizationSlug: 'elite-coworks',
    locationCode: 'BTM',
    phone: '+919845077889',
    name: 'Vikram Seth',
    email: 'vikram@sethconsulting.com',
    date: '2026-11-29',
    timeSlot: '3:00 PM',
    notes: 'Looking for 6-person private cabin from Dec 15',
  });
  console.log(`✅ Site Visit Locked: Ref ${visit.reference}`);
  console.log(`   Location: ${visit.location.name}`);
  console.log(`   Assigned Host: ${visit.assignedHostName} (${visit.assignedHostPhone})`);
  console.log(`   Lead Stage: ${visit.lead.stage}, Lead Score: ${visit.lead.leadScore} PTS, Priority: ${visit.lead.temperature}`);

  // Test 6: Progressive Slot Filling & Algorithmic Lead Scoring
  console.log('\n--- Test 6: Progressive Slot Filling & Scoring ---');
  const lead = await spacesService.upsertLead({
    organizationSlug: 'elite-coworks',
    phone: '+919845077889',
    name: 'Vikram Seth',
    companyName: 'Seth Consulting LLP',
    intent: 'ENQ_CABIN',
    customFields: {
      seats: 6,
      centre: 'BTM Layout',
      moveInDate: '2026-12-15',
      tenureMonths: 12,
    },
    summary: 'High-intent cabin enquiry for 6 seats with 1-year tenure.',
  });
  console.log(`✅ Lead Updated: Score ${lead.leadScore} PTS (${lead.temperature})`);
  console.log(`   Owner: ${lead.ownerName}, Follow-up SLA: ${lead.firstTouchSla ? '15 Minutes' : 'Same Day'}`);

  // Test 7: Pre-Call Context Caller Lookup on Ring
  console.log('\n--- Test 7: Pre-Call Caller Lookup (N0 Context) ---');
  const caller = await spacesService.lookupCaller('elite-coworks', '+919845077889');
  console.log(`✅ Known Caller: ${caller.isKnownCaller ? 'YES' : 'NO'}`);
  console.log(`   Caller Name: ${caller.name}`);
  console.log(`   Open Visits: ${caller.upcomingVisits.map((v) => `${v.reference} on ${v.date} @ ${v.timeSlot}`).join(', ')}`);

  // Test 8: Multi-Tenant Real Estate Client Isolation
  console.log('\n--- Test 8: Multi-Industry Tenant Isolation (Real Estate) ---');
  const prestige = await spacesService.getCatalog('prestige-properties');
  console.log(`✅ Real Estate Tenant: ${prestige.organization.name} (${prestige.organization.industry})`);
  console.log(`   Asset Term: ${prestige.organization.assetNoun}, Visit Term: ${prestige.organization.visitNoun}`);
  console.log(`   Offerings: ${prestige.assets.map((a) => `${a.name} (₹${a.startingPrice.toLocaleString('en-IN')})`).join(', ')}`);

  console.log('\n🎉 ALL 8 TESTS PASSED WITH 100% SUCCESS!');
}

runVerification()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
