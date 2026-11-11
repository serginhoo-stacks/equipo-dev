(() => {
  "use strict";

  const form = document.getElementById("cadastroForm");
  const messageBox = document.getElementById("authMessage");
  const nameInput = document.getElementById("nome");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("senha");
  const confirmInput = document.getElementById("confirmarSenha");
  if (!form || !messageBox) return;

  const showMessage = (text, isError = false) => {
    messageBox.textContent = text;
    messageBox.dataset.visible = "true";
    messageBox.setAttribute("role", isError ? "alert" : "status");
    messageBox.classList.toggle("error", isError);
  };

  const readableError = (error) => {
    const text = String(error?.message || "");
    if (/already registered|user already registered/i.test(text)) {
      return "Este e-mail já possui uma conta. Entre ou recupere sua senha.";
    }
    if (/password.*(short|weak)|at least \d+ characters/i.test(text)) {
      return "A senha não atende aos requisitos. Use uma senha mais longa e segura.";
    }
    if (/invalid email/i.test(text)) return "Confira se o e-mail foi digitado corretamente.";
    if (/rate limit|too many requests/i.test(text)) {
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
    }
    return text || "Não foi possível criar sua conta. Tente novamente.";
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    messageBox.textContent = "";
    messageBox.dataset.visible = "false";
    messageBox.classList.remove("error");

    const name = nameInput?.value.trim() || "";
    const email = emailInput?.value.trim().toLowerCase() || "";
    const password = passwordInput?.value || "";
    const confirmation = confirmInput?.value || "";

    if (!name || !email || !password || !confirmation) {
      showMessage("Preencha todos os campos para continuar.", true);
      return;
    }
    if (password !== confirmation) {
      showMessage("As senhas não coincidem. Confira os dois campos.", true);
      confirmInput?.focus();
      return;
    }
    if (password.length < 8) {
      showMessage("Use uma senha com pelo menos 8 caracteres.", true);
      passwordInput?.focus();
      return;
    }

    const banco = window.banco;
    if (!banco?.auth || typeof banco.auth.signUp !== "function") {
      showMessage(
        window.smartInspectSupabaseError?.message ||
          "O serviço de cadastro não foi inicializado. Confira a configuração do Supabase.",
        true
      );
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
    }

    try {
      const redirectUrl = new URL("./login.html", window.location.href).href;
      const { data, error } = await banco.auth.signUp({
        email,
        password,
        options: {
          data: { nome: name },
          emailRedirectTo: redirectUrl,
        },
      });
      if (error) throw error;

      if (data?.session) {
        showMessage("Conta criada com sucesso. Abrindo seu painel…");
        window.location.assign("./painel-pessoal.html");
        return;
      }

      showMessage(
        "Cadastro iniciado. Confira seu e-mail e confirme o endereço para ativar a conta. Depois, entre pela página de login."
      );
      form.reset();
    } catch (error) {
      console.error("Falha ao criar conta SmartInspect:", error);
      showMessage(readableError(error), true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      }
    }
  });
})();
