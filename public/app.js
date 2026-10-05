const $ = s => document.querySelector(s);
const chat = $("#chat");
const composer = $("#composer");
const fields = $("#fields");
const send = $("#sendAnswer");
const dialog = $("#lyricsDialog");
const state = { step:0, answers:{}, lyrics:"", source:"", started:false };

const steps = [
  { ask:"1/4 — Qual é o nome do aniversariante e quantos anos vai fazer?", fields:[
      {name:"honoree",type:"text",placeholder:"Nome do aniversariante ou amor",required:true},
      {name:"age",type:"text",placeholder:"Idade (opcional)"}
    ], summary:v => `${v.honoree}${v.age ? ", " + v.age + " anos" : ""}` },
  { ask:"2/4 — Quem é essa pessoa para você e quais características fazem ela ser especial?", fields:[
      {name:"relationship",type:"text",placeholder:"Ex.: meu filho, minha esposa, minha mãe"},
      {name:"qualities",type:"textarea",placeholder:"Ex.: carinhoso, engraçado, guerreiro, ama futebol...",required:true}
    ], summary:v => [v.relationship,v.qualities].filter(Boolean).join(" — ") },
  { ask:"3/4 — Conte uma lembrança ou história que não pode faltar nessa música.", fields:[
      {name:"story",type:"textarea",placeholder:"Conte um momento marcante, uma superação, uma viagem, algo da infância...",required:true}
    ], summary:v => v.story },
  { ask:"4/4 — Como você quer ouvir essa história?", fields:[
      {name:"genre",type:"select",options:["Sertanejo romântico","Gospel","MPB","Pop romântico","Forró","Pagode","Soul/R&B","Rock leve","Outro"],required:true},
      {name:"voice",type:"select",options:["Voz feminina","Voz masculina","Dueto","Tanto faz"]},
      {name:"message",type:"textarea",placeholder:"Mensagem que precisa aparecer na música...",required:true}
    ], summary:v => `${v.genre} • ${v.voice || "voz livre"} — ${v.message}` }
];

function track(eventName){
  fetch("/api/analytics",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event:eventName})}).catch(()=>{});
}
function bubble(text, who="bot", cls=""){
  const el=document.createElement("div");
  el.className="msg "+who+(cls?" "+cls:"");
  el.textContent=text;
  chat.appendChild(el);
  chat.scrollTop=chat.scrollHeight;
  return el;
}
function renderStep(){
  const step=steps[state.step];
  bubble(step.ask);
  fields.innerHTML="";
  for(const f of step.fields){
    let el;
    if(f.type==="textarea"){ el=document.createElement("textarea"); }
    else if(f.type==="select"){
      el=document.createElement("select");
      el.innerHTML='<option value="">Selecione...</option>'+f.options.map(o=>`<option>${o}</option>`).join("");
    } else { el=document.createElement("input"); el.type="text"; }
    el.name=f.name; el.placeholder=f.placeholder||""; el.required=!!f.required;
    fields.appendChild(el);
  }
  composer.classList.remove("hidden");
  $("#progressBar").style.width=(state.step/steps.length*100)+"%";
  setTimeout(()=>fields.querySelector("input,textarea,select")?.focus(),50);
}
function startQuiz(){
  if(state.started) return;
  state.started=true;
  $("#startCard")?.remove();
  track("quiz_started");
  renderStep();
  $("#quiz").scrollIntoView({behavior:"smooth",block:"center"});
}
async function submitStep(){
  const step=steps[state.step];
  const values={}; let valid=true;
  for(const f of step.fields){
    const el=fields.querySelector(`[name="${f.name}"]`);
    const value=el.value.trim();
    if(f.required && !value){ el.focus(); el.style.borderColor="#d33"; valid=false; break; }
    values[f.name]=value;
  }
  if(!valid) return;
  Object.assign(state.answers,values);
  bubble(step.summary(values),"user");
  track("q"+(state.step+1));
  state.step++;
  $("#progressBar").style.width=(state.step/steps.length*100)+"%";
  if(state.step<steps.length) renderStep();
  else { composer.classList.add("hidden"); await generateLyrics(); }
}
async function generateLyrics(){
  const loading=bubble("Escrevendo sua letra personalizada… ✍️","bot","loading");
  try{
    const r=await fetch("/api/lyrics/preview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(state.answers)});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Não foi possível gerar a letra.");
    state.lyrics=data.lyrics; state.source=data.source;
    loading.remove();
    bubble("Prontinho! 🎉 Sua letra foi criada. Abra para ler e me diga se quer transformar em música cantada.","bot");
    setTimeout(()=>{
      $("#lyricsText").textContent=state.lyrics;
      $("#lyricsTitle").textContent="Uma música para "+state.answers.honoree;
      dialog.showModal();
    },350);
  }catch(e){
    loading.textContent="Não consegui gerar agora: "+e.message;
  }
}
async function createOrder(){
  const name=$("#customerName").value.trim();
  const whatsapp=$("#customerWhatsapp").value.trim();
  const note=$("#orderNote");
  if(!whatsapp){ note.textContent="Informe seu WhatsApp para continuar."; return; }
  const btn=$("#approveButton");
  btn.disabled=true; btn.textContent="Salvando seu pedido…";
  try{
    const r=await fetch("/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      customer:{name,whatsapp}, answers:state.answers, lyrics:state.lyrics, source:state.source
    })});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Erro ao salvar.");
    track("checkout_clicked");
    note.textContent="Pedido "+data.orderId+" criado com sucesso.";
    btn.textContent="Pedido criado ✓";
    if(data.nextUrl) setTimeout(()=>window.location.href=data.nextUrl,700);
  }catch(e){
    note.textContent=e.message; btn.disabled=false; btn.textContent="Quero transformar em música cantada 🎤";
  }
}
function resetForVersion(){
  dialog.close();
  state.step=3;
  state.lyrics="";
  composer.classList.remove("hidden");
  bubble("Claro. Vamos ajustar a última etapa e criar outra versão.","bot");
  renderStep();
}
$("#heroStart").addEventListener("click",startQuiz);
$("#chatStart").addEventListener("click",startQuiz);
send.addEventListener("click",submitStep);
fields.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&e.target.tagName!=="TEXTAREA"){e.preventDefault();submitStep();}});
$("#closeDialog").addEventListener("click",()=>dialog.close());
$("#approveButton").addEventListener("click",createOrder);
$("#regenerateButton").addEventListener("click",resetForVersion);
track("visit");
