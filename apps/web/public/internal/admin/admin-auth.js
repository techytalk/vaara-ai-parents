/**
 * Shared ops-admin auth for /internal/admin/*.html
 * Login issues a 12h Bearer token stored in localStorage.
 */
(function (global) {
  const TOKEN_KEY = "vaara_ops_admin_token";
  const EMAIL_KEY = "vaara_ops_admin_email";
  const API_BASE = "https://api.vaara.ai";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getEmail() {
    return localStorage.getItem(EMAIL_KEY) || "";
  }

  function setSession(token, email) {
    localStorage.setItem(TOKEN_KEY, token);
    if (email) localStorage.setItem(EMAIL_KEY, email);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  }

  function loginUrl() {
    const next = location.pathname + location.search;
    return "/internal/admin/login.html?next=" + encodeURIComponent(next);
  }

  function headers(json) {
    const h = {};
    if (json) h["Content-Type"] = "application/json";
    const token = getToken();
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
  }

  async function requireAuth() {
    const token = getToken();
    if (!token) {
      location.replace(loginUrl());
      return false;
    }
    try {
      const res = await fetch(API_BASE + "/internal/admin/me", {
        headers: headers(false),
      });
      if (!res.ok) {
        clearSession();
        location.replace(loginUrl());
        return false;
      }
      const data = await res.json();
      if (data.email) localStorage.setItem(EMAIL_KEY, data.email);
      return true;
    } catch {
      clearSession();
      location.replace(loginUrl());
      return false;
    }
  }

  function logout() {
    clearSession();
    location.replace("/internal/admin/login.html");
  }

  const NAV_GROUPS = [
    {
      label: "Overview",
      items: [{ href: "/internal/admin/", label: "Dashboard" }],
    },
    {
      label: "Parents",
      items: [
        { href: "/internal/admin/signups.html", label: "Signups" },
        { href: "/internal/admin/moderation.html", label: "Moderation" },
        { href: "/internal/admin/seeds.html", label: "Seed parents" },
        { href: "/internal/admin/lucky-gift.html", label: "Lucky gift" },
      ],
    },
    {
      label: "Community",
      items: [
        { href: "/internal/admin/circles.html", label: "Circles" },
        { href: "/internal/admin/qr.html", label: "QR codes" },
      ],
    },
    {
      label: "Schools",
      items: [
        { href: "/internal/admin/directory.html", label: "Directory" },
        { href: "/internal/admin/compare.html", label: "Compare" },
        { href: "/internal/admin/schools.html", label: "School tools" },
      ],
    },
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currentAdminPath() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path.endsWith("/internal/admin/index.html")) return "/internal/admin/";
    if (path.endsWith("/internal/admin")) return "/internal/admin/";
    return path.endsWith(".html") ? path : path + "/";
  }

  function isActiveHref(href) {
    const path = currentAdminPath();
    if (href === "/internal/admin/") {
      return path === "/internal/admin/" || path.endsWith("/internal/admin/index.html");
    }
    return path.endsWith(href);
  }

  function ensureNavStyles() {
    if (document.getElementById("vaaraAdminNavStyles")) return;
    const style = document.createElement("style");
    style.id = "vaaraAdminNavStyles";
    style.textContent = `
      body.vaara-admin-body { padding-top: 0 !important; overflow-x: clip; }
      .vaara-admin-bar {
        position: sticky;
        top: 0;
        z-index: 50;
        width: 100vw;
        margin-left: calc(50% - 50vw);
        margin-right: calc(50% - 50vw);
        margin-bottom: 20px;
        background: #fff;
        border-bottom: 1px solid #e8e3db;
        box-shadow: 0 1px 0 rgba(13, 27, 42, 0.03);
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        color: #0d1b2a;
      }
      .vaara-admin-bar-inner {
        max-width: 1280px;
        margin: 0 auto;
        padding: 10px 24px 12px;
      }
      .vaara-admin-bar-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8px;
      }
      .vaara-admin-brand {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
        text-decoration: none;
        color: inherit;
      }
      .vaara-admin-brand strong {
        font-size: 1.05rem;
        letter-spacing: -0.02em;
        color: #08786d;
      }
      .vaara-admin-brand span {
        font-size: 0.8rem;
        font-weight: 600;
        color: #5e6974;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .vaara-admin-account {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .vaara-admin-email {
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.82rem;
        color: #5e6974;
      }
      .vaara-admin-bar .vaara-admin-logout {
        margin: 0;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid #e8e3db;
        background: #fffcf7;
        color: #0d1b2a;
        font: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
      }
      .vaara-admin-bar .vaara-admin-logout:hover {
        background: #f7f4ee;
        border-color: #d9d3c8;
      }
      .vaara-admin-nav {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px 8px;
      }
      .vaara-admin-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        padding-right: 16px;
      }
      .vaara-admin-group + .vaara-admin-group {
        padding-left: 16px;
        border-left: 1px solid #efeae2;
      }
      .vaara-admin-group-label {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #8a939c;
        padding-left: 4px;
      }
      .vaara-admin-links {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .vaara-admin-bar a.vaara-admin-link {
        display: inline-flex;
        align-items: center;
        padding: 6px 11px;
        border-radius: 999px;
        text-decoration: none;
        color: #334155;
        font-size: 0.86rem;
        font-weight: 600;
        line-height: 1.2;
      }
      .vaara-admin-bar a.vaara-admin-link:hover {
        background: #f7f4ee;
        color: #0d1b2a;
      }
      .vaara-admin-bar a.vaara-admin-link.is-active {
        background: #eaf8f6;
        color: #08786d;
      }
      @media (max-width: 720px) {
        .vaara-admin-bar-inner { padding: 10px 14px 12px; }
        .vaara-admin-email { max-width: 120px; }
        .vaara-admin-group + .vaara-admin-group {
          padding-left: 0;
          border-left: none;
        }
      }
      @media (min-width: 960px) {
        .vaara-admin-nav { flex-wrap: nowrap; }
        .vaara-admin-email { max-width: 280px; }
      }
    `;
    document.head.appendChild(style);
  }

  function mountBar(navEl) {
    ensureNavStyles();
    document.body.classList.add("vaara-admin-body");
    const email = getEmail() || "admin";
    const groupsHtml = NAV_GROUPS.map((group) => {
      const links = group.items
        .map((item) => {
          const active = isActiveHref(item.href);
          return (
            '<a class="vaara-admin-link' +
            (active ? " is-active" : "") +
            '" href="' +
            item.href +
            '"' +
            (active ? ' aria-current="page"' : "") +
            ">" +
            escapeHtml(item.label) +
            "</a>"
          );
        })
        .join("");
      return (
        '<div class="vaara-admin-group">' +
        '<div class="vaara-admin-group-label">' +
        escapeHtml(group.label) +
        "</div>" +
        '<div class="vaara-admin-links">' +
        links +
        "</div></div>"
      );
    }).join("");

    const header = document.createElement("header");
    header.className = "vaara-admin-bar";
    header.innerHTML =
      '<div class="vaara-admin-bar-inner">' +
      '<div class="vaara-admin-bar-top">' +
      '<a class="vaara-admin-brand" href="/internal/admin/">' +
      "<strong>Vaara</strong><span>Admin</span></a>" +
      '<div class="vaara-admin-account">' +
      '<span class="vaara-admin-email" title="' +
      escapeHtml(email) +
      '">' +
      escapeHtml(email) +
      "</span>" +
      '<button type="button" class="vaara-admin-logout" id="vaaraAdminLogout">Log out</button>' +
      "</div></div>" +
      '<nav class="vaara-admin-nav" aria-label="Admin">' +
      groupsHtml +
      "</nav></div>";

    if (navEl && navEl.parentNode) navEl.replaceWith(header);
    else document.body.prepend(header);

    header.querySelector("#vaaraAdminLogout")?.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  global.VaaraAdmin = {
    API_BASE,
    getToken,
    getEmail,
    setSession,
    clearSession,
    headers,
    requireAuth,
    logout,
    mountBar,
  };
})(window);
