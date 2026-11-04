// Configuração Supabase

const SUPABASE_URL = "https://zuvvaggooddpblqhgsdb.supabase.co";

const SUPABASE_KEY = "sb_publishable_A1D2QDRqfVOU24huakpyPg_WGWYTXeQ";


// Conexão com Supabase

const banco = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
