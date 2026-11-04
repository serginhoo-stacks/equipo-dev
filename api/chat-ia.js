export default async function handler(req, res) {

    console.log("SMARTINSPECT CHAT IA EXECUTOU");

    // ==========================================
    // ACEITAR SOMENTE POST
    // ==========================================

    if (req.method !== "POST") {

        return res.status(405).json({
            erro: "Método não permitido."
        });

    }


    // ==========================================
    // PEGAR MENSAGEM
    // ==========================================

    const { mensagem } = req.body || {};

    if (!mensagem || !mensagem.trim()) {

        return res.status(400).json({
            erro: "Mensagem não informada."
        });

    }


    // ==========================================
    // VERIFICAR API KEY DA GROQ
    // ==========================================

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {

        console.error(
            "GROQ_API_KEY não configurada."
        );

        return res.status(500).json({
            erro: "A chave da Groq não está configurada no servidor."
        });

    }


    try {

        // ==========================================
        // CHAMAR GROQ
        // ==========================================

        const resposta = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json",

                    "Authorization":
                        `Bearer ${apiKey}`

                },

                body: JSON.stringify({

                    model: "openai/gpt-oss-20b",

                    messages: [

                        {
                            role: "system",

                            content:
                                `Você é o SmartInspect AI,
um assistente especializado em engenharia civil,
inspeções prediais e construção civil.

Responda sempre em português do Brasil.

Ajude o usuário com:
- inspeções;
- patologias da construção;
- materiais;
- concreto;
- estruturas;
- revestimentos;
- alvenaria;
- instalações;
- manutenção;
- não conformidades;
- possíveis causas;
- recomendações de correção;
- segurança;
- normas técnicas.

Quando não tiver informações suficientes,
deixe isso claro e peça os dados necessários.

Não invente normas, números de normas ou resultados
de uma inspeção que não foram fornecidos.

Suas respostas devem ser claras, técnicas e práticas.`
                        },

                        {
                            role: "user",

                            content: mensagem.trim()
                        }

                    ],

                    temperature: 0.3,

                    max_tokens: 2000

                })

            }
        );


        // ==========================================
        // LER RESPOSTA DA GROQ
        // ==========================================

        const texto =
            await resposta.text();

        console.log(
            "Resposta Groq:",
            texto
        );


        let dados;


        try {

            dados = JSON.parse(texto);

        } catch {

            return res.status(500).json({

                erro:
                    "Resposta inválida recebida da Groq."

            });

        }


        // ==========================================
        // ERRO DA GROQ
        // ==========================================

        if (!resposta.ok) {

            console.error(
                "Erro Groq:",
                dados
            );

            return res.status(
                resposta.status
            ).json({

                erro:
                    dados?.error?.message ||
                    dados?.message ||
                    "Erro ao consultar a Groq."

            });

        }


        // ==========================================
        // PEGAR RESPOSTA DA IA
        // ==========================================

        const respostaIA =
            dados?.choices?.[0]?.message?.content;


        if (!respostaIA) {

            return res.status(500).json({

                erro:
                    "A Groq não retornou uma resposta."

            });

        }


        // ==========================================
        // DEVOLVER PARA O SMARTINSPECT
        // ==========================================

        return res.status(200).json({

            sucesso: true,

            resposta: respostaIA

        });


    } catch (error) {

        console.error(
            "Erro interno /api/chat-ia:",
            error
        );


        return res.status(500).json({

            erro:
                "Erro interno ao conectar com a Groq."

        });

    }

}
