export function trackEvent(
  event: string,
  payload?: Record<string, string | number | boolean | null>
) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  if (!w.dataLayer) w.dataLayer = [];
  w.dataLayer.push({ event, ...(payload ?? {}) });
}
