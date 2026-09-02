// Reads the visitor's enrichment scores from the `ufvd` cookie and builds the
// Content API boost clause. Server-only (reads cookies).
// Next.js App Router variant. For Pages Router / other frameworks, read the
// cookie from the incoming request and pass it as `serverScoreCookie`.
'use server';

import { cookies } from 'next/headers';
import { CookieTransitionDataStore } from '@uniformdev/context';
import {
  getEnrichmentAndFieldKey,
  getEnrichmentKeysWithScore,
  getOrderByClause,
} from './search';

export const getEnrichmentBoostedOrderBy = async (
  boostEnrichments: string[],
  serverScoreCookie?: string
): Promise<string | undefined> => {
  const cookieStore = await cookies();
  const scoreCookie = serverScoreCookie ?? cookieStore.get('ufvd')?.value;

  const transitionStore = new CookieTransitionDataStore({
    serverCookieValue: scoreCookie,
    experimental_quirksEnabled: true,
  });
  const enrichmentScores = transitionStore.data?.scores ?? {};

  const boostInclusions = boostEnrichments.reduce<
    Record<string, { value: string; score: number }>
  >((acc, enrichment) => {
    const { enrichmentKey, fieldKey } = getEnrichmentAndFieldKey(enrichment);
    const keys = getEnrichmentKeysWithScore(enrichmentKey, enrichmentScores);

    keys.forEach((key, index) => {
      const [, boostValue] = key.split('_'); // value after the first underscore
      const score = enrichmentScores[key] ?? 0;
      if (boostValue && score > 0) {
        // Unique key per matched value so multiple values in one category don't overwrite.
        const uniqueKey =
          keys.length > 1 ? `${enrichmentKey}_${index},${fieldKey}` : enrichment;
        acc[uniqueKey] = { value: boostValue, score };
      }
    });

    return acc;
  }, {});

  if (Object.keys(boostInclusions).length === 0) return undefined; // no scores → no boost
  return getOrderByClause(boostInclusions);
};
