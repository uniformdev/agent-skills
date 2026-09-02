// Pure helpers that translate enrichment scores into a Content API boost clause.
// No I/O — safe to unit test. Adapt naming to your project conventions.

// Splits a "enrichmentKey,fieldKey" config string into its two parts.
export const getEnrichmentAndFieldKey = (enrichment: string) => {
  const [enrichmentKey, fieldKey] = enrichment.split(',');
  return { enrichmentKey: enrichmentKey?.trim(), fieldKey: fieldKey?.trim() };
};

// Finds every score whose key starts with the category prefix and is > 0.
export const getEnrichmentKeysWithScore = (
  boostEnrichment: string,
  scores: Record<string, number>
): string[] =>
  Object.entries(scores)
    .filter(([key, score]) => key.startsWith(boostEnrichment) && score > 0)
    .map(([key]) => key);

// Builds the Content API boost expression.
// Output example: "boost|fields.category:internet:50|fields.category:mobility:25"
export const getOrderByClause = (
  boosts: Record<string, { value: string; score: number }>
): string | undefined => {
  const orderFields = Object.entries(boosts).map(([category, data]) => {
    const { fieldKey } = getEnrichmentAndFieldKey(category);
    return `fields.${fieldKey}:${data.value}:${data.score}`;
  });

  if (orderFields.length === 0) return undefined;
  return `boost|${orderFields.join('|')}`;
};
