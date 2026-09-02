// Fetches entries of a single content type, re-ranked by the visitor's
// enrichment profile via the boost `orderBy` clause.
import { EntryDeliveryClient } from '@uniformdev/canvas';
import { getEnrichmentBoostedOrderBy } from './getEnrichmentBoostedOrderBy';

type Args = {
  // Each entry is "<enrichmentCategoryId>,<contentFieldId>", e.g. "int,category".
  boostEnrichments: string[];
  maxRecommendations: number;
  entryType: string; // target content type public ID
  scoreCookie?: string; // pass the `ufvd` value if not using next/headers cookies()
};

export async function getRecommendations({
  boostEnrichments,
  maxRecommendations,
  entryType,
  scoreCookie,
}: Args) {
  if (!process.env.UNIFORM_PROJECT_ID || !process.env.UNIFORM_API_KEY) {
    throw new Error('Missing UNIFORM_PROJECT_ID / UNIFORM_API_KEY');
  }

  const orderBy = await getEnrichmentBoostedOrderBy(boostEnrichments, scoreCookie);

  const deliveryClient = new EntryDeliveryClient({
    projectId: process.env.UNIFORM_PROJECT_ID,
    apiKey: process.env.UNIFORM_API_KEY,
    // Add apiHost / edgeApiHost only if your project uses non-default hosts:
    // apiHost: process.env.UNIFORM_CLI_BASE_URL,
    // edgeApiHost: process.env.UNIFORM_CLI_BASE_EDGE_URL,
  });

  const { entries } = await deliveryClient.list({
    filters: { type: { eq: entryType } },
    limit: maxRecommendations ?? 30,
    orderBy: orderBy ? [orderBy] : undefined,
    locale: 'en',
  });

  return entries.map(entry => entry.entry);
}
