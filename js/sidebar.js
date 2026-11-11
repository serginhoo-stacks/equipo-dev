(() => {
  "use strict";

  const HOST_SELECTOR = ".menu-container";
  const SIDEBAR_URL = new URL("../componentes/sidebar.html", window.location.href);
  const LOGIN_URL = new URL("../login.html", window.location.href);

  function readCachedUser() {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch {
      return null;
    }
  }

  function currentCompanyId() {
    return new URLSearchParams(window.location.search).get("empresa_id");
  }

  function addCompanyContext(sidebar) {
    const companyId = currentCompanyId();
    if (!companyId) return;

    sidebar.querySelectorAll("a[data-company-context]").forEach((link) => {
      const target = new URL(link.getAttribute("href"), window.location.href);
      target.searchParams.set("empresa_id", companyId);
      link.href = `${target.pathname}${target.search}${target.hash}`;
    });

    const label = sidebar.querySelector("[data-sidebar-company]");
    if (label) label.textContent = "Empresa em uso";
  }

  function setUserDetails(sidebar) {
    const user = readCachedUser();
    if (!user) return;

    const name = String(user.nome || user.name || user.email?.split("@")[0] || "Usuário").trim();
    const role = String(user.nivel_acesso || user.cargo || "Conta conectada").trim();
    const nameElement = sidebar.querySelector("[data-sidebar-user-name]");
    const roleElement = sidebar.querySelector("[data-sidebar-user-role]");
    const avatar = sidebar.querySelector("[data-sidebar-avatar]");

    if (nameElement) nameElement.textContent = name || "Usuário";
    if (roleElement) roleElement.textContent = role || "Conta conectada";
    if (avatar) {
      const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
      avatar.textContent = initials.toUpperCase() || "U";
    }

    const normalizedRole = role.toLocaleLowerCase("pt-BR");
    const knownRole = Boolean(user.nivel_acesso || user.cargo);
    const isAdmin = ["adm", "admin", "administrador", "administradora", "proprietario", "proprietária", "owner"].includes(normalizedRole);
    if (knownRole && !isAdmin) {
      sidebar.querySelectorAll(".admin-only").forEach((item) => { item.hidden = true; });
    }
  }

  function setActiveLink(sidebar) {
    const currentPage = window.location.pathname.split("/").pop().replace(/\.html?$/i, "").toLowerCase();
    sidebar.querySelectorAll(".erp-nav-link, .erp-nav-sublink").forEach((link) => {
      const pages = (link.dataset.pages || "").split(/\s+/).filter(Boolean);
      const active = pages.includes(currentPage);
      if (active) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
    });
  }

  function bindDrawer(sidebar) {
    const toggle = sidebar.querySelector("[data-sidebar-toggle]");
    const closeButton = sidebar.querySelector("[data-sidebar-close]");
    const backdrop = sidebar.querySelector("[data-sidebar-backdrop]");
    const drawer = sidebar.querySelector("#erpSidebar");

    const close = () => {
      document.body.classList.remove("erp-sidebar-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      if (backdrop) backdrop.hidden = true;
    };
    const open = () => {
      document.body.classList.add("erp-sidebar-open");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
      if (backdrop) backdrop.hidden = false;
      closeButton?.focus();
    };

    toggle?.addEventListener("click", open);
    closeButton?.addEventListener("click", close);
    backdrop?.addEventListener("click", close);
    drawer?.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) close();
    });
  }

  function bindLogout(sidebar) {
    const button = sidebar.querySelector("[data-sidebar-logout]");
    if (!button) return;

    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        if (window.banco?.auth) {
          const { error } = await window.banco.auth.signOut();
          if (error) console.error("Não foi possível encerrar a sessão Supabase:", error);
        }
      } catch (error) {
        console.error("Erro ao sair da conta:", error);
      } finally {
        try { localStorage.removeItem("usuario"); } catch { /* storage indisponível */ }
        window.location.assign(LOGIN_URL.href);
      }
    });
  }

  async function loadSidebar(host) {
    try {
      const response = await fetch(SIDEBAR_URL, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Falha ao carregar a sidebar (${response.status})`);
      host.innerHTML = await response.text();

      const sidebar = host.querySelector(".erp-sidebar");
      if (!sidebar) throw new Error("O componente da sidebar não contém .erp-sidebar");

      document.body.classList.add("has-erp-sidebar");
      addCompanyContext(host);
      setUserDetails(host);
      setActiveLink(host);
      bindDrawer(host);
      bindLogout(host);
    } catch (error) {
      console.error("Não foi possível carregar a navegação do ERP:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(HOST_SELECTOR).forEach(loadSidebar);
  });
})();
