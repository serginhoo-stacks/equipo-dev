// Configuração Supabase
const SUPABASE_URL = "https://zuvvaggooddpblqhgsdb.supabase.co";
const SUPABASE_KEY = "sb_publishable_A1D2QDRqfVOU24huakpyPg_WGWYTXeQ";

// AQUI ESTÁ O SEGREDO: Forçando o Supabase a usar o localStorage
const banco = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            storage: window.localStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false // Evita conflito com links de e-mail
        }
    }
);
