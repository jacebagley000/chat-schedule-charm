import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWorkspaces from "./tools/list-workspaces";
import listStaffAndServices from "./tools/list-staff-and-services";
import listAppointments from "./tools/list-appointments";
import createAppointment from "./tools/create-appointment";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "business-buddy-connect",
  title: "Business Buddy Connect",
  version: "0.1.0",
  instructions:
    "Scheduling tools for FrontDesk AI workspaces. Start with `list_workspaces`, then `list_staff_and_services` for valid IDs. Use `list_appointments` to see the calendar and `create_appointment` to book.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listWorkspaces, listStaffAndServices, listAppointments, createAppointment],
});
