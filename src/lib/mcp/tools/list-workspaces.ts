import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_workspaces",
  title: "List workspaces",
  description: "List the business workspaces the signed-in user belongs to, with their IDs and timezones.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("businesses")
      .select("id, name, industry, timezone, phone")
      .order("name");
    if (error) throw new ToolError(error.message);
    const workspaces = (data ?? []).map((b) => ({
      id: b.id, name: b.name, industry: b.industry, timezone: b.timezone, phone: b.phone,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(workspaces) }],
      structuredContent: { workspaces },
    };
  },
});
