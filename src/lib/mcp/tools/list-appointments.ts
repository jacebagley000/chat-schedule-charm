import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_appointments",
  title: "List appointments",
  description: "List a workspace's appointments in a time window (defaults to the next 7 days), with customer, staff and service names.",
  inputSchema: {
    workspace_id: z.string().uuid().describe("Workspace ID from list_workspaces."),
    from: z.string().datetime({ offset: true }).optional().describe("Window start (ISO 8601). Defaults to now."),
    days: z.number().int().min(1).max(60).optional().describe("Window length in days. Defaults to 7."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ workspace_id, from, days }, ctx) => {
    const start = from ? new Date(from) : new Date();
    const end = new Date(start.getTime() + (days ?? 7) * 86_400_000);
    const { data, error } = await supabaseForUser(ctx)
      .from("appointments")
      .select("id, starts_at, ends_at, status, source, notes, customers(name, email), staff(name), services(name)")
      .eq("business_id", workspace_id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at")
      .limit(200);
    if (error) throw new ToolError(error.message);
    const appointments = (data ?? []).map((a) => ({
      id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      source: a.source,
      notes: a.notes,
      customer: a.customers?.name ?? null,
      customer_email: a.customers?.email ?? null,
      staff: a.staff?.name ?? null,
      service: a.services?.name ?? null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(appointments) }],
      structuredContent: { appointments },
    };
  },
});
