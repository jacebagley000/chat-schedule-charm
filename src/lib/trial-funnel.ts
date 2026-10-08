import { supabase } from "@/integrations/supabase/client";

const KEY = "fd_trial_visit";

/** Visit id kept across pages (localStorage) so sign-up can be tied back to the trial page. */
export function getTrialVisitId(create = false): string | null {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem(KEY);
  if (!id && create) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function trackTrialStep(event: "view" | "click_start", plan?: string): void {
  const id = getTrialVisitId(true);
  if (!id) return;
  if (event === "view") {
    const seen = `fd_trial_viewed_${id}`;
    if (sessionStorage.getItem(seen)) return;
    sessionStorage.setItem(seen, "1");
  }
  void supabase
    .from("trial_funnel_events")
    .insert({ event, visit_id: id, plan: plan?.slice(0, 64) ?? null })
    .then(({ error }) => error && console.warn("trial funnel", error.message));
}
