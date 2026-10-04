/*
 * SmartInspect AI — cliente Supabase v2
 * Substitua os dois valores abaixo pelas credenciais públicas do SEU projeto.
 * Nunca use a SERVICE_ROLE KEY neste arquivo ou em qualquer código do navegador.
 */
(function inicializarClienteSupabase() {
    "use strict";

    const SUPABASE_URL = "https://zuvvaggooddpblqhgsdb.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_A1D2QDRqfVOU24huakpyPg_WGWYTXeQ";

    const status = {
        pronto: false,
        erro: ""
    };

    window.supabaseConfigStatus = status;

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        status.erro = "A biblioteca Supabase JS v2 não foi carregada. Verifique sua conexão com a internet.";
        return;
    }

    const credenciaisPendentes =
        !SUPABASE_URL ||
        !SUPABASE_ANON_KEY ||
        SUPABASE_URL.includes("SEU_PROJECT_REF") ||
        SUPABASE_ANON_KEY.includes("SUA_CHAVE_PUBLICA") ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL);

    if (credenciaisPendentes) {
        status.erro = "Configure a URL do projeto e a chave pública do Supabase em js/supabase.js para habilitar a autenticação.";
        return;
    }

    try {
        window.banco = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );
        status.pronto = true;
    } catch (erro) {
        status.erro = "Não foi possível iniciar o cliente Supabase. Confira a URL e a chave pública.";
        console.error("Falha ao inicializar Supabase:", erro);
    }
})();
