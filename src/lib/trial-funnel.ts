import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

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

/**
 * Google OAuth sign-ups can't pass user metadata at sign-up time, so the
 * trial visit id is attached to the account afterwards. Without this the
 * trial funnel never counts Google sign-ups past "Started free trial".
 */
export async function backfillTrialVisitId(): Promise<void> {
  const visitId = getTrialVisitId();
  if (!visitId) return;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || user.user_metadata?.trial_visit_id) return;
  const { error } = await supabase.auth.updateUser({ data: { trial_visit_id: visitId } });
  if (error) console.warn("trial visit backfill", error.message);
}

export function trackTrialStep(event: "view" | "click_start", plan?: string): void {
  const id = getTrialVisitId(true);
  if (!id) return;
  if (event === "view") {
    const seen = `fd_trial_viewed_${id}`;
    if (sessionStorage.getItem(seen)) return;
    sessionStorage.setItem(seen, "1");
  }
  trackEvent({
    name: event === "view" ? "trial_page_view" : "trial_start",
    page: "/trial",
    plan,
  });
  void supabase
    .from("trial_funnel_events")
    .insert({ event, visit_id: id, plan: plan?.slice(0, 64) ?? null })
    .then(({ error }) => error && console.warn("trial funnel", error.message));
}
