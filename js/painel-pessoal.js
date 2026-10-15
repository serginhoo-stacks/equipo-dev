(function(){
  "use strict";
  const $=(s)=>document.querySelector(s);
  const message=(text,error=false)=>{const el=$("#pageMessage");el.textContent=text;el.className=`page-message show${error?" error":""}`;};
  const clearMessage=()=>{const el=$("#pageMessage");el.textContent="";el.className="page-message";};
  const setText=(selector,value)=>{const el=$(selector);if(el)el.textContent=value||"—";};
  const escape=()=>{};
  let banco=null,user=null;

  function companyCard(member){
    const company=member.empresa||{};
    const wrapper=document.createElement("article"); wrapper.className="company-card";
    const info=document.createElement("div");
    const name=document.createElement("h3"); name.className="company-name"; name.textContent=company.nome||"Empresa sem nome";
    const meta=document.createElement("div"); meta.className="company-meta";
    [company.status||"status não informado",member.cargo||"membro"].forEach((value,i)=>{const span=document.createElement("span");span.className=i===0&&company.status==="ativa"?"tag":"";span.textContent=value;meta.append(span);});
    info.append(name,meta); const button=document.createElement("button");button.className="company-action";button.textContent="Acessar ambiente";button.addEventListener("click",()=>{window.location.href=`./dashboard.html?empresa_id=${encodeURIComponent(company.id)}`;});
    wrapper.append(info,button);return wrapper;
  }

  async function queryOptional(table,select,filter){
    const result=await banco.from(table).select(select).match(filter||{});return result;
  }
  async function loadPanel(){
    clearMessage();
    const {data:sessionData}=await banco.auth.getSession();
    user=sessionData&&sessionData.session&&sessionData.session.user;
    if(!user){window.location.href="./login.html";return;}
    const displayName=user.user_metadata?.nome||user.user_metadata?.name||user.email?.split("@")[0]||"usuário";
    setText("#userName",displayName);setText("#accountName",displayName);setText("#accountEmail",user.email);setText("#headerEmail",user.email);
    const {data:members,error:membersError}=await banco.from("membros_empresa").select("empresa_id, cargo, ativo, empresa:empresas(id,nome,status)").eq("usuario_id",user.id).eq("ativo",true);
    if(membersError){$("#companiesList").innerHTML="";$("#emptyCompanies").hidden=false;setText("#companyCount","—");message("Não foi possível carregar os vínculos. Verifique as tabelas e políticas RLS de membros_empresa e empresas.",true);return;}
    const active=(members||[]).filter(m=>m.empresa&&m.empresa.status!=="inativa");setText("#companyCount",active.length);
    const list=$("#companiesList");list.innerHTML="";$("#emptyCompanies").hidden=active.length>0;
    active.forEach(m=>list.append(companyCard(m)));
    const invite=await banco.from("convites_empresa").select("id,status").ilike("email",user.email||"");setText("#inviteCount",invite.error?"—":(invite.data||[]).filter(x=>x.status==="pendente").length);
    const requests=await queryOptional("solicitacoes_empresa","id,status",{usuario_id:user.id});setText("#requestCount",requests.error?"—":(requests.data||[]).filter(x=>x.status==="pendente").length);
    const plans=await banco.from("planos").select("id,nome,preco,periodicidade,recursos,ativo").eq("ativo",true).order("preco",{ascending:true});
    const planList=$("#plansList");planList.innerHTML="";
    if(plans.error||!plans.data?.length){planList.innerHTML='<div class="empty-inline">Nenhum plano configurado para exibição.</div>';}
    else plans.data.forEach(plan=>{const card=document.createElement("div");card.className="company-card";const title=document.createElement("h3");title.className="company-name";title.textContent=plan.nome;const meta=document.createElement("div");meta.className="company-meta";meta.textContent=plan.preco==null?"Preço não definido":`${plan.preco} / ${plan.periodicidade||"período"}`;card.append(title,meta);planList.append(card);});
  }

  async function createCompany(event){
    event.preventDefault();const name=$("#companyName").value.trim();const cnpj=$("#companyCnpj").value.trim();const status=$("#companyStatus");const button=$("#submitCompany");if(!name)return;button.disabled=true;status.textContent="Criando empresa...";
    try{const {data:company,error}=await banco.from("empresas").insert({nome:name,cnpj:cnpj||null,status:"ativa"}).select("id").single();if(error)throw error;const {error:memberError}=await banco.from("membros_empresa").insert({empresa_id:company.id,usuario_id:user.id,cargo:"proprietario",ativo:true});if(memberError)throw memberError;$("#companyDialog").close();$("#companyForm").reset();message("Empresa criada e vínculo de proprietário registrado.");await loadPanel();}catch(error){console.error(error);status.textContent="Não foi possível criar. Confira o esquema e as políticas RLS.";}finally{button.disabled=false;}
  }
  async function requestCompany(event){
    event.preventDefault();const companyId=$("#requestCompanyId").value.trim();const status=$("#requestStatus");const button=$("#submitRequest");if(!companyId)return;button.disabled=true;status.textContent="Enviando solicitação...";
    try{const {error}=await banco.from("solicitacoes_empresa").insert({empresa_id:companyId,usuario_id:user.id,status:"pendente"});if(error)throw error;$("#requestDialog").close();$("#requestForm").reset();message("Solicitação enviada. Ela não concede acesso até aprovação.");await loadPanel();}catch(error){console.error(error);status.textContent="Não foi possível enviar. Confirme o ID e as políticas RLS.";}finally{button.disabled=false;}
  }
  async function init(){
    banco=window.banco;if(!banco){message(window.supabaseConfigStatus?.erro||"Supabase não configurado.",true);return;}
    $("#logoutButton").addEventListener("click",async()=>{await banco.auth.signOut();window.location.href="./login.html";});$("#refreshButton").addEventListener("click",loadPanel);$("#createCompanyButton").addEventListener("click",()=>$("#companyDialog").showModal());$("#requestCompanyButton").addEventListener("click",()=>$("#requestDialog").showModal());$("#companyForm").addEventListener("submit",createCompany);$("#requestForm").addEventListener("submit",requestCompany);$("#editAccountButton").addEventListener("click",()=>message("A edição de dados será liberada apenas para campos permitidos pelo perfil."));await loadPanel();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
