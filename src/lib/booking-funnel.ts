import { supabase } from "@/integrations/supabase/client";

export type FunnelEvent = "view" | "click_calendly" | "click_home";

function visitId(): string {
  const key = "fd_booking_visit";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

/** Records a step on /booking-confirmed. Fire-and-forget; never blocks the visitor. */
export function trackBookingStep(event: FunnelEvent, bookingStatus?: string): void {
  if (typeof window === "undefined") return;
  const id = visitId();
  if (event === "view") {
    const seen = `fd_booking_viewed_${id}`;
    if (sessionStorage.getItem(seen)) return; // count one view per visit, not per refresh
    sessionStorage.setItem(seen, "1");
  }
  void supabase
    .from("booking_funnel_events")
    .insert({ event, visit_id: id, booking_status: bookingStatus?.slice(0, 32) ?? null })
    .then(({ error }) => error && console.warn("booking funnel", error.message));
}
