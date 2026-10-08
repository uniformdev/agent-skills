import {
  resolveRouteFromCode,
  UniformComposition,
  UniformPageParameters,
} from "@uniformdev/next-app-router";
import { resolveComponent } from "@/components/resolveComponent";

export default async function UniformPage(props: UniformPageParameters) {
  const { code } = await props.params;
  return (
    <UniformComposition
      code={code}
      resolveRoute={resolveRouteFromCode}
      resolveComponent={resolveComponent}
    />
  );
}
