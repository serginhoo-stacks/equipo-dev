(() => {
  "use strict";

  const CHAVE = "smartinspect_configuracoes";
  const PADRAO = {
    idioma: "pt-BR",
    modoEscuro: false,
    altoContraste: false,
    sublinharLinks: false,
    alertasVisuais: true,
    notificacoesTexto: true,
    fonte: "media"
  };

  const TRADUCOES = {
    "Dashboard": { en: "Dashboard", es: "Panel" },
    "Imóveis": { en: "Properties", es: "Inmuebles" },
    "Obras": { en: "Projects", es: "Obras" },
    "Inspeções": { en: "Inspections", es: "Inspecciones" },
    "Estoque": { en: "Inventory", es: "Inventario" },
    "Relatórios": { en: "Reports", es: "Informes" },
    "Inteligência Artificial": { en: "Artificial Intelligence", es: "Inteligencia Artificial" },
    "Equipe": { en: "Team", es: "Equipo" },
    "Meu Perfil": { en: "My Profile", es: "Mi perfil" },
    "Controle de Usuários": { en: "User Management", es: "Gestión de usuarios" },
    "Falar Com Suporte": { en: "Contact Support", es: "Contactar soporte" },
    "Atendimento": { en: "Support Desk", es: "Atención" },
    "Notificações": { en: "Notifications", es: "Notificaciones" },
    "Configurações": { en: "Settings", es: "Configuración" },
    "Sair": { en: "Sign out", es: "Salir" },
    "Aparência": { en: "Appearance", es: "Apariencia" },
    "Idioma": { en: "Language", es: "Idioma" },
    "Acessibilidade": { en: "Accessibility", es: "Accesibilidad" },
    "Salvar configurações": { en: "Save settings", es: "Guardar configuración" },
    "Restaurar padrão": { en: "Restore defaults", es: "Restaurar valores predeterminados" },
    "Modo escuro": { en: "Dark mode", es: "Modo oscuro" },
    "Alto contraste": { en: "High contrast", es: "Alto contraste" },
    "Sublinhar links": { en: "Underline links", es: "Subrayar enlaces" },
    "Tamanho da fonte": { en: "Font size", es: "Tamaño de fuente" },
    "Alertas visuais": { en: "Visual alerts", es: "Alertas visuales" },
    "Notificações em texto": { en: "Text notifications", es: "Notificaciones de texto" },
    "Português (Brasil)": { en: "Portuguese (Brazil)", es: "Portugués (Brasil)" },
    "English": { en: "English", es: "Inglés" },
    "Español": { en: "Spanish", es: "Español" },
    "Nova inspeção": { en: "New inspection", es: "Nueva inspección" },
    "Nova obra": { en: "New project", es: "Nueva obra" },
    "Novo imóvel": { en: "New property", es: "Nuevo inmueble" },
    "Novo estoque": { en: "New inventory item", es: "Nuevo artículo de inventario" },
    "Salvar": { en: "Save", es: "Guardar" },
    "Cancelar": { en: "Cancel", es: "Cancelar" },
    "Editar": { en: "Edit", es: "Editar" },
    "Excluir": { en: "Delete", es: "Eliminar" },
    "Pesquisar": { en: "Search", es: "Buscar" },
    "Voltar": { en: "Back", es: "Volver" },
    "Carregando...": { en: "Loading...", es: "Cargando..." }
  };

  let fonteSelecionada = PADRAO.fonte;

  function carregar() {
    try {
      const salvo = localStorage.getItem(CHAVE);
      return salvo ? { ...PADRAO, ...JSON.parse(salvo) } : { ...PADRAO };
    } catch (erro) {
      console.error("Erro ao carregar configurações:", erro);
      return { ...PADRAO };
    }
  }

  function salvar(config) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ ...PADRAO, ...config }));
    } catch (erro) {
      console.error("Erro ao salvar configurações:", erro);
    }
  }

  function selecionarFonte(tamanho) {
    fonteSelecionada = ["pequena", "media", "grande", "muito-grande"].includes(tamanho)
      ? tamanho : PADRAO.fonte;
    document.querySelectorAll(".btn-tamanho").forEach((botao) => botao.classList.remove("ativo"));
    const id = `fonte${fonteSelecionada.charAt(0).toUpperCase()}${fonteSelecionada.slice(1).replace("-", "")}`;
    document.getElementById(id)?.classList.add("ativo");
  }

  function traduzirPagina(idioma) {
    document.documentElement.lang = idioma;
    document.documentElement.dataset.idioma = idioma;

    document.querySelectorAll("body *:not(script):not(style)").forEach((elemento) => {
      if (elemento.children.length > 0) return;
      const original = elemento.dataset.textoOriginal || elemento.textContent.trim();
      if (!original) return;
      elemento.dataset.textoOriginal = original;
      const traducao = TRADUCOES[original]?.[idioma === "pt-BR" ? "pt" : idioma];
      if (traducao) elemento.textContent = traducao;
    });

    document.querySelectorAll("[placeholder]").forEach((campo) => {
      const original = campo.dataset.placeholderOriginal || campo.placeholder;
      campo.dataset.placeholderOriginal = original;
      const traducao = TRADUCOES[original]?.[idioma === "pt-BR" ? "pt" : idioma];
      if (traducao) campo.placeholder = traducao;
    });
  }

  function aplicar(config) {
    fonteSelecionada = config.fonte || PADRAO.fonte;
    const corpo = document.body;
    corpo.classList.remove("fonte-pequena", "fonte-media", "fonte-grande", "fonte-muito-grande");
    corpo.classList.add(`fonte-${fonteSelecionada}`);
    corpo.classList.toggle("modo-escuro", config.modoEscuro === true);
    corpo.classList.toggle("alto-contraste", config.altoContraste === true);
    corpo.classList.toggle("sublinhar-links", config.sublinharLinks === true);
    traduzirPagina(config.idioma || PADRAO.idioma);
    selecionarFonte(fonteSelecionada);
  }

  function preencherCampos(config) {
    const valor = (id, conteudo) => { const campo = document.getElementById(id); if (campo) campo.value = conteudo; };
    const marcado = (id, estado) => { const campo = document.getElementById(id); if (campo) campo.checked = estado === true; };
    valor("idioma", config.idioma);
    marcado("modoEscuro", config.modoEscuro);
    marcado("altoContraste", config.altoContraste);
    marcado("sublinharLinks", config.sublinharLinks);
    marcado("alertasVisuais", config.alertasVisuais !== false);
    marcado("notificacoesTexto", config.notificacoesTexto !== false);
    aplicar(config);
  }

  window.selecionarFonte = selecionarFonte;
  window.aplicarConfiguracoes = () => aplicar(carregar());

  window.salvarConfiguracoes = () => {
    const config = {
      idioma: document.getElementById("idioma")?.value || PADRAO.idioma,
      modoEscuro: document.getElementById("modoEscuro")?.checked === true,
      altoContraste: document.getElementById("altoContraste")?.checked === true,
      sublinharLinks: document.getElementById("sublinharLinks")?.checked === true,
      alertasVisuais: document.getElementById("alertasVisuais")?.checked !== false,
      notificacoesTexto: document.getElementById("notificacoesTexto")?.checked !== false,
      fonte: fonteSelecionada
    };
    salvar(config);
    aplicar(config);
    const mensagem = document.getElementById("mensagemConfiguracao");
    if (mensagem) {
      mensagem.style.display = "block";
      setTimeout(() => { mensagem.style.display = "none"; }, 3000);
    }
  };

  window.restaurarConfiguracoes = () => {
    if (!confirm("Deseja restaurar as configurações padrão?")) return;
    salvar(PADRAO);
    preencherCampos(PADRAO);
    alert("Configurações restauradas.");
  };

  window.obterPreferencia = (nome) => carregar()[nome];
  window.SmartInspectConfiguracoes = { carregar, salvar, aplicar, restaurar: window.restaurarConfiguracoes };

  function iniciar() {
    preencherCampos(carregar());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
