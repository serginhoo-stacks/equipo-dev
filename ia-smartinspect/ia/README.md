# Backend SmartInspect AI

API FastAPI local que encaminha chat, análise visual e triagem de suporte ao Ollama. O modelo padrão é `qwen3-vl:2b-instruct`. O backend não grava prompts, imagens, respostas ou chamados no Supabase; arquivos de imagem são processados em memória e descartados ao concluir a requisição.

## Arquitetura

- `server.py`: FastAPI, CORS, health check, status do Ollama e formato JSON de erros.
- `routes/`: endpoints compatíveis com `ERP/ia.html` e endpoint de triagem.
- `services/`: chamadas ao Ollama, validação/análise de imagem e triagem de suporte.
- `security/`: valida o access token no Supabase Auth, consulta os vínculos com o JWT do usuário via RLS e aplica rate limit por usuário.
- `schemas/`: validação de payloads e respostas.
- `prompts.py`: instruções distintas por finalidade.
- `tests/`: testes locais com Supabase/Ollama substituídos por mocks.

O backend usa somente a chave pública Supabase `anon`/`publishable` para validar a sessão e consultar `membros_empresa` com o bearer token do próprio usuário. **Não configure `service_role` aqui.** A policy existente `membros_select_proprio_ou_empresa` limita essa consulta aos vínculos do usuário. A API não consulta nem altera linhas de outras empresas.

## Requisitos

- Python 3.11 ou mais recente.
- Ollama instalado e ativo no computador que hospeda o serviço.
- Modelo `qwen3-vl:2b-instruct` disponível em `ollama list`.
- URL do projeto Supabase e sua chave pública anon/publishable.

O frontend é estático na Vercel. O arquivo `vercel.json` atual não executa FastAPI; este serviço precisa rodar separadamente no computador principal ou em um host Python. A API depende do computador e do Ollama estarem ligados.

## Instalação local (Linux/macOS)

Na raiz do repositório:

```bash
python3 -m venv ia/.venv
source ia/.venv/bin/activate
python -m pip install --upgrade pip
pip install -r ia/requirements-dev.txt
cp ia/.env.example ia/.env
```

Edite **`ia/.env`** com a URL Supabase e a chave pública `publishable`/`anon` do projeto. Não copie o `.env` da raiz, não use `service_role` e não envie `ia/.env` ao Git.

Confirme que Ollama está ativo e que o modelo já está instalado. Se o modelo ainda não existir, baixe-o localmente com:

```bash
ollama pull qwen3-vl:2b-instruct
```

Inicie o serviço:

```bash
python -m uvicorn ia.server:app --host 127.0.0.1 --port 8000
```

`127.0.0.1` restringe o listener à máquina local. **Não exponha a porta 11434 do Ollama.**

No Windows PowerShell, crie o ambiente com `py -3 -m venv ia/.venv`, ative `ia/.venv/Scripts/Activate.ps1`, instale `ia/requirements-dev.txt` e inicie com `python -m uvicorn ia.server:app --host 127.0.0.1 --port 8000`.

## Configuração

O backend carrega somente `ia/.env`; nunca lê o `.env` da raiz.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `SUPABASE_URL` | vazio | URL do projeto para validar sessão e vínculo |
| `SUPABASE_PUBLISHABLE_KEY` | vazio | Chave pública; aceita também `SUPABASE_ANON_KEY` |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | API local Ollama |
| `OLLAMA_MODEL` | `qwen3-vl:2b-instruct` | Modelo para chat |
| `OLLAMA_VISION_MODEL` | igual ao modelo de chat | Modelo para imagem |
| `OLLAMA_TIMEOUT_SECONDS` | `120` | Timeout máximo do Ollama |
| `CORS_ORIGINS` | domínio SmartInspect e portas locais | Origens web autorizadas, separadas por vírgula |
| `MAX_IMAGE_BYTES` | `10485760` | Limite de upload: 10 MiB |
| `MAX_IMAGE_PIXELS` | `20000000` | Limite de pixels |
| `CHAT_RATE_LIMIT` | `20` | Mensagens por usuário/janela |
| `IMAGE_RATE_LIMIT` | `5` | Análises de imagem por usuário/janela |
| `SUPPORT_RATE_LIMIT` | `20` | Triagens por usuário/janela |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Janela de rate limit |

