import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const leadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(50).optional(),
  businessName: z.string().trim().max(200).optional(),
  preferredCallTime: z.string().datetime().optional(),
  sourcePage: z.string().min(1).max(500),
  notes: z.string().trim().max(1000).optional(),
  utmSource: z.string().trim().max(200).optional(),
  utmMedium: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
});

function createAnonClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((data) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = createAnonClient();
    const { error } = await supabase.from("leads").insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      business_name: data.businessName,
      preferred_call_time: data.preferredCallTime,
      source_page: data.sourcePage,
      notes: data.notes,
      utm_source: data.utmSource,
      utm_medium: data.utmMedium,
      utm_campaign: data.utmCampaign,
    });

    if (error) {
      throw new Error(`Failed to save lead: ${error.message}`);
    }

    return { success: true };
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (roleError) {
      throw new Error(`Role check failed: ${roleError.message}`);
    }

    if (!isAdmin) {
      throw new Error("Forbidden");
    }

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load leads: ${error.message}`);
    }

    return { leads: data };
  });
