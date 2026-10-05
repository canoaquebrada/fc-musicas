const $=s=>document.querySelector(s);
let orders=[];
const statuses=["novo","letra_aprovada","aguardando_pagamento","pago","produzindo","entregue","cancelado"];
const labels={novo:"Novo",letra_aprovada:"Letra aprovada",aguardando_pagamento:"Aguard. pagamento",pago:"Pago",produzindo:"Produzindo",entregue:"Entregue",cancelado:"Cancelado"};
function key(){return $("#adminKey").value.trim()}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
async function load(){
  const r=await fetch("/api/admin/orders"+(key()?"?key="+encodeURIComponent(key()):""));
  const data=await r.json();
  if(!r.ok){alert(data.error||"Não autorizado");return}
  orders=data.orders||[];
  const a=data.analytics||{};
  const items=[["Visitas",a.visit||0],["Iniciaram",a.quiz_started||0],["Chegaram à 4ª",a.q4||0],["Letras geradas",a.lyrics_generated||0],["Pedidos",a.order_created||0],["CTAs finais",a.checkout_clicked||0]];
  $("#stats").innerHTML=items.map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
  $("#rows").innerHTML=orders.map(o=>`<tr>
    <td class="id">${esc(o.id)}</td>
    <td><b>${esc(o.customer?.name)}</b><br>${esc(o.customer?.whatsapp)}</td>
    <td>${esc(o.answers?.honoree)} ${o.answers?.age? "("+esc(o.answers.age)+")":""}</td>
    <td>${esc(o.answers?.genre)}<br><small>${esc(o.answers?.voice)}</small></td>
    <td>${new Date(o.createdAt).toLocaleString("pt-BR")}</td>
    <td><select class="status" data-id="${esc(o.id)}">${statuses.map(s=>`<option value="${s}" ${s===o.status?"selected":""}>${labels[s]}</option>`).join("")}</select></td>
    <td><button class="smallbtn" data-view="${esc(o.id)}">Ver detalhes</button></td>
  </tr>`).join("");
  $("#empty").classList.toggle("hidden",orders.length>0);
}
async function setStatus(id,status){
  const r=await fetch("/api/admin/orders/"+encodeURIComponent(id)+(key()?"?key="+encodeURIComponent(key()):""),{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status})});
  if(!r.ok){const d=await r.json();alert(d.error||"Erro ao alterar status")}
}
function view(id){
  const o=orders.find(x=>x.id===id); if(!o)return;
  const a=o.answers||{};
  $("#detailBody").innerHTML=`<span class="eyebrow">${esc(o.id)}</span><h2>${esc(a.honoree)}</h2>
  <div class="answers">
    <div><b>Cliente:</b> ${esc(o.customer?.name)} — ${esc(o.customer?.whatsapp)}</div>
    <div><b>Relação:</b> ${esc(a.relationship)}</div>
    <div><b>Características:</b> ${esc(a.qualities)}</div>
    <div><b>História:</b> ${esc(a.story)}</div>
    <div><b>Estilo/voz:</b> ${esc(a.genre)} — ${esc(a.voice)}</div>
    <div><b>Mensagem:</b> ${esc(a.message)}</div>
  </div><h3>Letra gerada</h3><pre>${esc(o.lyrics)}</pre>`;
  $("#detail").showModal();
}
$("#reload").addEventListener("click",load);
$("#closeDetail").addEventListener("click",()=>$("#detail").close());
$("#rows").addEventListener("change",e=>{if(e.target.matches("[data-id]"))setStatus(e.target.dataset.id,e.target.value)});
$("#rows").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(b)view(b.dataset.view)});
load();
