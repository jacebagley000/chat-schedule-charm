import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CrawlStatusReport } from "@/lib/crawl-status-types";

export type {
  CrawlStatusReport,
  ResourceStatus,
  RouteStatus,
} from "@/lib/crawl-status-types";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

export const getCrawlStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrawlStatusReport> => {
    await assertAdmin(context as never);

    const { getRequest } = await import("@tanstack/react-start/server");
    const { collectCrawlStatus } = await import("@/lib/crawl-check.server");
    const origin = new URL(getRequest().url).origin;

    return collectCrawlStatus(origin);
  });
