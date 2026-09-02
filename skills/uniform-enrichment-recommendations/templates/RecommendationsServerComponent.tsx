// Async server component that fetches enrichment-boosted recommendations and
// renders them. Swap the card + skeleton for your project's UI. Wrap usages in
// <Suspense fallback={<Skeleton/>}> so the per-visitor fetch doesn't block paint.
import { FC } from 'react';
import { getRecommendations } from './getRecommendations';

type Props = {
  title?: React.ReactElement;
  // Each entry is "<enrichmentCategoryId>,<contentFieldId>", e.g. "int,category".
  boostEnrichments?: string[];
  contentType?: string;
  maxRecommendations?: string;
};

const Recommendations: FC<Props> = async ({
  title,
  boostEnrichments = [],
  contentType,
  maxRecommendations = '3',
}) => {
  const max = parseInt(maxRecommendations);

  const entries = !contentType
    ? []
    : await getRecommendations({
        boostEnrichments,
        entryType: contentType,
        maxRecommendations: max,
      });

  return (
    <section>
      {title}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {entries.length === 0
          ? Array.from({ length: max }).map((_, i) => <CardSkeleton key={i} />)
          : entries.map((entry: { _id: string }) => (
              // Replace with your own card; map entry.fields to props.
              <Card key={entry._id} entry={entry} />
            ))}
      </div>
    </section>
  );
};

// Placeholders — replace with real UI components.
const Card: FC<{ entry: { _id: string } }> = ({ entry }) => (
  <div className="border p-4" data-entry-id={entry._id} />
);
const CardSkeleton: FC = () => <div className="h-48 animate-pulse bg-gray-200" />;

export default Recommendations;
