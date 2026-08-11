import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { isCrawlablePath, NOINDEX_HEADER } from "./lib/public-routes";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { getRequestUrl } from "@tanstack/react-start/server";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Belt-and-braces indexing guard: every response for a path that is not on the
 * public allowlist carries `X-Robots-Tag: noindex`, so private pages stay out of
 * search results even if a route's meta tags are changed or dropped.
 */
const robotsHeaderMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  try {
    const { pathname } = getRequestUrl();
    if (!isCrawlablePath(pathname)) {
      const response = (result as { response?: Response }).response;
      response?.headers.set("X-Robots-Tag", NOINDEX_HEADER);
    }
  } catch {
    // No request context (non-HTTP invocation) — nothing to tag.
  }
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, robotsHeaderMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
