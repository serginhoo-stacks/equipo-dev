(() => {
  "use strict";

  const STORAGE_KEY = "smartinspect:configuracoes";
  const DEFAULTS = {
    modoEscuro: false,
    altoContraste: false,
    sublinharLinks: false,
    tamanhoFonte: "media",
    idioma: "pt-BR",
    alertasVisuais: true,
    notificacoesTexto: true,
  };

  const $ = (id) => document.getElementById(id);

  function ler() {
    try {
      const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...DEFAULTS, ...(salvo && typeof salvo === "object" ? salvo : {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function escrever(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn("Não foi possível salvar as configurações neste dispositivo.", error);
    }
  }

  function aplicar(config) {
    const body = document.body;
    body.classList.toggle("modo-escuro", Boolean(config.modoEscuro));
    body.classList.toggle("alto-contraste", Boolean(config.altoContraste));
    body.classList.toggle("sublinhar-links", Boolean(config.sublinharLinks));
    ["pequena", "media", "grande", "muito-grande"].forEach((tamanho) => {
      body.classList.toggle(`fonte-${tamanho}`, config.tamanhoFonte === tamanho);
      const botao = $(`fonte${tamanho === "media" ? "Media" : tamanho === "muito-grande" ? "MuitoGrande" : tamanho[0].toUpperCase() + tamanho.slice(1)}`);
      botao?.classList.toggle("ativo", config.tamanhoFonte === tamanho);
      botao?.setAttribute("aria-pressed", String(config.tamanhoFonte === tamanho));
    });
    ["modoEscuro", "altoContraste", "sublinharLinks", "alertasVisuais", "notificacoesTexto"].forEach((id) => {
      const input = $(id);
      if (input) input.checked = Boolean(config[id]);
    });
    const idioma = $("idioma");
    if (idioma) idioma.value = config.idioma;
  }

  function selecionarFonte(tamanho) {
    const config = ler();
    config.tamanhoFonte = tamanho;
    aplicar(config);
    escrever(config);
  }

  function salvarConfiguracoes() {
    const anterior = ler();
    const config = {
      ...anterior,
      modoEscuro: Boolean($("modoEscuro")?.checked),
      altoContraste: Boolean($("altoContraste")?.checked),
      sublinharLinks: Boolean($("sublinharLinks")?.checked),
      idioma: $("idioma")?.value || anterior.idioma,
      alertasVisuais: Boolean($("alertasVisuais")?.checked),
      notificacoesTexto: Boolean($("notificacoesTexto")?.checked),
    };
    escrever(config);
    aplicar(config);
    const mensagem = $("mensagemConfiguracao");
    if (mensagem) {
      mensagem.textContent = "Configurações salvas com sucesso neste dispositivo.";
      mensagem.classList.remove("is-error");
      mensagem.classList.add("visivel");
      window.setTimeout(() => mensagem.classList.remove("visivel"), 3000);
    }
  }

  function restaurarConfiguracoes() {
    const config = { ...DEFAULTS };
    escrever(config);
    aplicar(config);
    const mensagem = $("mensagemConfiguracao");
    if (mensagem) {
      mensagem.textContent = "Configurações restauradas para o padrão.";
      mensagem.classList.remove("is-error");
      mensagem.classList.add("visivel");
    }
  }

  window.selecionarFonte = selecionarFonte;
  window.salvarConfiguracoes = salvarConfiguracoes;
  window.restaurarConfiguracoes = restaurarConfiguracoes;

  document.addEventListener("DOMContentLoaded", () => {
    const config = ler();
    aplicar(config);
    ["modoEscuro", "altoContraste", "sublinharLinks", "alertasVisuais", "notificacoesTexto", "idioma"].forEach((id) => {
      $(id)?.addEventListener("change", () => aplicar({ ...ler(), [id]: id === "idioma" ? $(id).value : $(id).checked }));
    });
  });
})();
