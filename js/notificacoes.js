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
    const { data: profile, error } = await db.from("usuarios").select("id,auth_id,nome,email,foto_url").eq("auth_id", authData.user.id).maybeSingle();
    if (error) throw error;
    return profile || { auth_id: authData.user.id, email: authData.user.email };
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

  global.SmartInspectNotifications = { currentProfile, list, unreadCount, subscribe, markRead };
})(window);

/* Mantém a API usada pelos módulos existentes que criam alertas. */
async function criarNotificacao({ titulo, mensagem, categoria = "informativo", prioridade = "informativo", obra_id = null, problema = null, impacto = null, recomendacao = null }) {
  try {
    const { data: authData, error: authError } = await banco.auth.getUser();
    if (authError || !authData?.user) return null;
    const { data: usuario, error: usuarioError } = await banco.from("usuarios").select("id").eq("auth_id", authData.user.id).maybeSingle();
    if (usuarioError || !usuario) return null;
    const { data, error } = await banco.from("notificacoes").insert([{ usuario_id: usuario.id, obra_id, titulo, mensagem, categoria, prioridade, problema, impacto, recomendacao, lida: false }]).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
    return null;
  }
}
