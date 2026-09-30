import {
  PlaygroundParameters,
  resolvePlaygroundRoute,
  UniformPlayground,
} from "@uniformdev/next-app-router";
import { compositionCache } from "@/components/compositionCache";
import { resolveComponent } from "@/components/resolveComponent";

export default async function PlaygroundPage({ params }: PlaygroundParameters) {
  const { code } = await params;
  return (
    <UniformPlayground
      code={code}
      resolveRoute={resolvePlaygroundRoute}
      resolveComponent={resolveComponent}
      compositionCache={compositionCache}
    />
  );
}
