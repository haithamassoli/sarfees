import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Next 16: middleware.ts is now proxy.ts; the handler contract is unchanged.
const isProtected = createRouteMatcher([
  "/post",
  "/trips/new",
  "/requests/new",
  "/activity",
  "/notifications",
  "/profile",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isProtected(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  // Run on everything except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
