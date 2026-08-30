import { STORE_LINKS } from "./config";
import "./styles.css";

function bindStoreLinks(): void {
  const links: Array<{ selector: string; url: string }> = [
    { selector: "[data-store='ios']", url: STORE_LINKS.ios },
    { selector: "[data-store='android']", url: STORE_LINKS.android },
  ];

  for (const { selector, url } of links) {
    document.querySelectorAll<HTMLAnchorElement>(selector).forEach((el) => {
      if (url) {
        el.href = url;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
        el.classList.remove("is-soon");
        el.removeAttribute("aria-disabled");
        el.querySelectorAll(".store-soon").forEach((badge) => badge.remove());
        return;
      }

      el.href = "#download";
      el.classList.add("is-soon");
      el.setAttribute("aria-disabled", "true");
    });
  }
}

function setupNav(): void {
  const toggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const panel = document.querySelector<HTMLElement>("[data-nav-panel]");
  if (!toggle || !panel) return;

  const close = () => {
    panel.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };

  toggle.addEventListener("click", () => {
    const open = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
  });

  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", close);
  });
}

function setupHeader(): void {
  const header = document.querySelector<HTMLElement>("[data-header]");
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

bindStoreLinks();
setupNav();
setupHeader();
