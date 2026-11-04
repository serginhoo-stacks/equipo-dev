/*
 * SmartInspect AI — inicialização central do Supabase
 *
 * IMPORTANTE:
 * - Carregue @supabase/supabase-js v2 antes deste arquivo.
 * - Este arquivo deve ser carregado uma única vez por página.
 * - O cliente fica disponível em window.banco.
 * - Nunca coloque uma service_role key neste arquivo.
 */

(() => {
    "use strict";

    const SUPABASE_URL = "https://zuvvaggooddpblqhgsdb.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_A1D2QDRqfVOU24huakpyPg_WGWYTXeQ";

    // Evita inicialização duplicada.
    if (
        window.banco?.auth &&
        typeof window.banco.from === "function"
    ) {
        console.info(
            "[SmartInspect] Cliente Supabase já inicializado."
        );
        return;
    }

    // Verifica se a biblioteca Supabase foi carregada.
    if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
    ) {
        console.error(
            "[SmartInspect] Supabase JS não foi carregado. " +
            "Verifique a ordem dos scripts."
        );

        window.banco = null;

        window.smartInspectSupabaseError =
            new Error("Biblioteca Supabase JS não carregada.");

        return;
    }

    try {
        // Verifica se o localStorage está disponível.
        const storage = window.localStorage;

        const storageTestKey = "__smartinspect_storage_test__";

        storage.setItem(storageTestKey, "1");
        storage.removeItem(storageTestKey);

        // Inicializa o cliente Supabase.
        // IMPORTANTE: window.banco é utilizado pelos dois HTMLs.
        window.banco = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
                auth: {
                    storage: storage,
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: false
                }
            }
        );

        // Confirma a inicialização.
        window.smartInspectSupabaseReady = true;

        window.smartInspectSupabaseError = null;

        console.info(
            "[SmartInspect] Cliente Supabase inicializado em window.banco."
        );

    } catch (error) {

        window.banco = null;

        window.smartInspectSupabaseReady = false;

        window.smartInspectSupabaseError = error;

        console.error(
            "[SmartInspect] Falha ao inicializar o Supabase:",
            error
        );
    }

})();