## Endpoints

- `GET /health` — verifica somente que o processo FastAPI está ativo; não comprova que o Ollama está disponível.
- `GET /api/ia/status` — exige sessão e informa se Ollama/modelos respondem.
- `POST /api/chat-ia` — exige `Authorization: Bearer <access_token>` e JSON `{ "mensagem": "..." }`; responde `{ "resposta": "..." }`.
- `POST /api/analisar-imagem` — exige bearer token e multipart/form-data com campo `imagem`; aceita JPEG, PNG ou WebP até 10 MiB; responde `{ "analise": "...", "resposta": "..." }`.
- `POST /api/suporte-ia` — exige bearer token e vínculo ativo; JSON `{ "mensagem": "...", "empresa_id": "UUID opcional" }`; responde classificação, urgência, resumo, sugestão e `encaminhar_humano`.

A rota de suporte **só produz uma sugestão de triagem**: não abre, encaminha nem persiste chamado. Para gravar chamados/mensagens, primeiro será preciso definir o fluxo e rever/aprovar as policies RLS; nenhuma tabela foi criada ou modificada.

### Teste manual local

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Rotas protegidas precisam do access token de uma sessão ativa do Supabase:

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://127.0.0.1:8000/api/ia/status

curl -X POST http://127.0.0.1:8000/api/chat-ia \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"mensagem":"Quais cuidados devo tomar ao registrar uma inspeção?"}'
```

## Integração da página Vercel

A tela existente mantém os contratos de rota. Ao servir o frontend e o FastAPI em origens diferentes, configure antes do script da página `window.SMARTINSPECT_IA_API_BASE` com a origem HTTPS da API. A página deve enviar o `access_token` de `window.banco.auth.getSession()` no header `Authorization: Bearer ...`. A atualização mínima em `ERP/ia.html` adiciona esse header e continua usando os nomes de campo atuais.

CORS precisa conter exatamente as origens do site. Não use `*` em produção. A chamada do navegador à Vercel não alcança automaticamente o computador local: configure um endpoint seguro para o backend antes de disponibilizar a IA aos clientes.

## Cloudflare Tunnel e disponibilidade

A etapa local deve manter FastAPI ouvindo em `127.0.0.1:8000` e encaminhar o túnel somente para esse serviço. Não encaminhe nem publique `11434`. O FastAPI exige autenticação Supabase em todas as rotas de IA e confirma vínculo empresarial no endpoint de suporte. Configure domínio/TLS, CORS com o domínio real e controles de acesso do túnel antes de divulgar a URL. Não foi criado nem configurado Tunnel nesta entrega.

Se o computador ou o Ollama estiver desligado, o status indicará indisponibilidade e as rotas de IA retornarão erro genérico 503. O frontend continua hospedado, mas a IA local não estará disponível.

## Segurança e limitações

- Access tokens são validados pelo Supabase Auth em cada solicitação; tokens inválidos/expirados são rejeitados.
- Vínculos ativos são lidos com o JWT do usuário através da RLS, sem `service_role`.
- `empresa_id`, quando informado, é conferido contra os vínculos ativos do usuário.
- Há limites por usuário/operação e um limite adicional de 120 chamadas por IP por janela antes da autenticação. O estado do rate limit é em memória e pressupõe uma única instância FastAPI; antes de usar múltiplas réplicas, troque-o por um store compartilhado.
- Uploads são decodificados/validados e não são armazenados. A análise visual é preliminar, não é laudo nem diagnóstico presencial.
- O modelo pode errar. A IA não inventa conformidade normativa, não confirma segurança estrutural por foto e recomenda avaliação profissional quando necessário.
- Conversas não são persistidas nem recuperáveis. O suporte não cria ticket.
- O `.env` da raiz estava rastreado pelo Git quando esta estrutura foi criada. Não o copiamos nem publicamos; retire-o do tracking e avalie rotação de quaisquer credenciais privilegiadas antes de fazer push.

## Testes

Os testes não chamam Ollama, não enviam e-mail e não escrevem no Supabase:

```bash
pytest -q ia/tests
```
