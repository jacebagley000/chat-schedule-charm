import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_staff_and_services",
  title: "List staff and services",
  description: "List the active staff members and services of one workspace, so appointments can be booked with valid IDs.",
  inputSchema: { workspace_id: z.string().uuid().describe("Workspace ID from list_workspaces.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ workspace_id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const [staffRes, servicesRes] = await Promise.all([
      sb.from("staff").select("id, name, role, location").eq("business_id", workspace_id).eq("active", true).order("name"),
      sb.from("services").select("id, name, duration_minutes, price_cents").eq("business_id", workspace_id).eq("active", true).order("name"),
    ]);
    if (staffRes.error) throw new ToolError(staffRes.error.message);
    if (servicesRes.error) throw new ToolError(servicesRes.error.message);
    const staff = (staffRes.data ?? []).map((s) => ({ id: s.id, name: s.name, role: s.role, location: s.location }));
    const services = (servicesRes.data ?? []).map((s) => ({
      id: s.id, name: s.name, duration_minutes: s.duration_minutes, price_cents: s.price_cents,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify({ staff, services }) }],
      structuredContent: { staff, services },
    };
  },
});
