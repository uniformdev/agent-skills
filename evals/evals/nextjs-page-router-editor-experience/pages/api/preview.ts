import { createPreviewHandler } from "@uniformdev/canvas-next";

// Canvas "Preview URL": /api/preview?secret=<UNIFORM_PREVIEW_SECRET>. Turns on preview mode and
// redirects to the page; patterns and component previews open /playground.
const handler = createPreviewHandler({
  secret: () => process.env.UNIFORM_PREVIEW_SECRET ?? "",
  playgroundPath: "/playground",
});

export default handler;
