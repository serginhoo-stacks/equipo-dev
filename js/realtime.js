/* =====================================================
   SMARTINSPECT AI
   ATUALIZAÇÃO AUTOMÁTICA
===================================================== */

(function () {

    if (typeof banco === "undefined") {

        console.error(
            "Supabase não encontrado."
        );

        return;

    }


    let timerAtualizacao = null;


    /*
    ==========================================
    RECARREGAR DADOS DA PÁGINA
    ==========================================
    */

    function atualizarPagina() {

        /*
        Se a página tiver uma função específica,
        usamos ela.
        */

        if (
            typeof carregarDados ===
            "function"
        ) {

            carregarDados();

            return;

        }


        if (
            typeof carregarObras ===
            "function"
        ) {

            carregarObras();

            return;

        }


        if (
            typeof carregarImoveis ===
            "function"
        ) {

            carregarImoveis();

            return;

        }


        if (
            typeof carregarInspecoes ===
            "function"
        ) {

            carregarInspecoes();

            return;

        }


        if (
            typeof carregarEstoque ===
            "function"
        ) {

            carregarEstoque();

            return;

        }


        if (
            typeof carregarNotificacoes ===
            "function"
        ) {

            carregarNotificacoes();

            return;

        }


        /*
        Caso a página não tenha uma função
        específica, podemos disparar um evento.
        */

        window.dispatchEvent(
            new CustomEvent(
                "smartinspect:atualizar"
            )
        );

    }


    /*
    ==========================================
    REALTIME GERAL
    ==========================================
    */

    const canal =

        banco

        .channel(
            "smartinspect-atualizacao-geral"
        )


        .on(

            "postgres_changes",

            {
                event: "*",
                schema: "public",
                table: "obras"
            },

            function (payload) {

                console.log(
                    "🔄 Obras atualizadas"
                );

                atualizarComAtraso();

            }

        )


        .on(

            "postgres_changes",

            {
                event: "*",
                schema: "public",
                table: "imoveis"
            },

            function (payload) {

                console.log(
                    "🔄 Imóveis atualizados"
                );

                atualizarComAtraso();

            }

        )


        .on(

            "postgres_changes",

            {
                event: "*",
                schema: "public",
                table: "inspecoes"
            },

            function (payload) {

                console.log(
                    "🔄 Inspeções atualizadas"
                );

                atualizarComAtraso();

            }

        )


        .on(

            "postgres_changes",

            {
                event: "*",
                schema: "public",
                table: "solicitacoes_suporte"
            },

            function (payload) {

                console.log(
                    "🔄 Suporte atualizado"
                );

                atualizarComAtraso();

            }

        )


        .on(

            "postgres_changes",

            {
                event: "*",
                schema: "public",
                table: "suporte_mensagens"
            },

            function (payload) {

                console.log(
                    "💬 Nova mensagem"
                );

                atualizarComAtraso();

            }

        )


        .on(

            "postgres_changes",

            {
                event: "*",
                schema: "public",
                table: "notificacoes"
            },

            function (payload) {

                console.log(
                    "🔔 Notificações atualizadas"
                );

                atualizarComAtraso();

            }

        )


        .subscribe(

            function (status) {

                console.log(
                    "Realtime geral:",
                    status
                );

            }

        );


    /*
    ==========================================
    EVITAR VÁRIAS ATUALIZAÇÕES AO MESMO TEMPO
    ==========================================
    */

    function atualizarComAtraso() {

        clearTimeout(
            timerAtualizacao
        );


        timerAtualizacao =

            setTimeout(

                function () {

                    atualizarPagina();

                },

                300

            );

    }


    /*
    ==========================================
    EVENTO MANUAL
    ==========================================
    */

    window.addEventListener(

        "smartinspect:atualizar",

        function () {

            console.log(
                "🔄 Atualização solicitada"
            );

        }

    );


})();
