const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? "";
const ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID?.trim() ?? "";
const ADS_LABEL =
  import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL?.trim() ?? "";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

function bootGtag(): void {
  if (!GA_ID && !ADS_ID) return;
  if (document.getElementById("ga-gtag")) return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  if (GA_ID) window.gtag("config", GA_ID, { anonymize_ip: true });
  if (ADS_ID) window.gtag("config", ADS_ID);

  const script = document.createElement("script");
  script.id = "ga-gtag";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    GA_ID || ADS_ID
  )}`;
  document.head.appendChild(script);
}

export function trackWebEvent(
  name: string,
  params?: Record<string, string>
): void {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

export function trackStoreClick(store: "ios" | "android"): void {
  trackWebEvent("store_click", { store });
  if (ADS_ID && ADS_LABEL && typeof window.gtag === "function") {
    window.gtag("event", "conversion", {
      send_to: `${ADS_ID}/${ADS_LABEL}`,
      store,
    });
  }
}

bootGtag();
