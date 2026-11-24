import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spacesService } from '../services/spaces.js';
import { prisma } from '../lib/prisma.js';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'talkar-spaces-crm',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'spaces_lookup_caller',
          description:
            'Look up incoming caller by phone number against CRM to retrieve their past inquiry notes, open visits, or existing bookings (N0 Pre-Call Context).',
          inputSchema: {
            type: 'object',
            required: ['organization_slug', 'phone'],
            properties: {
              organization_slug: { type: 'string', description: 'Tenant identifier (e.g. "elite-coworks", "prestige-properties")' },
              phone: { type: 'string', description: 'Caller E.164 phone number (e.g. "+919845012345")' },
            },
          },
        },
        {
          name: 'spaces_get_catalog',
          description:
            'Fetch all active locations/centres, workspace asset types, live pricing, and active offers for grounding the AI voice persona.',
          inputSchema: {
            type: 'object',
            required: ['organization_slug'],
            properties: {
              organization_slug: { type: 'string', description: 'Tenant identifier' },
              location_code: { type: 'string', description: 'Optional centre code filter (e.g. "BTM", "JPN")' },
            },
          },
        },
        {
          name: 'spaces_check_availability',
          description:
            'Check real-time inventory and pricing for a meeting room, conference hall, or desk for a specific date and duration.',
          inputSchema: {
            type: 'object',
            required: ['organization_slug', 'location_code', 'asset_code', 'date'],
            properties: {
              organization_slug: { type: 'string' },
              location_code: { type: 'string', description: 'Centre code (e.g. "BTM", "JPN")' },
              asset_code: { type: 'string', description: 'Product code (e.g. "DAY", "MTG", "CONF", "CABIN")' },
              date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
              start_time: { type: 'string', description: 'Start time e.g. "14:00"' },
              duration_hours: { type: 'number', description: 'Duration in hours (e.g. 2.0)' },
              pax: { type: 'integer', description: 'Number of people' },
            },
          },
        },
        {
          name: 'spaces_hold_slot',
          description:
            'Track 1: Place a 15-minute temporary hold on a slot, generate an instant Razorpay payment link, and dispatch it via WhatsApp.',
          inputSchema: {
            type: 'object',
            required: ['organization_slug', 'location_code', 'asset_code', 'date', 'phone', 'name'],
            properties: {
              organization_slug: { type: 'string' },
              location_code: { type: 'string', description: 'Centre code' },
              asset_code: { type: 'string', description: 'Asset code (DAY, MTG, CONF)' },
              date: { type: 'string', description: 'YYYY-MM-DD' },
              start_time: { type: 'string', description: 'e.g. "10:00"' },
              duration_hours: { type: 'number', description: 'Duration in hours' },
              pax_count: { type: 'integer', description: 'Number of people' },
              phone: { type: 'string', description: 'Customer WhatsApp phone number' },
              name: { type: 'string', description: 'Customer full name' },
              email: { type: 'string', description: 'Customer email' },
              call_run_id: { type: 'string', description: 'Telephony call ID' },
            },
          },
        },
        {
          name: 'spaces_book_site_visit',
          description:
            'Track 2: Lock in an in-person site visit / tour at a specific centre, assign the centre manager, and dispatch a WhatsApp visit pass with location pin.',
          inputSchema: {
            type: 'object',
            required: ['organization_slug', 'location_code', 'date', 'time_slot', 'phone', 'name'],
            properties: {
              organization_slug: { type: 'string' },
              location_code: { type: 'string', description: 'Centre code (e.g. "BTM")' },
              date: { type: 'string', description: 'YYYY-MM-DD' },
              time_slot: { type: 'string', description: 'Time slot e.g. "11:30 AM", "4:00 PM"' },
              phone: { type: 'string', description: 'Visitor phone number' },
              name: { type: 'string', description: 'Visitor name' },
              email: { type: 'string', description: 'Visitor company email' },
              notes: { type: 'string', description: 'Requirements (e.g. "4-person private cabin from Dec 1")' },
              call_run_id: { type: 'string', description: 'Telephony call ID' },
            },
          },
        },
        {
          name: 'spaces_upsert_lead',
          description:
            'Progressively update lead slots during the call, compute lead score (0-100), and assign owner and follow-up SLA.',
          inputSchema: {
            type: 'object',
            required: ['organization_slug', 'phone'],
            properties: {
              organization_slug: { type: 'string' },
              phone: { type: 'string', description: 'Lead phone number' },
              name: { type: 'string' },
              email: { type: 'string' },
              company_name: { type: 'string' },
              intent: { type: 'string', description: 'ENQ_DESK, ENQ_CABIN, ENQ_VO, ENQ_ENT, BOOK_SHORT' },
              seats: { type: 'integer', description: 'Team size / seats needed' },
              centre: { type: 'string', description: 'Preferred location' },
              move_in_date: { type: 'string', description: 'Target start date' },
              tenure_months: { type: 'integer', description: 'Tenure e.g. 1, 3, 6, 12' },
              call_run_id: { type: 'string' },
              summary: { type: 'string', description: 'Short summary <= 60 words' },
            },
          },
        },
        {
          name: 'spaces_list_organizations',
          description: 'List all active client organizations/tenants in the CRM.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const a = (args || {}) as any;

    try {
      switch (name) {
        case 'spaces_lookup_caller': {
          const result = await spacesService.lookupCaller(a.organization_slug, a.phone);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'spaces_get_catalog': {
          const result = await spacesService.getCatalog(a.organization_slug, a.location_code);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'spaces_check_availability': {
          const result = await spacesService.checkAvailability({
            organizationSlug: a.organization_slug,
            locationCode: a.location_code,
            assetCode: a.asset_code,
            date: a.date,
            startTime: a.start_time,
            durationHours: a.duration_hours,
            pax: a.pax,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'spaces_hold_slot': {
          const booking = await spacesService.holdSlot({
            organizationSlug: a.organization_slug,
            locationCode: a.location_code,
            assetCode: a.asset_code,
            date: a.date,
            startTime: a.start_time,
            durationHours: a.duration_hours,
            paxCount: a.pax_count,
            phone: a.phone,
            name: a.name,
            email: a.email,
            callRunId: a.call_run_id,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    bookingReference: booking.bookingReference,
                    totalAmount: booking.totalAmount,
                    currency: booking.currency,
                    holdExpiresAt: booking.holdExpiresAt,
                    paymentLinkUrl: booking.paymentLinkUrl,
                    message: `Slot held successfully. WhatsApp payment link sent to ${a.phone}.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'spaces_book_site_visit': {
          const visit = await spacesService.bookSiteVisit({
            organizationSlug: a.organization_slug,
            locationCode: a.location_code,
            date: a.date,
            timeSlot: a.time_slot,
            phone: a.phone,
            name: a.name,
            email: a.email,
            notes: a.notes,
            callRunId: a.call_run_id,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    reference: visit.reference,
                    location: visit.location.name,
                    hostName: visit.assignedHostName,
                    hostPhone: visit.assignedHostPhone,
                    date: visit.visitDate,
                    timeSlot: visit.timeSlot,
                    message: `Site visit locked on calendar. WhatsApp pass with location pin dispatched to ${a.phone}.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'spaces_upsert_lead': {
          const lead = await spacesService.upsertLead({
            organizationSlug: a.organization_slug,
            phone: a.phone,
            name: a.name,
            email: a.email,
            companyName: a.company_name,
            intent: a.intent,
            customFields: {
              seats: a.seats,
              centre: a.centre,
              moveInDate: a.move_in_date,
              tenureMonths: a.tenure_months,
            },
            callRunId: a.call_run_id,
            summary: a.summary,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    leadId: lead.id,
                    leadScore: lead.leadScore,
                    temperature: lead.temperature,
                    stage: lead.stage,
                    ownerName: lead.ownerName,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'spaces_list_organizations': {
          const orgs = await spacesService.listOrganizations();
          return { content: [{ type: 'text', text: JSON.stringify(orgs, null, 2) }] };
        }

        default:
          throw new Error(`Unknown tool name: ${name}`);
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error executing ${name}: ${err.message}` }],
      };
    }
  });

  return server;
}
