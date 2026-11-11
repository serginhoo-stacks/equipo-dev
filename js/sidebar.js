(() => {
  "use strict";

  const HOST_SELECTOR = ".menu-container";
  const SIDEBAR_URL = new URL("../componentes/sidebar.html", window.location.href);
  const LOGIN_URL = new URL("../login.html", window.location.href);
  const COLLAPSED_KEY = "smartinspect:erp-sidebar-collapsed";

  function readCachedUser() {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch {
      return null;
    }
  }

  function currentCompanyId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("empresa_id") || params.get("empresa") || "";
  }

  function addCompanyContext(root) {
    const companyId = currentCompanyId();
    if (!companyId) return;

    root.querySelectorAll("a[data-company-context]").forEach((link) => {
      const target = new URL(link.getAttribute("href"), window.location.href);
      target.searchParams.delete("empresa");
      target.searchParams.set("empresa_id", companyId);
      link.href = `${target.pathname}${target.search}${target.hash}`;
      if (link.title === "") link.title = link.textContent.trim();
    });

    const label = root.querySelector("[data-sidebar-company]");
    if (label) label.textContent = "Carregando empresa…";
  }

  function setProfile(root, profile, authUser) {
    const cached = readCachedUser() || {};
    const user = profile || cached;
    const name = String(user.nome || user.name || authUser?.user_metadata?.nome || authUser?.email?.split("@")[0] || "Usuário").trim();
    const role = String(user.nivel_acesso || user.cargo || "Conta conectada").trim();
    const nameElement = root.querySelector("[data-sidebar-user-name]");
    const roleElement = root.querySelector("[data-sidebar-user-role]");
    const avatar = root.querySelector("[data-sidebar-avatar]");

    if (nameElement) nameElement.textContent = name || "Usuário";
    if (roleElement) roleElement.textContent = role || "Conta conectada";
    if (avatar) {
      const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR") || "U";
      if (user.foto_url) {
        const image = document.createElement("img");
        image.src = user.foto_url;
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        image.onerror = () => { avatar.replaceChildren(document.createTextNode(initials)); };
        avatar.replaceChildren(image);
      } else {
        avatar.textContent = initials;
      }
    }

    const normalizedRole = role.toLocaleLowerCase("pt-BR");
    const hasKnownRole = Boolean(user.nivel_acesso || user.cargo);
    const isAdmin = ["adm", "admin", "administrador", "administradora", "proprietario", "proprietária", "owner"].includes(normalizedRole);
    if (hasKnownRole && !isAdmin) {
      root.querySelectorAll(".admin-only").forEach((item) => { item.hidden = true; });
    }
  }

  async function loadAccountFromDatabase(root) {
    const db = window.banco;
    if (!db?.auth || typeof db.from !== "function") {
      setProfile(root, null, null);
      return null;
    }

    try {
      const { data: authResult, error: authError } = await db.auth.getUser();
      if (authError || !authResult?.user) {
        setProfile(root, null, null);
        return null;
      }

      let profile = null;
      const { data, error } = await db
        .from("usuarios")
        .select("*")
        .eq("auth_id", authResult.user.id)
        .maybeSingle();

      if (error) {
        console.warn("Não foi possível carregar o perfil da tabela usuarios:", error.message);
      } else {
        profile = data;
      }

      setProfile(root, profile, authResult.user);
      return { profile, authUser: authResult.user };
    } catch (error) {
      console.warn("Falha ao carregar o perfil da conta:", error);
      setProfile(root, null, null);
      return null;
    }
  }

  async function loadCompanyName(root) {
    const companyId = currentCompanyId();
    const label = root.querySelector("[data-sidebar-company]");
    if (!label) return;
    if (!companyId) {
      label.textContent = "Selecione uma empresa";
      return;
    }

    try {
      const db = window.banco;
      if (!db?.from) throw new Error("Cliente Supabase indisponível");
      const { data, error } = await db.from("empresas").select("id,nome").eq("id", companyId).maybeSingle();
      if (error) throw error;
      label.textContent = data?.nome || "Empresa em uso";
    } catch (error) {
      console.warn("Não foi possível carregar o nome da empresa:", error?.message || error);
      label.textContent = "Empresa em uso";
    }
  }

  async function loadUnreadNotifications(root, account) {
    const badge = root.querySelector("#badgeNotificacoes");
    if (!badge) return;
    const userId = account?.profile?.id;
    const db = window.banco;
    if (!userId || !db?.from) return;

    try {
      const { count, error } = await db
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", userId)
        .eq("lida", false);
      if (error) throw error;
      if (count > 0) {
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    } catch (error) {
      console.warn("Não foi possível consultar notificações não lidas:", error?.message || error);
    }
  }

  async function loadCompanyAndAccount(root) {
    const [account] = await Promise.all([
      loadAccountFromDatabase(root),
      loadCompanyName(root),
    ]);
    await loadUnreadNotifications(root, account);
  }

  function setActiveLink(root) {
    const currentPage = window.location.pathname.split("/").pop().replace(/\.html?$/i, "").toLowerCase();
    root.querySelectorAll(".erp-nav-link, .erp-nav-sublink").forEach((link) => {
      const pages = (link.dataset.pages || "").split(/\s+/).filter(Boolean);
      const active = pages.includes(currentPage);
      const label = link.querySelector("span:not(.erp-nav-badge)")?.textContent.trim() || link.textContent.trim();
      if (label) {
        link.title = label;
        link.setAttribute("aria-label", label);
      }
      if (active) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
    });
  }

  function bindCollapse(root) {
    const button = root.querySelector("[data-sidebar-collapse]");
    if (!button) return;

    const isCollapsed = () => document.body.classList.contains("erp-sidebar-collapsed");
    const render = (collapsed, persist = true) => {
      document.body.classList.toggle("erp-sidebar-collapsed", collapsed);
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
      button.title = collapsed ? "Expandir menu" : "Recolher menu";
      if (persist) {
        try { localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* preferência opcional */ }
      }
    };

    let saved = false;
    try { saved = localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { /* preferência opcional */ }
    render(saved && window.innerWidth > 900, false);
    window.addEventListener("resize", () => {
      let preferred = false;
      try { preferred = localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { /* preferência opcional */ }
      render(preferred && window.innerWidth > 900, false);
    });
    button.addEventListener("click", () => render(!isCollapsed()));
  }

  function bindDrawer(root) {
    const toggle = root.querySelector("[data-sidebar-toggle]");
    const closeButton = root.querySelector("[data-sidebar-close]");
    const backdrop = root.querySelector("[data-sidebar-backdrop]");
    const drawer = root.querySelector("#erpSidebar");

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

  function preserveCompanyOnInternalLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      const companyId = currentCompanyId();
      if (!link || !companyId || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank") return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin || !target.pathname.includes("/ERP/") || !target.pathname.endsWith(".html")) return;
      if (target.pathname.endsWith("/perfil.html") || target.pathname.endsWith("/nova-senha.html")) return;
      if (!target.searchParams.has("empresa_id")) target.searchParams.set("empresa_id", companyId);
      link.href = `${target.pathname}${target.search}${target.hash}`;
    }, true);
  }

  function bindLogout(root) {
    const button = root.querySelector("[data-sidebar-logout]");
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
      if (!sidebar) throw new Error("O componente compartilhado não contém .erp-sidebar");

      document.body.classList.add("has-erp-sidebar");
      addCompanyContext(host);
      setActiveLink(host);
      bindCollapse(host);
      bindDrawer(host);
      bindLogout(host);
      preserveCompanyOnInternalLinks();
      void loadCompanyAndAccount(host);
    } catch (error) {
      console.error("Não foi possível carregar a navegação do ERP:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(HOST_SELECTOR).forEach(loadSidebar);
  });
})();
