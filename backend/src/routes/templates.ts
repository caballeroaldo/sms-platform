/**
 * SMS Platform - Template Routes
 * CRUD operations for message templates
 */

import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';
import { authenticate } from '../middleware/index.js';
import { CreateTemplateInput, UpdateTemplateInput, ApiResponse } from '../types/index.js';
import { TemplateCategory } from '@prisma/client';

const router = Router();

router.use(authenticate);

/**
 * GET /templates
 * List all templates
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as Record<string, string | string[] | undefined>;
    const category = query.category;
    const where: Record<string, unknown> = {};
    if (category && !Array.isArray(category) && Object.values(TemplateCategory).includes(category as TemplateCategory)) {
      where.category = category;
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    res.json({ success: true, data: templates } as ApiResponse);
  } catch (error) {
    console.error('List templates error:', error);
    res.status(500).json({ success: false, error: 'Failed to list templates' } as ApiResponse);
  }
});

/**
 * POST /templates
 * Create a new template
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const input: CreateTemplateInput = req.body;

    if (!input.name || !input.category || !input.content) {
      res.status(400).json({ success: false, error: 'Name, category, and content are required' } as ApiResponse);
      return;
    }

    const existing = await prisma.template.findFirst({ where: { name: input.name } });
    if (existing) {
      res.status(409).json({ success: false, error: 'A template with this name already exists' } as ApiResponse);
      return;
    }

    const template = await prisma.template.create({
      data: { name: input.name, category: input.category, content: input.content },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        actor: req.user!.email,
        action: 'template_created',
        details: { templateId: template.id },
        ipAddress: req.ip,
      },
    });

    res.status(201).json({ success: true, data: template } as ApiResponse);
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, error: 'Failed to create template' } as ApiResponse);
  }
});

/**
 * GET /templates/:id
 * Get template by ID with variable preview
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = (req.params as Record<string, string>).id;

    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' } as ApiResponse);
      return;
    }

    const variables = (template.content.match(/\{\{(\w+)\}\}/g) || []).map((v) => v.replace(/\{\{|\}\}/g, ''));
    const uniqueVars = [...new Set(variables)];

    res.json({ success: true, data: { ...template, variables: uniqueVars } } as ApiResponse);
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ success: false, error: 'Failed to get template' } as ApiResponse);
  }
});

/**
 * POST /templates/preview
 * Preview a template with variables rendered
 */
router.post('/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { template, variables } = req.body;

    if (!template || !variables) {
      res.status(400).json({ success: false, error: 'Template content and variables are required' } as ApiResponse);
      return;
    }

    let preview = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      preview = preview.replace(regex, String(value));
    }

    res.json({ success: true, data: { preview, variablesUsed: Object.keys(variables) } } as ApiResponse);
  } catch (error) {
    console.error('Preview template error:', error);
    res.status(500).json({ success: false, error: 'Failed to preview template' } as ApiResponse);
  }
});

/**
 * PUT /templates/:id
 * Update a template
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = (req.params as Record<string, string>).id;
    const input: UpdateTemplateInput = req.body;

    const existing = await prisma.template.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Template not found' } as ApiResponse);
      return;
    }

    if (input.name && input.name !== existing.name) {
      const conflict = await prisma.template.findFirst({ where: { name: input.name, id: { not: id } } });
      if (conflict) {
        res.status(409).json({ success: false, error: 'Template name already exists' } as ApiResponse);
        return;
      }
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        category: input.category ?? existing.category,
        content: input.content ?? existing.content,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        actor: req.user!.email,
        action: 'template_updated',
        details: { templateId: id, changes: input },
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, data: template } as ApiResponse);
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ success: false, error: 'Failed to update template' } as ApiResponse);
  }
});

/**
 * DELETE /templates/:id
 * Delete a template (only if not used in campaigns)
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = (req.params as Record<string, string>).id;

    const usage = await prisma.campaign.findMany({
      where: { templateId: id },
      select: { id: true, name: true },
    });

    if (usage.length > 0) {
      res.status(409).json({ success: false, error: 'Template is used in campaigns', data: { usedIn: usage } } as ApiResponse);
      return;
    }

    await prisma.template.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        actor: req.user!.email,
        action: 'template_deleted',
        details: { templateId: id },
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, message: 'Template deleted' } as ApiResponse);
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete template' } as ApiResponse);
  }
});

export default router;