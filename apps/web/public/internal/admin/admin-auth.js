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

  function mountBar(navEl) {
    if (!navEl) return;
    const email = getEmail() || "admin";
    const wrap = document.createElement("span");
    wrap.style.marginLeft = "10px";
    wrap.innerHTML =
      '<span style="color:#5e6974;font-size:0.85rem;">' +
      email.replace(/</g, "&lt;") +
      '</span> · <a href="#" id="vaaraAdminLogout">Log out</a>';
    navEl.appendChild(wrap);
    document.getElementById("vaaraAdminLogout")?.addEventListener("click", (e) => {
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
