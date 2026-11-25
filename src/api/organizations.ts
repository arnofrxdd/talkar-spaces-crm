import { Router, Request, Response } from 'express';
import { spacesService } from '../services/spaces.js';
import { prisma } from '../lib/prisma.js';

export const organizationsRouter = Router({ mergeParams: true });

// 1. List all active organizations
organizationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgs = await spacesService.listOrganizations();
    res.json({ success: true, count: orgs.length, data: orgs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get single organization with locations and catalog
organizationsRouter.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const org = await spacesService.getOrganization(slug);
    if (!org) return res.status(404).json({ success: false, error: `Organization '${slug}' not found` });
    res.json({ success: true, data: org });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get catalog for Voice Agent grounding
organizationsRouter.get('/:slug/catalog', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const locationCode = req.query.location ? String(req.query.location) : undefined;
    const catalog = await spacesService.getCatalog(slug, locationCode);
    res.json({ success: true, data: catalog });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. Get executive dashboard data
organizationsRouter.get('/:slug/dashboard', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const dashboard = await spacesService.getDashboardData(slug);
    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// 5. Onboard new organization
organizationsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, slug, industry, locationNoun, assetNoun, visitNoun, phone, email, currency } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ success: false, error: 'Name and slug are required' });
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug: slug.toLowerCase().trim(),
        industry: industry || 'COWORKING',
        locationNoun: locationNoun || 'Centre',
        assetNoun: assetNoun || 'Workspace Plan',
        visitNoun: visitNoun || 'Site Visit',
        phone,
        email,
        currency: currency || 'INR',
      },
    });

    res.status(201).json({ success: true, data: org });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 6. Delete organization by slug
organizationsRouter.delete('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const deleted = await prisma.organization.delete({
      where: { slug }
    });
    res.json({ success: true, message: `Organization ${slug} deleted successfully`, data: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
