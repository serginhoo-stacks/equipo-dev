/* SmartInspect Notifications — fonte única de dados para painel pessoal e ERP. */
(function (global) {
  "use strict";

  function escapeSelector(value) {
    return String(value || "").replace(/([\\])/g, "\\$1");
  }

  async function currentProfile(db) {
    if (!db?.auth || typeof db.from !== "function") return null;
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError || !authData?.user) return null;
    let profile = null;
    const { data, error } = await db.rpc("perfil_obter_meu");
    if (!error) profile = Array.isArray(data) ? data[0] || null : data;
    return { ...(profile || {}), id: authData.user.id, auth_id: authData.user.id, email: profile?.email || authData.user.email };
  }

  async function list(db, profileId, options = {}) {
    if (!db?.from || !profileId) return [];
    let query = db.from("notificacoes").select("*").eq("usuario_id", profileId).order("criado_em", { ascending: false });
    if (options.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function unreadCount(db, profileId) {
    if (!db?.from || !profileId) return 0;
    const { count, error } = await db.from("notificacoes").select("id", { count: "exact", head: true }).eq("usuario_id", profileId).eq("lida", false);
    if (error) throw error;
    return Number(count || 0);
  }

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function notificationMeta(notification = {}) {
    const source = normalize([
      notification.categoria,
      notification.prioridade,
      notification.titulo,
      notification.mensagem,
      notification.problema,
    ].join(" "));

    if (/recusad|rejeitad/.test(source)) {
      return {
        key: "recusado",
        label: "Recusado",
        priority: "critico",
        icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6m0-6-6 6"></path></svg>',
      };
    }

    if (/nao conforme|reprovad|irregular/.test(source)) {
      return {
        key: "nao-conforme",
        label: "Não conforme",
        priority: "critico",
        icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 17H3L12 3Z"></path><path d="M12 8v5M12 16h.01"></path></svg>',
      };
    }

    if (/nova inspecao|inspecao criada|inspecao agendada/.test(source)) {
      return {
        key: "nova-inspecao",
        label: "Nova inspeção",
        priority: "informativo",
        icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h6M9 3h6a2 2 0 0 1 2 2v1h2v15H5V6h2V5a2 2 0 0 1 2-2Z"></path><path d="M12 10v5M9.5 12.5h5"></path></svg>',
      };
    }

    if (/aprovad|concluid|resolvid|finalizad/.test(source)) {
      return {
        key: "concluido",
        label: "Concluído",
        priority: "concluido",
        icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16 9"></path></svg>',
      };
    }

    if (/pendente|aguardando|atencao|atenção/.test(source)) {
      return {
        key: "atencao",
        label: "Atenção",
        priority: "atencao",
        icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5M12 16h.01"></path></svg>',
      };
    }

    const priority = /crit|urg/.test(source) ? "critico" : /atenc|pend|aguard/.test(source) ? "atencao" : /concl|resolv/.test(source) ? "concluido" : "informativo";
    const fallback = {
      critico: ["Crítico", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 17H3L12 3Z"></path><path d="M12 8v5M12 16h.01"></path></svg>'],
      atencao: ["Atenção", '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5M12 16h.01"></path></svg>'],
      concluido: ["Concluído", '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16 9"></path></svg>'],
      informativo: ["Informativo", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path></svg>'],
    }[priority];
    return { key: priority, label: fallback[0], priority, icon: fallback[1] };
  }

  function subscribe(db, profileId, onChange, channelName = "smartinspect-notificacoes") {
    if (!db?.channel || !profileId || typeof onChange !== "function") return null;
    const safeId = escapeSelector(profileId);
    const channel = db.channel(`${channelName}-${safeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes", filter: `usuario_id=eq.${profileId}` }, onChange)
      .subscribe();
    return channel;
  }

  async function markRead(db, id) {
    if (!db?.from || !id) return;
    const { error } = await db.from("notificacoes").update({ lida: true }).eq("id", id);
    if (error) throw error;
  }

  global.SmartInspectNotifications = { currentProfile, list, unreadCount, notificationMeta, subscribe, markRead };
})(window);

/* Mantém a API usada pelos módulos existentes que criam alertas. */
async function criarNotificacao({ titulo, mensagem, categoria = "informativo", prioridade = "informativo", obra_id = null, problema = null, impacto = null, recomendacao = null }) {
  try {
    const { data: authData, error: authError } = await banco.auth.getUser();
    if (authError || !authData?.user) return null;
    const { data, error } = await banco.from("notificacoes").insert([{ usuario_id: authData.user.id, obra_id, titulo, mensagem, categoria, prioridade, problema, impacto, recomendacao, lida: false }]).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
    return null;
  }
}
