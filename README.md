# SmartInspect AI — etapa de autenticação

Esta pasta contém uma versão inicial construída a partir da landing page HTML enviada anteriormente e do escopo em texto recebido. O ZIP do projeto original, os arquivos de imagem, a URL do novo projeto Supabase e sua chave pública não estavam disponíveis no ambiente.

## Arquivos

- `index.html` — cópia preservada da landing page recebida; o CTA já aponta para `login.html`.
- `login.html` — login com e-mail/senha, recuperação de senha e leitura do perfil/vínculo empresarial.
- `cadastro.html` — cadastro com nome, e-mail, senha e confirmação.
- `js/supabase.js` — inicialização Supabase JS v2 com placeholders; não contém credenciais reais.
- `js/auth.js` — lógica compartilhada dos formulários.
- `css/style.css` — estilos isolados das páginas de autenticação.

## Configuração Supabase

1. Abra `js/supabase.js`.
2. Substitua `https://SEU_PROJECT_REF.supabase.co` pela URL do projeto.
3. Substitua `SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE` pela chave pública do projeto (anon/publishable).
4. **Nunca coloque uma `service_role` key no frontend.**
5. No painel Supabase, configure a URL do site e os Redirect URLs usados para confirmação de e-mail e recuperação de senha. Em desenvolvimento, inclua a origem local.
6. Sirva a pasta por HTTP local (por exemplo, `python3 -m http.server 8000`) e abra `http://localhost:8000/login.html`; não teste fluxos de autenticação via `file://`.

## Fluxos implementados

- Login: `supabase.auth.signInWithPassword()`, consulta `perfis` para confirmar o perfil criado pelo trigger e consulta `membros_empresa` com a relação a `empresas`. Se houver exatamente uma empresa ativa, segue para `./dashboard.html`. Se não houver vínculo, informa que a criação da empresa/Base pertence a uma etapa posterior. Se houver mais de uma empresa, não escolhe uma automaticamente.
- Recuperação: `supabase.auth.resetPasswordForEmail()`; o URL de retorno também precisa estar permitido no painel Supabase.
- Cadastro: `supabase.auth.signUp()` com `options.data.nome` e URL de confirmação. O frontend **não** insere em `perfis`: `public.criar_perfil_usuario()` deve fazê-lo por meio do trigger já existente.
- O cadastro não cria empresa, membro, convite nem configurações da Base.

## Limites e pendências conhecidas

- Não foi recebido o ZIP/repositório original; a pasta não substitui a revisão do projeto completo. Somente o `index.html` enviado anteriormente foi preservado aqui.
- Não foi enviado `dashboard.html`; portanto, o redirecionamento pós-login para esse arquivo pressupõe que ele exista quando esta etapa for integrada ao projeto completo.
- Os arquivos reais de `imagens/logo.png`, `imagens/favicon.png` e o CSS global original não foram fornecidos. A referência existente na landing page foi mantida, sem inventar nem substituir a identidade visual.
- Não foram criadas nem alteradas tabelas, funções, triggers ou políticas RLS. Antes de produção, confirme RLS e políticas seguras em `perfis`, `empresas`, `membros_empresa` e `convites_empresa`; sem políticas apropriadas, uma chave pública no navegador não torna esses dados protegidos.
- As consultas frontend ajudam no fluxo, mas não são uma camada de autorização. A autorização real precisa vir do RLS no banco.
- Não foi possível testar contra o projeto Supabase real porque URL/chave e ligação ao projeto não foram disponibilizadas. Os fluxos foram verificados estaticamente.
