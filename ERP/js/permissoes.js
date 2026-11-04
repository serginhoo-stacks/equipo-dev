// ======================================================
// SMARTINSPECT AI
// SISTEMA DE PERMISSÕES EM TEMPO REAL
// ======================================================

let usuarioAtual = null;
let canalPermissoes = null;


// ======================================================
// OBTER USUÁRIO LOGADO
// ======================================================

async function carregarPermissoesUsuario() {

    const {
        data: {
            user
        },
        error
    } = await banco.auth.getUser();

    if (error || !user) {

        console.warn("Usuário não autenticado.");

        return null;

    }

    const {
        data,
        error: erroUsuario
    } = await banco
        .from("usuarios")
        .select("*")
        .eq("auth_id", user.id)
        .maybeSingle();

    if (erroUsuario) {

        console.error(
            "Erro ao carregar permissões:",
            erroUsuario
        );

        return null;

    }

    if (!data) {

        console.warn(
            "Perfil do usuário não encontrado."
        );

        return null;

    }

    usuarioAtual = data;

    aplicarPermissoes();

    iniciarRealtimePermissoes();

    return data;

}


// ======================================================
// APLICAR PERMISSÕES
// ======================================================

function aplicarPermissoes() {

    if (!usuarioAtual) {
        return;
    }


    const cargo =
        String(
            usuarioAtual.nivel_acesso || ""
        ).toLowerCase();


    const status =
        String(
            usuarioAtual.status || ""
        ).toLowerCase();


    // ==================================================
    // USUÁRIO INATIVO
    // ==================================================

    if (status !== "ativo") {

        bloquearAcesso();

        return;

    }


    // ==================================================
    // ELEMENTOS COM CLASSIFICAÇÃO DE CARGO
    // ==================================================

    document
        .querySelectorAll("[data-cargos]")
        .forEach(elemento => {

            const cargos =
                elemento
                    .dataset
                    .cargos
                    .split(",")
                    .map(
                        c =>
                            c.trim()
                            .toLowerCase()
                    );

            elemento.style.display =
                cargos.includes(cargo)
                ? ""
                : "none";

        });


    // ==================================================
    // ELEMENTOS ADMIN
    // ==================================================

    document
        .querySelectorAll(".admin-only")
        .forEach(elemento => {

            elemento.style.display =
                cargo === "adm"
                ? ""
                : "none";

        });


    // ==================================================
    // ELEMENTOS ENGENHEIRO
    // ==================================================

    document
        .querySelectorAll(".engenheiro-only")
        .forEach(elemento => {

            elemento.style.display =
                [
                    "adm",
                    "engenheiro"
                ].includes(cargo)
                ? ""
                : "none";

        });


    // ==================================================
    // ELEMENTOS INSPETOR
    // ==================================================

    document
        .querySelectorAll(".inspetor-only")
        .forEach(elemento => {

            elemento.style.display =
                [
                    "adm",
                    "engenheiro",
                    "inspetor"
                ].includes(cargo)
                ? ""
                : "none";

        });


    // ==================================================
    // ELEMENTOS TÉCNICO
    // ==================================================

    document
        .querySelectorAll(".tecnico-only")
        .forEach(elemento => {

            elemento.style.display =
                [
                    "adm",
                    "engenheiro",
                    "inspetor",
                    "tecnico"
                ].includes(cargo)
                ? ""
                : "none";

        });

}


// ======================================================
// REALTIME
// ======================================================

function iniciarRealtimePermissoes() {

    if (!usuarioAtual) {
        return;
    }


    if (canalPermissoes) {

        banco.removeChannel(
            canalPermissoes
        );

    }


    canalPermissoes =
        banco
            .channel(
                "permissoes-" +
                usuarioAtual.id
            )

            .on(

                "postgres_changes",

                {
                    event: "UPDATE",

                    schema: "public",

                    table: "usuarios",

                    filter:
                        "id=eq." +
                        usuarioAtual.id
                },

                payload => {

                    console.log(
                        "🔄 Permissões atualizadas:",
                        payload.new
                    );


                    usuarioAtual =
                        payload.new;


                    aplicarPermissoes();


                    // Atualiza informações
                    // que possam aparecer
                    // na tela.

                    atualizarInformacoesUsuario();


                    // Se perdeu o acesso,
                    // bloqueia imediatamente.

                    if (
                        String(
                            usuarioAtual.status
                        ).toLowerCase()
                        !== "ativo"
                    ) {

                        bloquearAcesso();

                    }

                }

            )

            .subscribe(

                status => {

                    console.log(
                        "Realtime permissões:",
                        status
                    );

                }

            );

}


// ======================================================
// ATUALIZAR INFORMAÇÕES NA TELA
// ======================================================

function atualizarInformacoesUsuario() {

    if (!usuarioAtual) {
        return;
    }


    document
        .querySelectorAll("[data-usuario-nome]")
        .forEach(elemento => {

            elemento.textContent =
                usuarioAtual.nome || "";

        });


    document
        .querySelectorAll("[data-usuario-email]")
        .forEach(elemento => {

            elemento.textContent =
                usuarioAtual.email || "";

        });


    document
        .querySelectorAll("[data-usuario-cargo]")
        .forEach(elemento => {

            elemento.textContent =
                usuarioAtual.nivel_acesso || "";

        });

}


// ======================================================
// BLOQUEAR USUÁRIO
// ======================================================

function bloquearAcesso() {

    alert(
        "⛔ Seu acesso foi alterado pelo administrador."
    );


    banco.auth.signOut()
        .finally(() => {

            localStorage.removeItem(
                "usuario"
            );

            window.location.href =
                "login.html";

        });

}


// ======================================================
// ENCERRAR REALTIME
// ======================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (canalPermissoes) {

            banco.removeChannel(
                canalPermissoes
            );

        }

    }
);


// ======================================================
// INICIAR
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        carregarPermissoesUsuario();

    }
);
