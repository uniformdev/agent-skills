import { uniformMiddleware } from "@uniformdev/next-app-router/middleware";

export default uniformMiddleware();

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
  runtime: "experimental-edge",
};
