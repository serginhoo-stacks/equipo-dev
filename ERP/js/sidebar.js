async function carregarSidebar() {
    const menu = document.querySelector(".menu-container");
    if (!menu) return;

    try {
        // Ajuste do caminho para voltar uma pasta, pois o script está rodando de dentro da pasta ERP
        const resposta = await fetch("../componentes/sidebar.html");

        if (!resposta.ok) {
            console.warn("Sidebar não encontrado em ../componentes/sidebar.html. O menu não será exibido.");
            return;
        }

        const html = await resposta.text();
        menu.innerHTML = html;

        // ==========================================
        // DEPOIS QUE A SIDEBAR CARREGOU
        // ==========================================
        inicializarBadgesSidebar();
        
        // Se você usa ícones do Lucide, recria eles após carregar a sidebar
        if (window.lucide) lucide.createIcons();

    } catch (erro) {
        console.warn("Sidebar não pôde ser carregada (isso é normal se o arquivo não existir).");
    }
}

// ==========================================
// INICIALIZAR BADGES
// ==========================================
function inicializarBadgesSidebar() {
    carregarBadgeNotificacoes();
    carregarBadgeEstoque();

    // Atualiza a cada 30 segundos
    setInterval(() => {
        carregarBadgeNotificacoes();
        carregarBadgeEstoque();
    }, 30000);
}

// ==========================================
// 🔔 NOTIFICAÇÕES NÃO LIDAS
// ==========================================
async function carregarBadgeNotificacoes() {
    const badge = document.getElementById("badgeNotificacoes");
    if (!badge) return;

    try {
        if (typeof banco === "undefined") return;

        let usuario = null;
        if (typeof getUsuario === "function") {
            usuario = getUsuario();
        }

        // Se não achar usuário local, ele apenas ignora o badge e NÃO joga pro login.
        if (!usuario) {
            badge.style.display = "none";
            return;
        }

        const { count, error } = await banco
            .from("notificacoes")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", usuario.id)
            .eq("lida", false);

        if (error) return;

        atualizarBadge(badge, count || 0);

    } catch (erro) {
        // Ignora falhas silenciosamente para não quebrar a tela
    }
}

// ==========================================
// 📦 ESTOQUE ABAIXO DO MÍNIMO
// ==========================================
async function carregarBadgeEstoque() {
    const badge = document.getElementById("badgeEstoque");
    if (!badge) return;

    try {
        if (typeof banco === "undefined") return;

        const { data, error } = await banco.from("estoque").select("*");

        if (error || !data) {
            atualizarBadge(badge, 0);
            return;
        }

        let quantidadeBaixo = 0;
        data.forEach(item => {
            const quantidade = Number(item.quantidade ?? item.estoque_atual ?? item.estoque ?? item.qtd ?? 0);
            const minimo = Number(item.estoque_minimo ?? item.quantidade_minima ?? item.minimo ?? item.estoque_min ?? 0);

            if (minimo > 0 && quantidade <= minimo) {
                quantidadeBaixo++;
            }
        });

        atualizarBadge(badge, quantidadeBaixo);

    } catch (erro) {
         // Ignora falhas silenciosamente
    }
}

// ==========================================
// ATUALIZAR BADGE
// ==========================================
function atualizarBadge(badge, quantidade) {
    if (!badge) return;
    quantidade = Number(quantidade) || 0;

    if (quantidade <= 0) {
        badge.style.display = "none";
        badge.textContent = "";
        return;
    }

    badge.textContent = quantidade > 99 ? "99+" : quantidade;
    badge.style.display = "inline-flex";
}

// INICIAR (Só roda se o elemento da sidebar existir na tela)
document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector(".menu-container")) {
        carregarSidebar();
    }
});
