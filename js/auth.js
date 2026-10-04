// ============================================================
// SmartInspect AI — Autenticação
// js/auth.js
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const resetPassword = document.getElementById("resetPassword");
    const authMessage = document.getElementById("authMessage");

    // ------------------------------------------------------------
    // Verificação básica
    // ------------------------------------------------------------

    if (typeof banco === "undefined") {
        console.error("Supabase não foi inicializado.");
        mostrarMensagem(
            "Não foi possível conectar ao sistema. Verifique a configuração do Supabase.",
            "error"
        );
        return;
    }

    // ------------------------------------------------------------
    // Elementos
    // ------------------------------------------------------------

    const emailInput = document.getElementById("email");
    const senhaInput = document.getElementById("senha");

    // ------------------------------------------------------------
    // Mensagens
    // ------------------------------------------------------------

    function mostrarMensagem(texto, tipo = "info") {
        if (!authMessage) return;

        authMessage.textContent = texto;
        authMessage.dataset.visible = "true";
        authMessage.dataset.type = tipo;
    }

    function limparMensagem() {
        if (!authMessage) return;

        authMessage.textContent = "";
        authMessage.dataset.visible = "false";
        authMessage.dataset.type = "";
    }

    // ------------------------------------------------------------
    // Login
    // ------------------------------------------------------------

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            limparMensagem();

            const email = emailInput?.value.trim();
            const senha = senhaInput?.value;

            if (!email) {
                mostrarMensagem("Digite seu e-mail.", "error");
                emailInput?.focus();
                return;
            }

            if (!senha) {
                mostrarMensagem("Digite sua senha.", "error");
                senhaInput?.focus();
                return;
            }

            const botao = loginForm.querySelector('button[type="submit"]');

            if (botao) {
                botao.disabled = true;
                botao.dataset.originalText = botao.innerHTML;
                botao.innerHTML = "Entrando...";
            }

            try {
                const { data, error } = await banco.auth.signInWithPassword({
                    email,
                    password: senha
                });

                if (error) {
                    console.error("Erro no login:", error);

                    let mensagem = "Não foi possível entrar.";

                    if (
                        error.message?.toLowerCase().includes("invalid login credentials")
                    ) {
                        mensagem = "E-mail ou senha incorretos.";
                    } else if (
                        error.message?.toLowerCase().includes("email not confirmed")
                    ) {
                        mensagem =
                            "Seu e-mail ainda não foi confirmado. Confira sua caixa de entrada.";
                    } else if (error.message) {
                        mensagem = error.message;
                    }

                    mostrarMensagem(mensagem, "error");
                    return;
                }

                if (!data?.session) {
                    mostrarMensagem(
                        "Login realizado, mas nenhuma sessão foi encontrada.",
                        "error"
                    );
                    return;
                }

                mostrarMensagem("Login realizado com sucesso!", "success");

                // Pequeno atraso para o usuário visualizar a mensagem.
                setTimeout(() => {
                    window.location.href = "./dashboard.html";
                }, 500);

            } catch (error) {
                console.error("Erro inesperado no login:", error);

                mostrarMensagem(
                    "Ocorreu um erro inesperado. Tente novamente.",
                    "error"
                );

            } finally {
                if (botao) {
                    botao.disabled = false;

                    if (botao.dataset.originalText) {
                        botao.innerHTML = botao.dataset.originalText;
                    }
                }
            }
        });
    }

    // ------------------------------------------------------------
    // Recuperação de senha
    // ------------------------------------------------------------

    if (resetPassword) {
        resetPassword.addEventListener("click", async (event) => {
            event.preventDefault();

            limparMensagem();

            const email = emailInput?.value.trim();

            if (!email) {
                mostrarMensagem(
                    "Digite seu e-mail acima para receber o link de recuperação.",
                    "error"
                );

                emailInput?.focus();
                return;
            }

            // URL para onde o Supabase enviará o usuário
            // depois que ele clicar no link recebido por e-mail.
            const redirectTo = `${window.location.origin}/login.html`;

            try {
                resetPassword.style.pointerEvents = "none";
                resetPassword.style.opacity = "0.6";

                const { error } = await banco.auth.resetPasswordForEmail(
                    email,
                    {
                        redirectTo
                    }
                );

                if (error) {
                    console.error(
                        "Erro ao solicitar recuperação:",
                        error
                    );

                    let mensagem =
                        "Não foi possível solicitar a recuperação.";

                    if (
                        error.message?.toLowerCase().includes("redirect")
                    ) {
                        mensagem =
                            "A URL de recuperação ainda não está autorizada no Supabase.";
                    } else if (error.message) {
                        mensagem = error.message;
                    }

                    mostrarMensagem(mensagem, "error");
                    return;
                }

                mostrarMensagem(
                    "Enviamos um link de recuperação para o seu e-mail. Confira também a caixa de spam.",
                    "success"
                );

            } catch (error) {
                console.error(
                    "Erro inesperado na recuperação:",
                    error
                );

                mostrarMensagem(
                    "Ocorreu um erro ao solicitar a recuperação. Tente novamente.",
                    "error"
                );

            } finally {
                setTimeout(() => {
                    resetPassword.style.pointerEvents = "";
                    resetPassword.style.opacity = "";
                }, 1500);
            }
        });
    }

    // ------------------------------------------------------------
    // Verificar sessão atual
    // ------------------------------------------------------------

    verificarSessao();

    async function verificarSessao() {
        try {
            const { data, error } = await banco.auth.getSession();

            if (error) {
                console.error(
                    "Erro ao verificar sessão:",
                    error
                );
                return;
            }

            // Se o usuário já estiver autenticado e abrir o login,
            // podemos mandá-lo para o dashboard.
            if (data?.session) {
                console.log("Usuário já autenticado.");

                // Não redireciona imediatamente se estiver usando
                // o fluxo de recuperação de senha.
                const hash = window.location.hash;

                if (
                    hash &&
                    (
                        hash.includes("access_token") ||
                        hash.includes("type=recovery")
                    )
                ) {
                    return;
                }

                // Descomente se quiser impedir usuários logados
                // de permanecerem na página de login:
                //
                // window.location.href = "./dashboard.html";
            }

        } catch (error) {
            console.error(
                "Erro inesperado ao verificar sessão:",
                error
            );
        }
    }

    // ------------------------------------------------------------
    // Monitorar alterações de autenticação
    // ------------------------------------------------------------

    banco.auth.onAuthStateChange((event, session) => {
        console.log("Evento de autenticação:", event);

        if (event === "SIGNED_IN" && session) {
            console.log("Usuário autenticado.");
        }

        if (event === "SIGNED_OUT") {
            console.log("Usuário desconectado.");
        }

        if (event === "PASSWORD_RECOVERY") {
            console.log("Fluxo de recuperação de senha iniciado.");
        }
    });
});
