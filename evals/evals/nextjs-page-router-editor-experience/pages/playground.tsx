import { UniformPlayground } from "@uniformdev/canvas-react";

// The route Canvas opens patterns and component previews in (/api/preview → playgroundPath).
// Components are registered once, in _app.
export default function Playground() {
  return <UniformPlayground behaviorTracking="onLoad" />;
}
