/*
 * ============================================================
 * SMARTINSPECT AI — AUTENTICAÇÃO
 * ============================================================
 *
 * Este arquivo NÃO contém:
 * - URL do Supabase
 * - chave do Supabase
 * - service_role
 * - decisões de segurança
 *
 * A configuração fica centralizada em js/supabase.js,
 * utilizando as variáveis configuradas no ambiente.
 *
 * O frontend usa somente window.banco.
 *
 * Recuperação de senha:
 *
 * E-mail
 *   ↓
 * Código
 *   ↓
 * Nova senha
 *   ↓
 * Confirmar nova senha
 *   ↓
 * Login
 *
 * A emissão/validação do código e a alteração da senha
 * acontecem na Edge Function "recuperar-senha".
 * ============================================================
 */

(function configurarAutenticacao() {
    "use strict";

    // ============================================================
    // ELEMENTOS
    // ============================================================

    const mensagem = document.getElementById("authMessage");

    const loginForm = document.getElementById("loginForm");
    const resetRequestForm = document.getElementById("resetRequestForm");
    const resetVerifyForm = document.getElementById("resetVerifyForm");
    const resetPasswordForm = document.getElementById("resetPasswordForm");
    const cadastroForm = document.getElementById("cadastroForm");

    const accountLinks = document.getElementById("authAccountLinks");

    const titulo = document.getElementById("formTitle");
    const subtitulo = document.getElementById("cardLead");

    // ============================================================
    // ESTADO DA RECUPERAÇÃO
    // ============================================================

    let recoveryEmail = "";
    let resetToken = "";

    const recoveryEmailStorageKey = "smartinspect-reset-email";

    // ============================================================
    // CLIENTE SUPABASE
    // ============================================================

    function obterCliente() {
        /*
         * O auth.js não conhece nenhuma chave.
         *
         * O arquivo js/supabase.js deve criar:
         *
         * window.banco
         * window.supabaseConfigStatus
         */

        if (
            window.supabaseConfigStatus &&
            window.supabaseConfigStatus.pronto &&
            window.banco
        ) {
            return window.banco;
        }

        if (window.banco) {
            return window.banco;
        }

        mostrarMensagem(
            (
                window.supabaseConfigStatus &&
                window.supabaseConfigStatus.erro
            ) ||
            "A conexão com o Supabase ainda não está configurada.",
            "error"
        );

        return null;
    }

    // ============================================================
    // MENSAGENS
    // ============================================================

    function mostrarMensagem(texto, tipo = "info") {
        if (!mensagem) return;

        mensagem.textContent = texto;
        mensagem.dataset.type = tipo;
        mensagem.dataset.visible = "true";
    }

    function limparMensagem() {
        if (!mensagem) return;

        mensagem.textContent = "";
        mensagem.dataset.visible = "false";
        delete mensagem.dataset.type;
    }

    // ============================================================
    // LOADING DOS BOTÕES
    // ============================================================

    function definirCarregamento(
        botao,
        carregando,
        conteudoOriginal
    ) {
        if (!botao) return;

        botao.disabled = carregando;

        botao.innerHTML = carregando
            ? "Aguarde…"
            : conteudoOriginal;
    }

    // ============================================================
    // E-MAIL DA RECUPERAÇÃO
    // ============================================================

    function obterEmailRecuperacao() {
        if (recoveryEmail) {
            return recoveryEmail;
        }

        const campoOculto =
            document.getElementById("verifyEmail");

        if (
            campoOculto &&
            campoOculto.value.trim()
        ) {
            recoveryEmail =
                campoOculto.value.trim();

            return recoveryEmail;
        }

        try {
            recoveryEmail =
                window.sessionStorage.getItem(
                    recoveryEmailStorageKey
                ) || "";
        } catch {
            recoveryEmail = "";
        }

        return recoveryEmail.trim();
    }

    function guardarEmailRecuperacao(email) {
        recoveryEmail = (email || "").trim();

        const campoOculto =
            document.getElementById("verifyEmail");

        if (campoOculto) {
            campoOculto.value = recoveryEmail;
        }

        try {
            if (recoveryEmail) {
                window.sessionStorage.setItem(
                    recoveryEmailStorageKey,
                    recoveryEmail
                );
            } else {
                window.sessionStorage.removeItem(
                    recoveryEmailStorageKey
                );
            }
        } catch {
            // Continua funcionando mesmo sem sessionStorage.
        }
    }

    // ============================================================
    // CONTROLE DAS TELAS
    // ============================================================

    function definirModo(modo) {
        if (loginForm) {
            loginForm.hidden = modo !== "login";
        }

        if (resetRequestForm) {
            resetRequestForm.hidden =
                modo !== "solicitar";
        }

        if (resetVerifyForm) {
            resetVerifyForm.hidden =
                modo !== "verificar";
        }

        if (resetPasswordForm) {
            resetPasswordForm.hidden =
                modo !== "nova-senha";
        }

        /*
         * Campos da nova senha só ficam habilitados
         * quando o código já foi validado.
         */

        if (resetPasswordForm) {
            resetPasswordForm
                .querySelectorAll("input")
                .forEach((campo) => {
                    campo.disabled =
                        modo !== "nova-senha";
                });
        }

        if (accountLinks) {
            accountLinks.hidden =
                modo !== "login";
        }

        if (!titulo || !subtitulo) {
            return;
        }

        if (modo === "solicitar") {

            titulo.textContent =
                "Recuperar senha";

            subtitulo.textContent =
                "Informe seu e-mail para receber um código temporário.";

        } else if (modo === "verificar") {

            titulo.textContent =
                "Verificar código";

            subtitulo.textContent =
                "Digite o código de 4 dígitos que enviámos para o seu e-mail.";

        } else if (modo === "nova-senha") {

            titulo.textContent =
                "Criar nova senha";

            subtitulo.textContent =
                "Código confirmado. Agora escolha uma nova senha.";

        } else {

            titulo.textContent =
                "Bem-vindo de volta";

            subtitulo.textContent =
                "Entre com o e-mail e a senha cadastrados.";
        }
    }

    // ============================================================
    // SOLICITAR CÓDIGO
    // ============================================================

    async function solicitarCodigo(
        email,
        botao = null,
        conteudoOriginal = "Enviar código"
    ) {
        const banco = obterCliente();

        if (!banco) {
            return false;
        }

        email = (email || "").trim();

        if (!email) {
            mostrarMensagem(
                "Informe seu e-mail para continuar.",
                "error"
            );

            return false;
        }

        if (botao) {
            definirCarregamento(
                botao,
                true,
                conteudoOriginal
            );
        }

        try {

            const { error } =
                await banco.functions.invoke(
                    "recuperar-senha",
                    {
                        body: {
                            action: "request",
                            email: email
                        }
                    }
                );

            if (error) {
                throw error;
            }

            resetToken = "";

            if (resetVerifyForm) {
                resetVerifyForm.reset();
            }

            if (resetPasswordForm) {
                resetPasswordForm.reset();
            }

            guardarEmailRecuperacao(email);

            definirModo("verificar");

            document
                .getElementById("resetCode")
                ?.focus();

            mostrarMensagem(
                "Se este e-mail estiver cadastrado, enviaremos um código de 4 dígitos. Confira sua caixa de entrada e o spam.",
                "success"
            );

            return true;

        } catch (erro) {

            console.error(
                "Falha ao solicitar código de recuperação:",
                erro
            );

            mostrarMensagem(
                "Não foi possível solicitar o código agora. Aguarde um pouco e tente novamente.",
                "error"
            );

            return false;

        } finally {

            if (botao) {
                definirCarregamento(
                    botao,
                    false,
                    conteudoOriginal
                );
            }
        }
    }

    // ============================================================
    // ENCAMINHAR USUÁRIO APÓS LOGIN
    // ============================================================

    async function encaminharUsuario(user) {
        const banco = obterCliente();

        if (!banco || !user) {
            return;
        }

        // --------------------------------------------------------
        // PERFIL
        // --------------------------------------------------------

        const {
            error: erroPerfil
        } = await banco
            .from("perfis")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

        if (erroPerfil) {

            mostrarMensagem(
                "A autenticação foi feita, mas não foi possível consultar o perfil. Verifique as políticas RLS de public.perfis antes de continuar.",
                "error"
            );

            return;
        }

        // --------------------------------------------------------
        // EMPRESAS DO USUÁRIO
        // --------------------------------------------------------

        const {
            data: membros,
            error: erroMembros
        } = await banco
            .from("membros_empresa")
            .select(
                "empresa_id, cargo, empresa:empresas(id, nome, status)"
            )
            .eq("usuario_id", user.id)
            .eq("ativo", true);

        if (erroMembros) {

            mostrarMensagem(
                "A autenticação foi feita, mas não foi possível carregar a empresa vinculada. Verifique as relações e as políticas RLS de membros_empresa e empresas.",
                "error"
            );

            return;
        }

        const empresasAtivas =
            (membros || []).filter(
                (membro) =>
                    membro.empresa &&
                    membro.empresa.status === "ativa"
            );

        // --------------------------------------------------------
        // NENHUMA EMPRESA
        // --------------------------------------------------------

        if (empresasAtivas.length === 0) {

            mostrarMensagem(
                "Sua conta está autenticada, mas ainda não há uma empresa ativa vinculada. A criação da empresa e da Base será implementada na próxima etapa.",
                "info"
            );

            return;
        }

        // --------------------------------------------------------
        // MAIS DE UMA EMPRESA
        // --------------------------------------------------------

        if (empresasAtivas.length > 1) {

            mostrarMensagem(
                "Sua conta pertence a mais de uma empresa. A seleção/troca de empresa será implementada em uma etapa futura; nenhuma empresa foi escolhida automaticamente.",
                "info"
            );

            return;
        }

        // --------------------------------------------------------
        // UMA EMPRESA
        // --------------------------------------------------------

        window.location.assign(
            "./index.html"
        );
    }

    // ============================================================
    // LOGIN
    // ============================================================

    if (loginForm) {

        const botao =
            loginForm.querySelector(
                "button[type='submit']"
            );

        const conteudoOriginal =
            botao
                ? botao.innerHTML
                : "Entrar";

        loginForm.addEventListener(
            "submit",
            async (evento) => {

                evento.preventDefault();

                limparMensagem();

                const banco =
                    obterCliente();

                if (!banco) {
                    return;
                }

                const email =
                    document
                        .getElementById("email")
                        ?.value
                        .trim();

                const senha =
                    document
                        .getElementById("senha")
                        ?.value || "";

                if (!email || !senha) {

                    mostrarMensagem(
                        "Informe seu e-mail e sua senha.",
                        "error"
                    );

                    return;
                }

                definirCarregamento(
                    botao,
                    true,
                    conteudoOriginal
                );

                try {

                    const {
                        data,
                        error
                    } =
                        await banco.auth
                            .signInWithPassword({
                                email,
                                password: senha
                            });

                    if (error) {

                        mostrarMensagem(
                            "Não foi possível entrar. Confira o e-mail e a senha e tente novamente.",
                            "error"
                        );

                        return;
                    }

                    await encaminharUsuario(
                        data.user ||
                        (
                            data.session &&
                            data.session.user
                        )
                    );

                } catch (erro) {

                    console.error(
                        "Erro no login:",
                        erro
                    );

                    mostrarMensagem(
                        "Ocorreu um erro ao entrar. Verifique sua conexão e tente novamente.",
                        "error"
                    );

                } finally {

                    definirCarregamento(
                        botao,
                        false,
                        conteudoOriginal
                    );
                }
            }
        );

        // --------------------------------------------------------
        // ESQUECI MINHA SENHA
        // --------------------------------------------------------

        const resetLink =
            document.getElementById(
                "resetPassword"
            );

        if (resetLink) {

            resetLink.addEventListener(
                "click",
                (evento) => {

                    evento.preventDefault();

                    limparMensagem();

                    const emailAtual =
                        document
                            .getElementById("email")
                            ?.value
                            .trim() ||
                        obterEmailRecuperacao();

                    const campoEmail =
                        document.getElementById(
                            "resetEmail"
                        );

                    if (campoEmail) {
                        campoEmail.value =
                            emailAtual;
                    }

                    definirModo("solicitar");

                    if (
                        campoEmail &&
                        !emailAtual
                    ) {
                        campoEmail.focus();
                    }
                }
            );
        }
    }

    // ============================================================
    // VOLTAR PARA LOGIN
    // ============================================================

    const voltarLogin =
        document.getElementById(
            "backToLoginFromRequest"
        );

    if (voltarLogin) {

        voltarLogin.addEventListener(
            "click",
            () => {

                limparMensagem();

                guardarEmailRecuperacao("");

                resetToken = "";

                definirModo("login");
            }
        );
    }

    // ============================================================
    // PEDIR CÓDIGO
    // ============================================================

    if (resetRequestForm) {

        const botao =
            resetRequestForm.querySelector(
                "button[type='submit']"
            );

        const conteudoOriginal =
            botao
                ? botao.innerHTML
                : "Enviar código";

        resetRequestForm.addEventListener(
            "submit",
            async (evento) => {

                evento.preventDefault();

                limparMensagem();

                const campo =
                    document.getElementById(
                        "resetEmail"
                    );

                const email =
                    campo
                        ? campo.value.trim()
                        : "";

                await solicitarCodigo(
                    email,
                    botao,
                    conteudoOriginal
                );
            }
        );
    }

    // ============================================================
    // REENVIAR CÓDIGO
    // ============================================================

    const reenviarCodigo =
        document.getElementById(
            "resendResetCode"
        );

    if (reenviarCodigo) {

        reenviarCodigo.addEventListener(
            "click",
            async () => {

                limparMensagem();

                const email =
                    obterEmailRecuperacao();

                if (!email) {

                    definirModo("solicitar");

                    mostrarMensagem(
                        "Informe seu e-mail novamente para pedir outro código.",
                        "info"
                    );

                    document
                        .getElementById(
                            "resetEmail"
                        )
                        ?.focus();

                    return;
                }

                await solicitarCodigo(
                    email,
                    reenviarCodigo,
                    reenviarCodigo.innerHTML
                );
            }
        );
    }

    // ============================================================
    // VOLTAR PARA ALTERAR E-MAIL
    // ============================================================

    const voltarTrocarEmail =
        document.getElementById(
            "backToResetRequest"
        );

    if (voltarTrocarEmail) {

        voltarTrocarEmail.addEventListener(
            "click",
            () => {

                limparMensagem();

                const email =
                    obterEmailRecuperacao();

                const campoEmail =
                    document.getElementById(
                        "resetEmail"
                    );

                if (campoEmail) {
                    campoEmail.value =
                        email;
                }

                if (resetVerifyForm) {
                    resetVerifyForm.reset();
                }

                guardarEmailRecuperacao(
                    email
                );

                resetToken = "";

                definirModo("solicitar");
            }
        );
    }

    // ============================================================
    // VERIFICAR CÓDIGO
    // ============================================================

    if (resetVerifyForm) {

        const botao =
            resetVerifyForm.querySelector(
                "button[type='submit']"
            );

        const conteudoOriginal =
            botao
                ? botao.innerHTML
                : "Verificar código";

        resetVerifyForm.addEventListener(
            "submit",
            async (evento) => {

                evento.preventDefault();

                limparMensagem();

                const campoCodigo =
                    document.getElementById(
                        "resetCode"
                    );

                const codigo =
                    campoCodigo
                        ? campoCodigo.value.trim()
                        : "";

                // Código exatamente com 4 números.
                if (!/^\d{4}$/.test(codigo)) {

                    mostrarMensagem(
                        "Digite o código de 4 números recebido por e-mail.",
                        "error"
                    );

                    campoCodigo?.focus();

                    return;
                }

                const banco =
                    obterCliente();

                if (!banco) {
                    return;
                }

                definirCarregamento(
                    botao,
                    true,
                    conteudoOriginal
                );

                try {

                    const email =
                        obterEmailRecuperacao();

                    if (!email) {
                        throw new Error(
                            "Recovery email is missing"
                        );
                    }

                    const {
                        data,
                        error
                    } =
                        await banco.functions.invoke(
                            "recuperar-senha",
                            {
                                body: {
                                    action: "verify",
                                    email,
                                    code: codigo
                                }
                            }
                        );

                    if (
                        error ||
                        !data?.ok ||
                        !data?.resetToken
                    ) {
                        throw (
                            error ||
                            new Error(
                                "Verification failed"
                            )
                        );
                    }

                    // Token temporário de recuperação.
                    resetToken =
                        data.resetToken;

                    resetVerifyForm.reset();

                    definirModo(
                        "nova-senha"
                    );

                    document
                        .getElementById(
                            "newPassword"
                        )
                        ?.focus();

                    mostrarMensagem(
                        "Código confirmado. Agora crie sua nova senha.",
                        "success"
                    );

                } catch (erro) {

                    console.error(
                        "Falha ao verificar código de recuperação:",
                        erro
                    );

                    mostrarMensagem(
                        "Código inválido, expirado ou já utilizado. Confira os 4 dígitos ou solicite outro código.",
                        "error"
                    );

                } finally {

                    definirCarregamento(
                        botao,
                        false,
                        conteudoOriginal
                    );
                }
            }
        );
    }

    // ============================================================
    // CRIAR NOVA SENHA
    // ============================================================

    if (resetPasswordForm) {

        const botao =
            resetPasswordForm.querySelector(
                "button[type='submit']"
            );

        const conteudoOriginal =
            botao
                ? botao.innerHTML
                : "Trocar senha";

        resetPasswordForm.addEventListener(
            "submit",
            async (evento) => {

                evento.preventDefault();

                limparMensagem();

                const novaSenha =
                    document
                        .getElementById(
                            "newPassword"
                        )
                        ?.value || "";

                const confirmarSenha =
                    document
                        .getElementById(
                            "confirmNewPassword"
                        )
                        ?.value || "";

                // ------------------------------------------------
                // SENHA MÍNIMA
                // ------------------------------------------------

                if (novaSenha.length < 8) {

                    mostrarMensagem(
                        "A nova senha precisa ter pelo menos 8 caracteres.",
                        "error"
                    );

                    document
                        .getElementById(
                            "newPassword"
                        )
                        ?.focus();

                    return;
                }

                // ------------------------------------------------
                // CONFIRMAÇÃO
                // ------------------------------------------------

                if (
                    novaSenha !==
                    confirmarSenha
                ) {

                    mostrarMensagem(
                        "As novas senhas não coincidem. Confira os dois campos.",
                        "error"
                    );

                    document
                        .getElementById(
                            "confirmNewPassword"
                        )
                        ?.focus();

                    return;
                }

                // ------------------------------------------------
                // TOKEN
                // ------------------------------------------------

                if (!resetToken) {

                    mostrarMensagem(
                        "A verificação expirou. Solicite um novo código para continuar.",
                        "error"
                    );

                    definirModo(
                        "solicitar"
                    );

                    return;
                }

                const banco =
                    obterCliente();

                if (!banco) {
                    return;
                }

                definirCarregamento(
                    botao,
                    true,
                    conteudoOriginal
                );

                try {

                    const {
                        data,
                        error
                    } =
                        await banco.functions.invoke(
                            "recuperar-senha",
                            {
                                body: {
                                    action: "reset",
                                    resetToken,
                                    newPassword:
                                        novaSenha
                                }
                            }
                        );

                    if (
                        error ||
                        !data?.ok
                    ) {
                        throw (
                            error ||
                            new Error(
                                "Password reset failed"
                            )
                        );
                    }

                    const email =
                        obterEmailRecuperacao();

                    // Limpa o token imediatamente.
                    resetToken = "";

                    resetPasswordForm.reset();

                    const emailLogin =
                        document.getElementById(
                            "email"
                        );

                    const senhaLogin =
                        document.getElementById(
                            "senha"
                        );

                    if (emailLogin) {
                        emailLogin.value =
                            email;
                    }

                    if (senhaLogin) {
                        senhaLogin.value = "";
                    }

                    guardarEmailRecuperacao("");

                    definirModo("login");

                    mostrarMensagem(
                        "Senha alterada. Agora entre usando sua nova senha.",
                        "success"
                    );

                } catch (erro) {

                    console.error(
                        "Falha ao trocar senha:",
                        erro
                    );

                    mostrarMensagem(
                        "Não foi possível trocar a senha. A autorização pode ter expirado; solicite um novo código e tente novamente.",
                        "error"
                    );

                } finally {

                    definirCarregamento(
                        botao,
                        false,
                        conteudoOriginal
                    );
                }
            }
        );
    }

    // ============================================================
    // CADASTRO
    // ============================================================

    if (cadastroForm) {

        const botao =
            cadastroForm.querySelector(
                "button[type='submit']"
            );

        const conteudoOriginal =
            botao
                ? botao.innerHTML
                : "Criar conta";

        cadastroForm.addEventListener(
            "submit",
            async (evento) => {

                evento.preventDefault();

                limparMensagem();

                const banco =
                    obterCliente();

                if (!banco) {
                    return;
                }

                const nome =
                    document
                        .getElementById("nome")
                        ?.value
                        .trim();

                const email =
                    document
                        .getElementById("email")
                        ?.value
                        .trim();

                const senha =
                    document
                        .getElementById("senha")
                        ?.value || "";

                const confirmarSenha =
                    document
                        .getElementById(
                            "confirmarSenha"
                        )
                        ?.value || "";

                if (
                    senha !==
                    confirmarSenha
                ) {

                    mostrarMensagem(
                        "As senhas não coincidem. Confira os campos e tente novamente.",
                        "error"
                    );

                    document
                        .getElementById(
                            "confirmarSenha"
                        )
                        ?.focus();

                    return;
                }

                if (senha.length < 8) {

                    mostrarMensagem(
                        "A senha precisa ter pelo menos 8 caracteres.",
                        "error"
                    );

                    document
                        .getElementById(
                            "senha"
                        )
                        ?.focus();

                    return;
                }

                definirCarregamento(
                    botao,
                    true,
                    conteudoOriginal
                );

                try {

                    const emailRedirectTo =
                        new URL(
                            "./login.html?cadastro=confirmar",
                            window.location.href
                        ).href;

                    const {
                        data,
                        error
                    } =
                        await banco.auth.signUp({
                            email,
                            password: senha,
                            options: {
                                data: {
                                    nome
                                },
                                emailRedirectTo
                            }
                        });

                    if (error) {

                        mostrarMensagem(
                            "Não foi possível criar a conta. Confira os dados e tente novamente.",
                            "error"
                        );

                        console.error(
                            "Erro no cadastro:",
                            error
                        );

                        return;
                    }

                    mostrarMensagem(
                        !data.session
                            ? "Cadastro recebido. Confirme seu e-mail pelo link enviado para ativar a conta."
                            : "Conta criada e autenticada.",
                        "success"
                    );

                    cadastroForm.reset();

                } catch (erro) {

                    console.error(
                        "Erro no cadastro:",
                        erro
                    );

                    mostrarMensagem(
                        "Ocorreu um erro ao criar a conta. Verifique sua conexão e tente novamente.",
                        "error"
                    );

                } finally {

                    definirCarregamento(
                        botao,
                        false,
                        conteudoOriginal
                    );
                }
            }
        );
    }

    // ============================================================
    // ESTADO INICIAL
    // ============================================================

    if (loginForm) {
        definirModo("login");
    }

    // ============================================================
    // VERIFICAR CONFIGURAÇÃO
    // ============================================================

    if (
        !window.supabaseConfigStatus ||
        !window.supabaseConfigStatus.pronto
    ) {

        mostrarMensagem(
            (
                window.supabaseConfigStatus &&
                window.supabaseConfigStatus.erro
            ) ||
            "Configure o Supabase no arquivo de configuração do projeto para habilitar a autenticação.",
            "info"
        );
    }

})();
