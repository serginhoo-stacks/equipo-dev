/*
 * SmartInspect AI — autenticação do cliente.
 * A emissão/validação do código e a alteração de senha acontecem na Edge Function.
 * Nenhuma chave privilegiada nem decisão de segurança fica no navegador.
 */
(function configurarTelasDeAutenticacao() {
    "use strict";

    const mensagem = document.getElementById("authMessage");
    const loginForm = document.getElementById("loginForm");
    const resetRequestForm = document.getElementById("resetRequestForm");
    const resetVerifyForm = document.getElementById("resetVerifyForm");
    const resetPasswordForm = document.getElementById("resetPasswordForm");
    const accountLinks = document.getElementById("authAccountLinks");
    const titulo = document.getElementById("formTitle");
    const subtitulo = document.getElementById("cardLead");
    let recoveryEmail = "";
    let resetToken = "";
    const recoveryEmailStorageKey = "smartinspect-reset-email";

    function obterEmailRecuperacao() {
        if (recoveryEmail) return recoveryEmail;
        const campoOculto = document.getElementById("verifyEmail");
        if (campoOculto && campoOculto.value.trim()) {
            recoveryEmail = campoOculto.value.trim();
            return recoveryEmail;
        }
        try {
            recoveryEmail = window.sessionStorage.getItem(recoveryEmailStorageKey) || "";
        } catch {
            recoveryEmail = "";
        }
        return recoveryEmail.trim();
    }

    function guardarEmailRecuperacao(email) {
        recoveryEmail = (email || "").trim();
        const campoOculto = document.getElementById("verifyEmail");
        if (campoOculto) campoOculto.value = recoveryEmail;
        try {
            if (recoveryEmail) window.sessionStorage.setItem(recoveryEmailStorageKey, recoveryEmail);
            else window.sessionStorage.removeItem(recoveryEmailStorageKey);
        } catch {
            // O fluxo continua funcionando em navegadores que bloqueiam sessionStorage.
        }
    }

    function mostrarMensagem(texto, tipo) {
        if (!mensagem) return;
        mensagem.textContent = texto;
        mensagem.dataset.type = tipo || "info";
        mensagem.dataset.visible = "true";
    }

    function limparMensagem() {
        if (!mensagem) return;
        mensagem.textContent = "";
        mensagem.dataset.visible = "false";
    }

    function obterCliente() {
        if (window.supabaseConfigStatus && window.supabaseConfigStatus.pronto && window.banco) {
            return window.banco;
        }
        mostrarMensagem(
            (window.supabaseConfigStatus && window.supabaseConfigStatus.erro) ||
            "A conexão com o Supabase ainda não está configurada.",
            "info"
        );
        return null;
    }

    function definirCarregamento(botao, carregando, conteudoOriginal) {
        if (!botao) return;
        botao.disabled = carregando;
        botao.innerHTML = carregando ? "Aguarde…" : conteudoOriginal;
    }

    function definirModo(modo) {
        if (loginForm) loginForm.hidden = modo !== "login";
        if (resetRequestForm) resetRequestForm.hidden = modo !== "solicitar";
        if (resetVerifyForm) resetVerifyForm.hidden = modo !== "verificar";
        if (resetPasswordForm) resetPasswordForm.hidden = modo !== "nova-senha";
        if (resetPasswordForm) {
            resetPasswordForm.querySelectorAll("input").forEach((campo) => {
                campo.disabled = modo !== "nova-senha";
            });
        }
        if (accountLinks) accountLinks.hidden = modo !== "login";

        if (!titulo || !subtitulo) return;
        if (modo === "solicitar") {
            titulo.textContent = "Recuperar senha";
            subtitulo.textContent = "Informe seu e-mail para receber um código temporário.";
        } else if (modo === "verificar") {
            titulo.textContent = "Verificar código";
            subtitulo.textContent = "Digite o código de 4 dígitos que enviámos para o seu e-mail.";
        } else if (modo === "nova-senha") {
            titulo.textContent = "Criar nova senha";
            subtitulo.textContent = "Código confirmado. Agora escolha uma nova senha.";
        } else {
            titulo.textContent = "Bem-vindo de volta";
            subtitulo.textContent = "Entre com o e-mail e a senha cadastrados.";
        }
    }

    async function solicitarCodigo(email, botao = null, conteudoOriginal = "Enviar código") {
        const banco = obterCliente();
        if (!banco) return false;
        if (botao) definirCarregamento(botao, true, conteudoOriginal);

        try {
            const { error } = await banco.functions.invoke("recuperar-senha", {
                body: { action: "request", email: email.trim() }
            });
            if (error) throw error;

            resetToken = "";
            resetVerifyForm.reset();
            resetPasswordForm.reset();
            guardarEmailRecuperacao(email);
            definirModo("verificar");
            document.getElementById("resetCode").focus();
            mostrarMensagem(
                "Se este e-mail estiver cadastrado, enviaremos um código de 4 dígitos. Confira sua caixa de entrada e o spam.",
                "success"
            );
            return true;
        } catch (erro) {
            console.error("Falha ao solicitar código de recuperação:", erro);
            mostrarMensagem("Não foi possível solicitar o código agora. Aguarde um pouco e tente novamente.", "error");
            return false;
        } finally {
            if (botao) definirCarregamento(botao, false, conteudoOriginal);
        }
    }

    async function encaminharUsuario(user) {
        const banco = obterCliente();
        if (!banco || !user) return;

        // O perfil é criado pelo trigger SQL; o frontend apenas confirma sua existência.
        const { error: erroPerfil } = await banco
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

        // Esta consulta orienta a navegação; a autorização real continua no RLS.
        const { data: membros, error: erroMembros } = await banco
            .from("membros_empresa")
            .select("empresa_id, cargo, empresa:empresas(id, nome, status)")
            .eq("usuario_id", user.id)
            .eq("ativo", true);

        if (erroMembros) {
            mostrarMensagem(
                "A autenticação foi feita, mas não foi possível carregar a empresa vinculada. Verifique as relações e as políticas RLS de membros_empresa e empresas.",
                "error"
            );
            return;
        }

        const empresasAtivas = (membros || []).filter((membro) =>
            membro.empresa && membro.empresa.status === "ativa"
        );

        if (empresasAtivas.length === 0) {
            mostrarMensagem(
                "Sua conta está autenticada, mas ainda não há uma empresa ativa vinculada. A criação da empresa e da Base será implementada na próxima etapa.",
                "info"
            );
            return;
        }

        if (empresasAtivas.length > 1) {
            mostrarMensagem(
                "Sua conta pertence a mais de uma empresa. A seleção/troca de empresa será implementada em uma etapa futura; nenhuma empresa foi escolhida automaticamente.",
                "info"
            );
            return;
        }

        window.location.assign("./dashboard.html");
    }

    if (loginForm) {
        const botao = loginForm.querySelector("button[type='submit']");
        const conteudoOriginal = botao ? botao.innerHTML : "Entrar";

        loginForm.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            limparMensagem();
            const banco = obterCliente();
            if (!banco) return;

            const email = document.getElementById("email").value.trim();
            const senha = document.getElementById("senha").value;
            definirCarregamento(botao, true, conteudoOriginal);

            try {
                const { data, error } = await banco.auth.signInWithPassword({ email, password: senha });
                if (error) {
                    mostrarMensagem("Não foi possível entrar. Confira o e-mail e a senha e tente novamente.", "error");
                    return;
                }
                await encaminharUsuario(data.user || (data.session && data.session.user));
            } catch (erro) {
                console.error("Erro no login:", erro);
                mostrarMensagem("Ocorreu um erro ao entrar. Verifique sua conexão e tente novamente.", "error");
            } finally {
                definirCarregamento(botao, false, conteudoOriginal);
            }
        });

        const resetLink = document.getElementById("resetPassword");
        if (resetLink) {
            resetLink.addEventListener("click", (evento) => {
                evento.preventDefault();
                limparMensagem();
                const emailAtual = document.getElementById("email").value.trim() || obterEmailRecuperacao();
                const campoEmail = document.getElementById("resetEmail");
                if (campoEmail) campoEmail.value = emailAtual;
                definirModo("solicitar");
                if (campoEmail && !emailAtual) campoEmail.focus();
            });
        }
    }

    const voltarLogin = document.getElementById("backToLoginFromRequest");
    if (voltarLogin) {
        voltarLogin.addEventListener("click", () => {
            limparMensagem();
            guardarEmailRecuperacao("");
            resetToken = "";
            definirModo("login");
        });
    }

    if (resetRequestForm) {
        const botao = resetRequestForm.querySelector("button[type='submit']");
        const conteudoOriginal = botao ? botao.innerHTML : "Enviar código";

        resetRequestForm.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            limparMensagem();
            const email = document.getElementById("resetEmail").value.trim();
            await solicitarCodigo(email, botao, conteudoOriginal);
        });
    }

    const reenviarCodigo = document.getElementById("resendResetCode");
    if (reenviarCodigo) {
        reenviarCodigo.addEventListener("click", async () => {
            limparMensagem();
            const email = obterEmailRecuperacao();
            if (!email) {
                definirModo("solicitar");
                mostrarMensagem("Informe seu e-mail novamente para pedir outro código.", "info");
                document.getElementById("resetEmail")?.focus();
                return;
            }
            await solicitarCodigo(email, reenviarCodigo, reenviarCodigo.innerHTML);
        });
    }

    const voltarTrocarEmail = document.getElementById("backToResetRequest");
    if (voltarTrocarEmail) {
        voltarTrocarEmail.addEventListener("click", () => {
            limparMensagem();
            const email = obterEmailRecuperacao();
            const campoEmail = document.getElementById("resetEmail");
            if (campoEmail) campoEmail.value = email;
            resetVerifyForm.reset();
            guardarEmailRecuperacao(email);
            resetToken = "";
            definirModo("solicitar");
        });
    }

    if (resetVerifyForm) {
        const botao = resetVerifyForm.querySelector("button[type='submit']");
        const conteudoOriginal = botao ? botao.innerHTML : "Verificar código";

        resetVerifyForm.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            limparMensagem();

            const codigo = document.getElementById("resetCode").value.trim();
            if (!/^\d{4}$/.test(codigo)) {
                mostrarMensagem("Digite o código de 4 números recebido por e-mail.", "error");
                document.getElementById("resetCode").focus();
                return;
            }

            const banco = obterCliente();
            if (!banco) return;
            definirCarregamento(botao, true, conteudoOriginal);
            try {
                const email = obterEmailRecuperacao();
                if (!email) throw new Error("Recovery email is missing");
                const { data, error } = await banco.functions.invoke("recuperar-senha", {
                    body: { action: "verify", email, code: codigo }
                });
                if (error || !data?.ok || !data?.resetToken) throw error || new Error("Verification failed");

                resetToken = data.resetToken;
                resetVerifyForm.reset();
                definirModo("nova-senha");
                document.getElementById("newPassword").focus();
                mostrarMensagem("Código confirmado. Agora crie sua nova senha.", "success");
            } catch (erro) {
                console.error("Falha ao verificar código de recuperação:", erro);
                mostrarMensagem("Código inválido, expirado ou já utilizado. Confira os 4 dígitos ou solicite outro código.", "error");
            } finally {
                definirCarregamento(botao, false, conteudoOriginal);
            }
        });
    }

    if (resetPasswordForm) {
        const botao = resetPasswordForm.querySelector("button[type='submit']");
        const conteudoOriginal = botao ? botao.innerHTML : "Trocar senha";

        resetPasswordForm.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            limparMensagem();

            const novaSenha = document.getElementById("newPassword").value;
            const confirmarSenha = document.getElementById("confirmNewPassword").value;
            if (novaSenha.length < 8) {
                mostrarMensagem("A nova senha precisa ter pelo menos 8 caracteres.", "error");
                document.getElementById("newPassword").focus();
                return;
            }
            if (novaSenha !== confirmarSenha) {
                mostrarMensagem("As novas senhas não coincidem. Confira os dois campos.", "error");
                document.getElementById("confirmNewPassword").focus();
                return;
            }
            if (!resetToken) {
                mostrarMensagem("A verificação expirou. Solicite um novo código para continuar.", "error");
                definirModo("solicitar");
                return;
            }

            const banco = obterCliente();
            if (!banco) return;
            definirCarregamento(botao, true, conteudoOriginal);
            try {
                const { data, error } = await banco.functions.invoke("recuperar-senha", {
                    body: { action: "reset", resetToken, newPassword: novaSenha }
                });
                if (error || !data?.ok) throw error || new Error("Password reset failed");

                const email = obterEmailRecuperacao();
                resetToken = "";
                resetPasswordForm.reset();
                document.getElementById("email").value = email;
                document.getElementById("senha").value = "";
                guardarEmailRecuperacao("");
                definirModo("login");
                mostrarMensagem("Senha alterada. Agora entre usando sua nova senha.", "success");
            } catch (erro) {
                console.error("Falha ao trocar senha:", erro);
                mostrarMensagem("Não foi possível trocar a senha. A autorização pode ter expirado; solicite um novo código e tente novamente.", "error");
            } finally {
                definirCarregamento(botao, false, conteudoOriginal);
            }
        });
    }

    const cadastroForm = document.getElementById("cadastroForm");
    if (cadastroForm) {
        const botao = cadastroForm.querySelector("button[type='submit']");
        const conteudoOriginal = botao ? botao.innerHTML : "Criar conta";

        cadastroForm.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            limparMensagem();
            const banco = obterCliente();
            if (!banco) return;

            const nome = document.getElementById("nome").value.trim();
            const email = document.getElementById("email").value.trim();
            const senha = document.getElementById("senha").value;
            const confirmarSenha = document.getElementById("confirmarSenha").value;

            if (senha !== confirmarSenha) {
                mostrarMensagem("As senhas não coincidem. Confira os campos e tente novamente.", "error");
                document.getElementById("confirmarSenha").focus();
                return;
            }

            definirCarregamento(botao, true, conteudoOriginal);
            try {
                const emailRedirectTo = new URL("./login.html?cadastro=confirmar", window.location.href).href;
                const { data, error } = await banco.auth.signUp({
                    email,
                    password: senha,
                    options: { data: { nome }, emailRedirectTo }
                });

                if (error) {
                    mostrarMensagem("Não foi possível criar a conta. Confira os dados e tente novamente.", "error");
                    console.error("Erro no cadastro:", error);
                    return;
                }

                mostrarMensagem(
                    !data.session
                        ? "Cadastro recebido. Confirme seu e-mail pelo link enviado para ativar a conta. O perfil será criado pelo trigger do Supabase; a empresa será uma etapa posterior."
                        : "Conta criada e autenticada. O perfil será criado pelo trigger do Supabase. Ainda não criamos empresa nem vínculo de membro.",
                    "success"
                );
                cadastroForm.reset();
            } catch (erro) {
                console.error("Erro no cadastro:", erro);
                mostrarMensagem("Ocorreu um erro ao criar a conta. Verifique sua conexão e tente novamente.", "error");
            } finally {
                definirCarregamento(botao, false, conteudoOriginal);
            }
        });
    }

    // Estado inicial: mostrar somente o formulário normal de login.
    if (loginForm) definirModo("login");

    if (!window.supabaseConfigStatus || !window.supabaseConfigStatus.pronto) {
        mostrarMensagem(
            (window.supabaseConfigStatus && window.supabaseConfigStatus.erro) ||
            "Configure a URL e a chave pública do Supabase em js/supabase.js para habilitar a autenticação.",
            "info"
        );
    }
})();
