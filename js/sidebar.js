async function carregarSidebar() {
    const menu = document.querySelector(".menu-container");
    if (!menu) return;

    try {
        // O caminho "../" é porque o ERP está na pasta ERP e o componentes na raiz
        const resposta = await fetch("../componentes/sidebar.html");

        if (!resposta.ok) {
            console.warn("Menu sidebar.html não encontrado. Verifique a pasta componentes.");
            return;
        }

        const html = await resposta.text();
        menu.innerHTML = html;

        // Se você usa ícones, recria eles
        if (window.lucide) lucide.createIcons();
        
        // Se existir a função de badges, roda
        if (typeof carregarBadgeNotificacoes === "function") carregarBadgeNotificacoes();
        if (typeof carregarBadgeEstoque === "function") carregarBadgeEstoque();

    } catch (erro) {
        console.warn("Erro ao carregar sidebar:", erro);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector(".menu-container")) {
        carregarSidebar();
    }
});
