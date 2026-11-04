// ======================================
// SMARTINSPECT AI
// AUTENTICAÇÃO E PERMISSÕES
// ======================================

"use strict";


// ======================================
// PEGAR USUÁRIO
// ======================================

function getUsuario() {

    const usuario = localStorage.getItem("usuario");

    if (!usuario) {
        return null;
    }

    try {

        return JSON.parse(usuario);

    } catch (erro) {

        console.error("Erro ao ler usuário:", erro);

        localStorage.removeItem("usuario");

        return null;
    }
}


// ======================================
// VERIFICAR LOGIN
// ======================================

function verificarLogin() {

    const usuario = getUsuario();

    if (!usuario) {

        window.location.href = "login.html";

        return false;
    }

    return true;
}


// ======================================
// SAIR
// ======================================
// Mantemos a função global porque a sidebar
// pode utilizar onclick="sair()".

async function sair() {

    try {

        // Encerra a sessão do Supabase, caso
        // o cliente esteja disponível.

        if (
            typeof banco !== "undefined" &&
            banco?.auth
        ) {

            const { error } = await banco.auth.signOut();

            if (error) {

                console.error(
                    "Erro ao sair do Supabase:",
                    error
                );

            }

        }

    } catch (erro) {

        console.error(
            "Erro durante o logout:",
            erro
        );

    } finally {

        // Remove a sessão local
        localStorage.removeItem("usuario");

        // Redireciona para o login
        window.location.href = "login.html";

    }
}


// Disponibiliza globalmente para onclick="sair()"
window.sair = sair;


// ======================================
// PERMISSÕES
// ======================================

const permissoes = {

    adm: [

        "index",
        "base",
        "obras",
        "imoveis",
        "criar",
        "usuarios",
        "inspecoes",
        "estoque",
        "ia",
        "detalhes_inspecao",
        "relatorios",
        "equipe",
        "solicitacoes",
        "notificacoes",
        "perfil",
        "suporte",
        "atendimento",
        "configuracoes",
        "dashboard"

    ],

    admin: [

        "index",
        "base",
        "obras",
        "imoveis",
        "criar",
        "usuarios",
        "inspecoes",
        "estoque",
        "ia",
        "detalhes_inspecao",
        "relatorios",
        "equipe",
        "solicitacoes",
        "notificacoes",
        "perfil",
        "suporte",
        "atendimento",
        "configuracoes",
        "dashboard"

    ],

    engenheiro: [

        "index",
        "base",
        "obras",
        "imoveis",
        "criar",
        "inspecoes",
        "estoque",
        "ia",
        "relatorios",
        "perfil",
        "notificacoes",
        "suporte",
        "configuracoes",
        "dashboard"

    ],

    inspetor: [

        "index",
        "base",
        "obras",
        "inspecoes",
        "ia",
        "relatorios",
        "perfil",
        "notificacoes",
        "suporte",
        "configuracoes",
        "dashboard"

    ],

    tecnico: [

        "index",
        "base",
        "obras",
        "inspecoes",
        "estoque",
        "perfil",
        "notificacoes",
        "suporte",
        "configuracoes",
        "dashboard"

    ],

    usuario: [

        "index",
        "base",
        "inspecoes",
        "perfil",
        "notificacoes",
        "suporte",
        "configuracoes",
        "dashboard"

    ]

};


// ======================================
// VERIFICAR PERMISSÃO
// ======================================

function temPermissao(pagina) {

    const usuario = getUsuario();

    if (!usuario) {
        return false;
    }

    let cargo = usuario.nivel_acesso;

    if (!cargo) {

        console.warn(
            "Usuário sem nivel_acesso:",
            usuario
        );

        return false;
    }


    // Normalizar cargo

    cargo = String(cargo)
        .trim()
        .toLowerCase();


    // Compatibilidade com nomes diferentes

    if (
        cargo === "administrador" ||
        cargo === "administradora" ||
        cargo === "admin"
    ) {

        cargo = "adm";

    }


    if (!permissoes[cargo]) {

        console.warn(
            "Cargo sem permissões:",
            cargo
        );

        return false;
    }


    return permissoes[cargo].includes(pagina);

}


// ======================================
// CONTROLAR MENU
// ======================================

function controlarMenu() {

    const links =
        document.querySelectorAll(
            ".sidebar a"
        );


    links.forEach(link => {

        const href =
            link.getAttribute("href");


        if (
            !href ||
            href === "#"
        ) {

            return;
        }


        let pagina = href

            .replace(".html", "")
            .replace("#", "")
            .trim();


        if (
            pagina &&
            !temPermissao(pagina)
        ) {

            link.style.display = "none";

        }

    });

}


// ======================================
// PÁGINAS ESPECIAIS
// ======================================

const paginasEspeciais = {

    "movimentar_estoque": "estoque",

    "novo_imovel": "imoveis",

    "nova_obra": "obras",

    "nova_inspecao": "inspecoes",

    "novo_estoque": "estoque",

    "novo_relatorio": "relatorios",

    "usuarios": "usuarios",

    "solicitacoes": "solicitacoes",

    "suporte_admin": "atendimento",

    "atendimento": "atendimento"

};


// ======================================
// PROTEGER PÁGINA
// ======================================

function protegerPagina(pagina) {

    const usuario = getUsuario();


    // Não está logado

    if (!usuario) {

        window.location.href =
            "login.html";

        return false;

    }


    // Normalizar nome da página

    pagina = String(pagina)

        .replace(".html", "")
        .trim()
        .toLowerCase();


    // Converter páginas especiais

    if (
        paginasEspeciais[pagina]
    ) {

        pagina =
            paginasEspeciais[pagina];

    }


    // Verificar permissão

    if (!temPermissao(pagina)) {

        console.warn(

            "Acesso negado.",

            "Página:",
            pagina,

            "Usuário:",
            usuario

        );


        alert(
            "❌ Você não tem permissão para acessar esta área."
        );


        window.location.href =
            "base.html";


        return false;

    }


    return true;

}


// ======================================
// DISPONIBILIZAR FUNÇÕES GLOBALMENTE
// ======================================

window.getUsuario = getUsuario;
window.verificarLogin = verificarLogin;
window.temPermissao = temPermissao;
window.controlarMenu = controlarMenu;
window.protegerPagina = protegerPagina;


// ======================================
// INICIALIZAÇÃO
// ======================================

document.addEventListener(

    "DOMContentLoaded",

    function () {


        // Primeiro verifica login

        if (!verificarLogin()) {

            return;

        }


        // Controla menus

        controlarMenu();


        // Descobre página atual

        const arquivoAtual =

            window.location.pathname
                .split("/")
                .pop();


        const paginaAtual =

            arquivoAtual
                .replace(".html", "")
                .trim()
                .toLowerCase();


        // Páginas que não precisam dessa proteção

        const paginasPublicas = [

            "",
            "login",
            "cadastro",
            "recuperar-senha",
            "nova-senha"

        ];


        if (

            paginaAtual &&
            !paginasPublicas.includes(
                paginaAtual
            )

        ) {

            protegerPagina(
                paginaAtual
            );

        }

    }

);
