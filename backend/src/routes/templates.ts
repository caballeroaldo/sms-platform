/**
 * SMS Platform - Template Routes
 * CRUD operations for message templates
 */

import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';
import { authenticate } from '../middleware/index.js';
import { CreateTemplateInput, UpdateTemplateInput, ApiResponse } from '../types/index.js';
import { TemplateCategory } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../utils/validateRequest.js';
import { formatResponse } from '../utils/formatResponse.js';
import { schemas } from '../utils/validateRequest.js';

const router = Router();

router.use(authenticate);

/**
 * GET /templates
 * List all templates
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
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

  return formatResponse.success(res, templates);
}));

/**
 * POST /templates
 * Create a new template
 */
router.post(
  '/',
  authenticate,
  validateRequest(schemas.createTemplate),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateTemplateInput;

    const existing = await prisma.template.findFirst({ where: { name: input.name } });
    if (existing) {
      return formatResponse.conflict(res, 'A template with this name already exists');
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

    return formatResponse.success(res, template, 201);
  })
);

/**
 * GET /templates/:id
 * Get template by ID with variable preview
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = (req.params as Record<string, string>).id;

  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) {
    return formatResponse.notFound(res, 'Template not found');
  }

  const variables = (template.content.match(/\{\{(\w+)\}\}/g) || []).map((v) => v.replace(/\{\{|\}\}/g, ''));
  const uniqueVars = [...new Set(variables)];

  return formatResponse.success(res, { ...template, variables: uniqueVars });
}));

/**
 * POST /templates/preview
 * Preview a template with variables rendered
 */
router.post(
  '/preview',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { template, variables } = req.body;

    if (!template || !variables) {
      return formatResponse.error(res, 'Template content and variables are required', 400);
    }

    let preview = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      preview = preview.replace(regex, String(value));
    }

    return formatResponse.success(res, { preview, variablesUsed: Object.keys(variables) });
  })
);

/**
 * PUT /templates/:id
 * Update a template
 */
router.put(
  '/:id',
  authenticate,
  validateRequest(schemas.updateTemplate),
  asyncHandler(async (req: Request, res: Response) => {
    const id = (req.params as Record<string, string>).id;
    const input = req.body as UpdateTemplateInput;

    const existing = await prisma.template.findUnique({ where: { id } });
    if (!existing) {
      return formatResponse.notFound(res, 'Template not found');
    }

    if (input.name && input.name !== existing.name) {
      const conflict = await prisma.template.findFirst({ where: { name: input.name, id: { not: id } } });
      if (conflict) {
        return formatResponse.conflict(res, 'Template name already exists');
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

    return formatResponse.success(res, template);
  })
);

/**
 * DELETE /templates/:id
 * Delete a template (only if not used in campaigns)
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = (req.params as Record<string, string>).id;

    const usage = await prisma.campaign.findMany({
      where: { templateId: id },
      select: { id: true, name: true },
    });

    if (usage.length > 0) {
      return formatResponse.conflict(res, 'Template is used in campaigns', { usedIn: usage });
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

    return formatResponse.success(res, { message: 'Template deleted' });
  })
);

export default router;