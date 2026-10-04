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
    const accountLinks = document.getElementById("authAccountLinks");
    const titulo = document.getElementById("formTitle");
    const subtitulo = document.getElementById("cardLead");

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
        if (accountLinks) accountLinks.hidden = modo !== "login";

        if (!titulo || !subtitulo) return;
        if (modo === "solicitar") {
            titulo.textContent = "Recuperar senha";
            subtitulo.textContent = "Informe seu e-mail para receber um código temporário.";
        } else if (modo === "verificar") {
            titulo.textContent = "Verificar código";
            subtitulo.textContent = "Digite o código recebido e escolha uma nova senha.";
        } else {
            titulo.textContent = "Bem-vindo de volta";
            subtitulo.textContent = "Entre com o e-mail e a senha cadastrados.";
        }
    }

    function getEmailVerificacao() {
        return (document.getElementById("verifyEmail")?.value || "").trim();
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

            document.getElementById("verifyEmail").value = email.trim();
            definirModo("verificar");
            document.getElementById("resetCode").focus();
            mostrarMensagem(
                "Se este e-mail estiver cadastrado, enviaremos um código de 8 dígitos. Confira sua caixa de entrada e o spam.",
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
                const emailAtual = document.getElementById("email").value.trim();
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
            await solicitarCodigo(getEmailVerificacao(), reenviarCodigo, reenviarCodigo.innerHTML);
        });
    }

    const voltarTrocarEmail = document.getElementById("backToResetRequest");
    if (voltarTrocarEmail) {
        voltarTrocarEmail.addEventListener("click", () => {
            limparMensagem();
            const campoEmail = document.getElementById("resetEmail");
            if (campoEmail) campoEmail.value = getEmailVerificacao();
            definirModo("solicitar");
        });
    }

    if (resetVerifyForm) {
        const botao = resetVerifyForm.querySelector("button[type='submit']");
        const conteudoOriginal = botao ? botao.innerHTML : "Validar código e trocar senha";

        resetVerifyForm.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            limparMensagem();

            const email = getEmailVerificacao();
            const codigo = document.getElementById("resetCode").value.trim();
            const novaSenha = document.getElementById("newPassword").value;
            const confirmarSenha = document.getElementById("confirmNewPassword").value;

            if (!/^\d{8}$/.test(codigo)) {
                mostrarMensagem("Digite o código de 8 números recebido por e-mail.", "error");
                document.getElementById("resetCode").focus();
                return;
            }
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

            const banco = obterCliente();
            if (!banco) return;
            definirCarregamento(botao, true, conteudoOriginal);
            try {
                const { data, error } = await banco.functions.invoke("recuperar-senha", {
                    body: { action: "verify", email, code: codigo, newPassword: novaSenha }
                });
                if (error || !data?.ok) throw error || new Error("Verification failed");

                resetVerifyForm.reset();
                document.getElementById("email").value = email;
                document.getElementById("senha").value = "";
                definirModo("login");
                mostrarMensagem("Senha alterada. Agora entre usando sua nova senha.", "success");
            } catch (erro) {
                console.error("Falha ao validar código de recuperação:", erro);
                mostrarMensagem(
                    "Código inválido, expirado ou já utilizado. Confira os 8 dígitos ou solicite outro código.",
                    "error"
                );
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

    // Estado inicial sempre mostra somente o formulário de login.
    if (loginForm) definirModo("login");

    if (!window.supabaseConfigStatus || !window.supabaseConfigStatus.pronto) {
        mostrarMensagem(
            (window.supabaseConfigStatus && window.supabaseConfigStatus.erro) ||
            "Configure a URL e a chave pública do Supabase em js/supabase.js para habilitar a autenticação.",
            "info"
        );
    }
})();
