// Client-only: marks that this visitor did something worth returning for
// (posted a trip/request, booked a seat). The install prompt gates on it so
// we never push installs at drive-by visitors (docs/PRD.md — Install UX).

export const ENGAGED_KEY = "serfees-engaged";
export const ENGAGED_EVENT = "serfees-engaged";

export function markEngaged(): void {
  try {
    localStorage.setItem(ENGAGED_KEY, "1");
    // Same-page signal: the install banner is already mounted in the layout.
    window.dispatchEvent(new Event(ENGAGED_EVENT));
  } catch {
    // Storage unavailable (private mode) — the banner just stays gated.
  }
}

export function isEngaged(): boolean {
  try {
    return localStorage.getItem(ENGAGED_KEY) !== null;
  } catch {
    return false;
  }
}
