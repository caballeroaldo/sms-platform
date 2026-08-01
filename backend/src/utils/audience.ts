/**
 * SMS Platform - Audience Resolution Helper
 *
 * Single source of truth for translating a Campaign's audience setting into
 * the corresponding Prisma client filter. Used by:
 *   - POST /campaigns/:id/send   (resolve clients for send)
 *   - GET  /clients/count        (preview audience size before send)
 *
 * Opted-out clients are always excluded from the resolved set.
 */

import type { AudienceType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client.js';

interface CampaignLike {
  audience: AudienceType;
  manualRecipientIds: string[];
}

/**
 * Build a Prisma `where` filter that resolves a Campaign audience. Sharing this
 * helper means the send route and the count endpoint cannot drift on what
 * "PREV_YEAR_ACTIVE" or "MANUAL" actually means.
 */
export function buildAudienceWhere(
  audience: AudienceType,
  manualRecipientIds: string[] = []
): Prisma.ClientWhereInput {
  switch (audience) {
    case 'MANUAL': {
      const where: Prisma.ClientWhereInput = {
        optedOut: false,
      };
      if (manualRecipientIds.length > 0) {
        where.id = { in: manualRecipientIds };
      }
      return where;
    }
    case 'PREV_YEAR_ACTIVE': {
      const now = new Date();
      const priorYearStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0));
      const priorYearEnd = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31, 23, 59, 59, 999));
      return {
        optedOut: false,
        taxFiledDate: { gte: priorYearStart, lte: priorYearEnd },
      };
    }
    case 'ALL':
    default:
      return { optedOut: false };
  }
}

/**
 * Return the client IDs that a Campaign would resolve to. For MANUAL the
 * caller should already have warned about opted-out entries (the UI surfaces
 * this); opted-out clients are still excluded here as a safety net.
 */
export async function resolveAudienceClientIds(
  campaign: CampaignLike
): Promise<Array<{ id: string; phone: string }>> {
  // MANUAL with no recipients returns an empty set rather than scanning everyone.
  if (campaign.audience === 'MANUAL' && (campaign.manualRecipientIds ?? []).length === 0) {
    return [];
  }
  const where = buildAudienceWhere(campaign.audience, campaign.manualRecipientIds ?? []);
  // `phone` is included so the send route can enqueue each message via the
  // BullMQ queue without re-querying the client.
  return prisma.client.findMany({ where, select: { id: true, phone: true } });
}

/**
 * Human-readable explanation used by the UI when an audience resolves to zero.
 * Mirrors the strings returned by the send route's 400 path so the front-end
 * can show consistent messaging.
 */
export function emptyAudienceReason(audience: AudienceType): string {
  switch (audience) {
    case 'MANUAL':
      return 'No recipients remain after filtering opted-out clients from the manual list';
    case 'PREV_YEAR_ACTIVE':
      return 'No opted-in clients filed taxes in the prior calendar year';
    case 'ALL':
    default:
      return 'No opted-in clients found';
  }
}
