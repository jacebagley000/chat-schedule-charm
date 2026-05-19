import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

/**
 * Meta (Instagram + Facebook Messenger) webhook receiver.
 *
 * GET: verifies subscription via hub.challenge.
 * POST: validates x-hub-signature-256, ingests each messaging event into
 *       customers/conversations/messages, optionally tags it with Lovable AI,
 *       and always creates a scheduling_request row.
 *
 * Configure in Meta App Dashboard → Webhooks:
 *   Callback URL: https://project--49ad1ab5-53b2-4202-aa37-7b3c76aa603a.lovable.app/api/public/webhooks/meta
 *   Verify token: value of META_VERIFY_TOKEN
 *   Subscribe Page to: messages, messaging_postbacks
 *   Subscribe IG to:   messages
 */

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: unknown;
  };
  postback?: { title?: string; payload?: string };
};

type MetaEntry = {
  id?: string;
  time?: number;
  messaging?: MetaMessagingEvent[];
};

type MetaWebhookPayload = {
  object?: string; // "page" | "instagram"
  entry?: MetaEntry[];
};

type AiTag = {
  is_booking: boolean | null;
  confidence: number | null;
  service_hint: string | null;
  requested_at: string | null;
  party_size: number | null;
  notes: string | null;
};

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return safeEqual(provided, expected);
}

async function tagWithAi(text: string): Promise<AiTag | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey || !text.trim()) return null;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      is_booking: { type: "boolean" },
      confidence: { type: "number" },
      service_hint: { type: ["string", "null"] },
      requested_at: {
        type: ["string", "null"],
        description: "ISO 8601 datetime if the user proposed a specific time, else null",
      },
      party_size: { type: ["integer", "null"] },
      notes: { type: ["string", "null"] },
    },
    required: ["is_booking", "confidence", "service_hint", "requested_at", "party_size", "notes"],
  };

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You classify customer DMs to a local service business. Detect whether the message is a booking/scheduling request and extract any hints. Use null when unsure. Do not invent times.",
          },
          { role: "user", content: text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "tag_scheduling_request",
              description: "Tag the message with scheduling intent and extracted fields.",
              parameters: schema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "tag_scheduling_request" } },
      }),
    });

    if (!res.ok) {
      console.warn(`[meta-webhook] AI tag failed: ${res.status}`);
      return null;
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      }>;
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    const parsed = JSON.parse(args) as Partial<AiTag>;
    return {
      is_booking: parsed.is_booking ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      service_hint: parsed.service_hint ?? null,
      requested_at: parsed.requested_at ?? null,
      party_size: typeof parsed.party_size === "number" ? parsed.party_size : null,
      notes: parsed.notes ?? null,
    };
  } catch (err) {
    console.warn("[meta-webhook] AI tag threw:", err);
    return null;
  }
}

async function upsertCustomer(businessId: string, senderId: string, name: string | null) {
  // Try to find an existing customer by notes containing the external sender id.
  const tag = `meta:${senderId}`;
  const existing = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .ilike("notes", `%${tag}%`)
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) return existing.data.id;

  const inserted = await supabaseAdmin
    .from("customers")
    .insert({
      business_id: businessId,
      name: name ?? `Meta user ${senderId.slice(-6)}`,
      notes: tag,
    })
    .select("id")
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

async function upsertConversation(
  businessId: string,
  customerId: string,
  channel: "instagram" | "facebook",
  externalThreadId: string,
) {
  const existing = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("channel", channel)
    .eq("external_id", externalThreadId)
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) {
    await supabaseAdmin
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", existing.data.id);
    return existing.data.id;
  }

  const inserted = await supabaseAdmin
    .from("conversations")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      channel,
      external_id: externalThreadId,
      status: "open",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

async function processEvent(
  businessId: string,
  channel: "instagram" | "facebook",
  event: MetaMessagingEvent,
) {
  if (event.message?.is_echo) return; // skip our own outbound echoes
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  if (!senderId || !recipientId) return;

  const text = event.message?.text ?? event.postback?.payload ?? event.postback?.title ?? "";
  if (!text && !event.message?.attachments) return;

  const customerId = await upsertCustomer(businessId, senderId, null);
  // Thread is uniquely identified by the pair (page/ig account, sender).
  const externalThreadId = `${recipientId}:${senderId}`;
  const conversationId = await upsertConversation(businessId, customerId, channel, externalThreadId);

  const messageInsert = await supabaseAdmin
    .from("messages")
    .insert({
      business_id: businessId,
      conversation_id: conversationId,
      direction: "inbound",
      sender: "customer",
      body: text || null,
      metadata: event as unknown as Json,
    })
    .select("id")
    .single();

  if (messageInsert.error) throw messageInsert.error;

  const ai = text ? await tagWithAi(text) : null;

  const reqInsert = await supabaseAdmin.from("scheduling_requests").insert({
    business_id: businessId,
    conversation_id: conversationId,
    message_id: messageInsert.data.id,
    customer_id: customerId,
    channel,
    status: "new",
    raw_text: text || null,
    external_sender_id: senderId,
    external_sender_name: null,
    ai_is_booking: ai?.is_booking ?? null,
    ai_confidence: ai?.confidence ?? null,
    ai_service_hint: ai?.service_hint ?? null,
    ai_requested_at: ai?.requested_at ?? null,
    ai_party_size: ai?.party_size ?? null,
    ai_notes: ai?.notes ?? null,
    metadata: { meta_event: event } as unknown as Json,
  });

  if (reqInsert.error) throw reqInsert.error;
}

export const Route = createFileRoute("/api/public/webhooks/meta")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = process.env.META_VERIFY_TOKEN;

        if (!verifyToken) return new Response("Server misconfigured", { status: 500 });
        if (mode === "subscribe" && token && safeEqual(token, verifyToken) && challenge) {
          return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const appSecret = process.env.META_APP_SECRET;
        const businessId = process.env.META_DEFAULT_BUSINESS_ID;
        if (!appSecret || !businessId) {
          console.error("[meta-webhook] Missing META_APP_SECRET or META_DEFAULT_BUSINESS_ID");
          return new Response("Server misconfigured", { status: 500 });
        }

        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256");
        if (!verifySignature(rawBody, signature, appSecret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: MetaWebhookPayload;
        try {
          payload = JSON.parse(rawBody) as MetaWebhookPayload;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const object = payload.object;
        if (object !== "page" && object !== "instagram") {
          // Acknowledge but ignore other subscriptions.
          return new Response("ok", { status: 200 });
        }
        const channel: "instagram" | "facebook" = object === "instagram" ? "instagram" : "facebook";

        // Process events but always 200 to Meta to avoid redelivery storms.
        for (const entry of payload.entry ?? []) {
          for (const event of entry.messaging ?? []) {
            try {
              await processEvent(businessId, channel, event);
            } catch (err) {
              console.error("[meta-webhook] event processing failed:", err);
            }
          }
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
