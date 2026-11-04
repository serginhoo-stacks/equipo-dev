// Configuração Supabase
const SUPABASE_URL = "https://zuvvaggooddpblqhgsdb.supabase.co";
const SUPABASE_KEY = "sb_publishable_A1D2QDRqfVOU24huakpyPg_WGWYTXeQ";

// Forçando o Supabase a usar o localStorage do navegador (Evita perda de sessão)
const banco = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            storage: window.localStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false
        }
    }
);
