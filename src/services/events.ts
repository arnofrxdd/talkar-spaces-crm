import { Response } from 'express';

interface SseClient {
  id: string;
  res: Response;
  organizationSlug?: string;
}

class EventService {
  private clients: Map<string, SseClient> = new Map();

  addClient(id: string, res: Response, organizationSlug?: string) {
    this.clients.set(id, { id, res, organizationSlug });
  }

  removeClient(id: string) {
    this.clients.delete(id);
  }

  broadcast(eventType: string, payload: any, organizationSlug?: string) {
    const data = JSON.stringify(payload);
    for (const client of this.clients.values()) {
      if (!organizationSlug || !client.organizationSlug || client.organizationSlug === organizationSlug) {
        try {
          client.res.write(`event: ${eventType}\ndata: ${data}\n\n`);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  broadcastLead(lead: any, organizationSlug?: string) {
    this.broadcast('lead:updated', lead, organizationSlug);
  }

  broadcastBooking(booking: any, organizationSlug?: string) {
    this.broadcast('booking:updated', booking, organizationSlug);
  }

  broadcastVisit(visit: any, organizationSlug?: string) {
    this.broadcast('visit:updated', visit, organizationSlug);
  }

  broadcastCall(callData: any, organizationSlug?: string) {
    this.broadcast('call:state', callData, organizationSlug);
  }
}

export const eventService = new EventService();
