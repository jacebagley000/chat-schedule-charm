import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DraftInput = z.object({
  name: z.string().trim().min(1).max(200),
  businessName: z.string().trim().max(200).optional(),
  inquiry: z.string().trim().min(1).max(4000),
  preferredCallTime: z.string().trim().max(200).optional(),
});

export type DraftResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; status: number; error: string };

/** Drafts a personalized follow-up email with the AI Gateway. Admin only. */
export const draftLeadFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DraftInput.parse(d))
  .handler(async ({ data, context }): Promise<DraftResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false, status: 403, error: "Forbidden" };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, status: 401, error: "AI is not configured." };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const prompt = [
      `Lead name: ${data.name}`,
      data.businessName ? `Business: ${data.businessName}` : null,
      `Preferred call time: ${data.preferredCallTime || "not provided"}`,
      `Inquiry:\n${data.inquiry}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions:
          "You write warm, concise follow-up emails for FrontDesk AI, an AI receptionist and scheduling product. " +
          "Address the lead's specific inquiry, confirm their preferred call time if given (or ask for one), and sign off as 'The FrontDesk AI team'. " +
          "Keep the body under 180 words, plain text, no placeholders like [Name]. " +
          "Reply exactly in this format:\nSUBJECT: <subject line>\n\n<email body>",
        messages: [{ role: "user", content: prompt }],
        maxRetries: 0,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      } as any);
      const text = (await result.text).trim();
      if (!text) return { ok: false, status: 502, error: "The AI returned an empty draft." };
      const match = text.match(/^SUBJECT:\s*(.+)\n+([\s\S]*)$/i);
      return match
        ? { ok: true, subject: match[1]!.trim(), body: match[2]!.trim() }
        : { ok: true, subject: `Following up, ${data.name}`, body: text };
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 500;
      const message =
        status === 429
          ? "Too many requests right now — please try again in a minute."
          : status === 402
            ? "Your workspace is out of AI credits. Add more in Settings → Plans & credits."
            : (err?.message ?? "Could not draft the email.");
      return { ok: false, status, error: message };
    }
  });
