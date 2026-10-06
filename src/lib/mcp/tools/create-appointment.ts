import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_appointment",
  title: "Book appointment",
  description: "Book an appointment in a workspace for a customer with a staff member and service. Fails if the staff member is already booked at that time.",
  inputSchema: {
    workspace_id: z.string().uuid().describe("Workspace ID from list_workspaces."),
    service_id: z.string().uuid().describe("Service ID from list_staff_and_services."),
    staff_id: z.string().uuid().describe("Staff ID from list_staff_and_services."),
    starts_at: z.string().datetime({ offset: true }).describe("Start time (ISO 8601 with offset)."),
    customer_name: z.string().trim().min(1).max(100),
    customer_email: z.string().trim().email().max(255).optional(),
    customer_phone: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(1000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: service, error: sErr } = await sb
      .from("services").select("duration_minutes").eq("id", input.service_id).eq("business_id", input.workspace_id).maybeSingle();
    if (sErr) throw new ToolError(sErr.message);
    if (!service) throw new ToolError("Service not found in this workspace.");

    const start = new Date(input.starts_at);
    const end = new Date(start.getTime() + service.duration_minutes * 60_000);

    let customerId: string | undefined;
    if (input.customer_email) {
      const { data } = await sb.from("customers").select("id")
        .eq("business_id", input.workspace_id).ilike("email", input.customer_email).limit(1).maybeSingle();
      customerId = data?.id;
    }
    if (!customerId) {
      const { data, error } = await sb.from("customers").insert({
        business_id: input.workspace_id, name: input.customer_name,
        email: input.customer_email ?? null, phone: input.customer_phone ?? null,
      }).select("id").single();
      if (error) throw new ToolError(error.message);
      customerId = data.id;
    }

    const { data: appt, error } = await sb.from("appointments").insert({
      business_id: input.workspace_id, service_id: input.service_id, staff_id: input.staff_id,
      customer_id: customerId, starts_at: start.toISOString(), ends_at: end.toISOString(),
      status: "confirmed", source: "manual", notes: input.notes ?? null,
    }).select("id, starts_at, ends_at, status").single();
    if (error) throw new ToolError(error.message);

    const appointment = { id: appt.id, starts_at: appt.starts_at, ends_at: appt.ends_at, status: appt.status };
    return {
      content: [{ type: "text", text: `Booked ${input.customer_name} from ${appt.starts_at} to ${appt.ends_at}.` }],
      structuredContent: { appointment },
    };
  },
});
