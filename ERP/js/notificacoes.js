async function criarNotificacao({
    titulo,
    mensagem,
    categoria = "informativo",
    prioridade = "informativo",
    obra_id = null,
    problema = null,
    impacto = null,
    recomendacao = null
}) {

    try {

        // ==========================================
        // VERIFICAR USUÁRIO AUTENTICADO
        // ==========================================

        const {
            data: authData,
            error: authError
        } = await banco.auth.getUser();


        if (authError) {

            console.error(
                "Erro ao identificar usuário:",
                authError
            );

            return null;

        }


        const usuarioAuth =
            authData?.user;


        if (!usuarioAuth) {

            console.warn(
                "Nenhum usuário autenticado."
            );

            return null;

        }


        // ==========================================
        // BUSCAR PERFIL NA TABELA USUARIOS
        // ==========================================

        const {
            data: usuario,
            error: usuarioError
        } = await banco
            .from("usuarios")
            .select("id, auth_id, nome, email")
            .eq(
                "auth_id",
                usuarioAuth.id
            )
            .maybeSingle();


        if (usuarioError) {

            console.error(
                "Erro ao buscar usuário:",
                usuarioError
            );

            return null;

        }


        if (!usuario) {

            console.warn(
                "Perfil do usuário não encontrado na tabela usuarios."
            );

            return null;

        }


        // ==========================================
        // CRIAR NOTIFICAÇÃO
        // ==========================================

        const {
            data,
            error
        } = await banco
            .from("notificacoes")
            .insert([{

                usuario_id:
                    usuario.id,

                obra_id:
                    obra_id,

                titulo:
                    titulo,

                mensagem:
                    mensagem,

                categoria:
                    categoria,

                prioridade:
                    prioridade,

                problema:
                    problema,

                impacto:
                    impacto,

                recomendacao:
                    recomendacao,

                lida:
                    false

            }])
            .select()
            .single();


        if (error) {

            console.error(
                "Erro ao criar notificação:",
                error
            );

            return null;

        }


        console.log(
            "✅ Notificação criada:",
            data
        );


        return data;

    }

    catch (erro) {

        console.error(
            "Erro inesperado ao criar notificação:",
            erro
        );

        return null;

    }

}
