(() => {
  "use strict";
  const db = window.banco;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const el = (id) => document.getElementById(id);
  const getUser = async () => {
    const { data, error } = await db.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error("Entre na sua conta para gerenciar convites.");
    return data.user;
  };
  const companyLabel = async (companyId) => {
    const { data } = await db.from("empresas").select("id,nome").eq("id", companyId).maybeSingle();
    return data?.nome || "Empresa";
  };
  async function mensagemErroFuncao(error) {
    if (error?.context && typeof error.context.json === "function") {
      try {
        const body = await error.context.json();
        return body?.message || body?.error || body?.mensagem || error.message;
      } catch { /* mantém a mensagem original */ }
    }
    return error?.message || "Não foi possível enviar o convite.";
  }
  async function sendInvite(companyId, email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!companyId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Informe uma empresa e um e-mail válido.");
    const { data, error } = await db.functions.invoke("enviar-convite-empresa", {
      body: { empresa_id: companyId, email: normalizedEmail },
    });
    if (error) throw new Error(await mensagemErroFuncao(error));
    if (!data?.ok) throw new Error(data?.message || "Não foi possível enviar o convite.");
    return data;
  }
  async function respond(invite, accepted) {
    const { data, error } = await db.rpc("responder_convite_empresa", {
      p_token: invite.token,
      p_aceitar: accepted,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) throw new Error(result?.mensagem || "Não foi possível responder ao convite.");
  }
  async function renderPersonalInvites(user) {
    const target = el("companyInvitationsList");
    if (!target) return;
    target.replaceChildren();
    const { data, error } = await db.from("convites_empresa").select("id,empresa_id,email,status,token,expires_at").ilike("email", user.email || "").eq("status", "pendente").limit(100);
    if (error) {
      target.innerHTML = '<p class="invite-empty">Não foi possível carregar os convites. Confira as políticas de acesso do Supabase.</p>';
      return;
    }
    if (!data?.length) {
      target.innerHTML = '<p class="invite-empty">Você não tem convites pendentes.</p>';
      return;
    }
    for (const invite of data) {
      const name = await companyLabel(invite.empresa_id);
      const card = document.createElement("article");
      card.className = "invite-card";
      card.innerHTML = `<div class="invite-copy"><strong>${esc(name)}</strong><span>Convite para ${esc(invite.email)}</span></div><div class="invite-actions"><button class="invite-accept" type="button">Aceitar convite</button><button class="invite-decline" type="button">Recusar</button></div>`;
      const update = async (accepted) => {
        card.querySelectorAll("button").forEach((button) => { button.disabled = true; });
        try {
          await respond(invite, accepted);
          card.remove();
          if (!target.children.length) target.innerHTML = '<p class="invite-empty">Você não tem convites pendentes.</p>';
          if (el("inviteCount")) el("inviteCount").textContent = String(Math.max(0, Number(el("inviteCount").textContent) - 1));
          if (accepted) window.SmartInspectInviteMessage?.("Convite aceito. A empresa agora aparece entre seus ambientes autorizados.");
        } catch (err) {
          card.querySelectorAll("button").forEach((button) => { button.disabled = false; });
          window.SmartInspectInviteMessage?.(err.message || "Não foi possível responder ao convite.", true);
        }
      };
      card.querySelector(".invite-accept").addEventListener("click", () => update(true));
      card.querySelector(".invite-decline").addEventListener("click", () => update(false));
      target.append(card);
    }
  }
  async function initPersonal() {
    const form = el("personalInviteForm");
    const personalDialog = el("personalInviteDialog");
    const openButton = el("openPersonalInvite");
    const closeButton = el("closePersonalInvite");
    openButton?.addEventListener("click", (event) => {
      event.preventDefault();
      if (personalDialog && !personalDialog.open) personalDialog.showModal();
    });
    closeButton?.addEventListener("click", () => personalDialog?.close());
    if (!db?.auth) return;
    try {
      const user = await getUser();
      await renderPersonalInvites(user);
      const select = el("personalInviteCompany");
      const status = el("personalInviteStatus");
      if (!form || !select) return;
      const { data, error } = await db.from("membros_empresa").select("empresa_id,cargo,empresa:empresas(id,nome)").eq("usuario_id", user.id).eq("ativo", true).limit(100);
      if (!error) {
        const managed = (data || []).filter((row) => ["adm", "admin", "administrador", "administradora", "proprietario", "proprietária", "owner"].includes(String(row.cargo || "").toLocaleLowerCase("pt-BR")));
        for (const row of managed) {
          const company = Array.isArray(row.empresa) ? row.empresa[0] : row.empresa;
          if (!company) continue;
          const option = document.createElement("option"); option.value = company.id; option.textContent = company.nome || "Empresa"; select.append(option);
        }
      }
      if (select.options.length <= 1) {
        select.innerHTML = '<option value="">Nenhuma empresa administrável disponível</option>';
        form.querySelector("button[type=submit]").disabled = true;
      }
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type=submit]"); button.disabled = true;
        status.textContent = "Registrando convite…"; status.classList.remove("is-error");
        try {
          const result = await sendInvite(select.value, el("personalInviteEmail").value);
          status.textContent = result.email_sent ? "Convite enviado por e-mail." : (result.message || "Convite registrado, mas o e-mail não foi enviado.");
          form.reset();
          await renderPersonalInvites(user);
        } catch (err) { status.textContent = err.message || "Não foi possível enviar o convite."; status.classList.add("is-error"); }
        finally { if (select.options.length > 1) button.disabled = false; }
      });
    } catch (error) {
      console.warn("Convites do painel pessoal indisponíveis:", error.message);
    }
  }
  async function initErp() {
    if (!db?.auth) return;
    const companyId = new URLSearchParams(location.search).get("empresa_id") || new URLSearchParams(location.search).get("empresa");
    const form = el("erpInviteForm");
    const list = el("erpInviteList");
    if (!form || !list || !companyId) {
      if (list) list.innerHTML = '<p class="invite-empty">Selecione uma empresa pelo painel pessoal para gerenciar os convites.</p>';
      if (form) form.hidden = true;
      return;
    }
    try {
      const user = await getUser();
      const { data: member, error: memberError } = await db.from("membros_empresa").select("cargo,ativo").eq("empresa_id", companyId).eq("usuario_id", user.id).eq("ativo", true).maybeSingle();
      const permitted = !memberError && member && ["adm", "admin", "administrador", "administradora", "proprietario", "proprietária", "owner"].includes(String(member.cargo || "").toLocaleLowerCase("pt-BR"));
      if (!permitted) {
        form.hidden = true;
        el("erpInviteAccessNote").textContent = "Somente proprietários e administradores ativos podem convidar pessoas para esta empresa.";
      } else {
        el("erpInviteAccessNote").textContent = "Convide uma pessoa pelo e-mail que ela usa no SmartInspect. O convite ficará disponível no painel pessoal dela.";
        form.addEventListener("submit", async (event) => {
          event.preventDefault(); const button = form.querySelector("button[type=submit]"); button.disabled = true;
          const status = el("erpInviteStatus"); status.textContent = "Registrando convite…"; status.classList.remove("is-error");
          try { const result = await sendInvite(companyId, el("erpInviteEmail").value); status.textContent = result.email_sent ? "Convite enviado por e-mail." : (result.message || "Convite registrado, mas o e-mail não foi enviado."); form.reset(); await loadSentInvites(companyId, list); }
          catch (err) { status.textContent = err.message || "Não foi possível enviar o convite."; status.classList.add("is-error"); }
          finally { button.disabled = false; }
        });
      }
      await loadSentInvites(companyId, list);
    } catch (error) { list.innerHTML = `<p class="invite-empty">${esc(error.message || "Não foi possível carregar os convites.")}</p>`; }
  }
  async function loadSentInvites(companyId, list) {
    const { data, error } = await db.from("convites_empresa").select("id,email,status").eq("empresa_id", companyId).order("id", { ascending: false }).limit(100);
    list.replaceChildren();
    if (error) { list.innerHTML = '<p class="invite-empty">Não foi possível consultar os convites. Verifique as políticas RLS no Supabase.</p>'; return; }
    const rows = data || [];
    if (!rows.length) { list.innerHTML = '<p class="invite-empty">Nenhum convite enviado para esta empresa.</p>'; return; }
    for (const row of rows) {
      const item = document.createElement("article"); item.className = "invite-card";
      const state = row.status === "pendente" ? "Pendente" : row.status === "aceito" ? "Aceito" : row.status || "Encerrado";
      item.innerHTML = `<div class="invite-copy"><strong>${esc(row.email)}</strong><span>Convite de acesso à equipe</span></div><span class="invite-state ${row.status === "pendente" ? "pending" : "done"}">${esc(state)}</span>`;
      list.append(item);
    }
  }
  window.SmartInspectInviteMessage = (message, isError = false) => {
    const target = el("pageMessage");
    if (!target) return;
    target.textContent = message; target.className = `page-message show${isError ? " error" : ""}`;
  };
  window.SmartInspectInvites = { initPersonal, initErp };
  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.classList.contains("personal-page")) void initPersonal();
    if (document.body.classList.contains("erp-page--convites")) void initErp();
  }, { once: true });
})();
