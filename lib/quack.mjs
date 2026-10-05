export function clean(v,max=1200){return String(v??"").replace(/\0/g,"").trim().slice(0,max)}
export function normalizeAnswers(body={}){
  return {
    honoree:clean(body.honoree,80),
    age:clean(body.age,10),
    relationship:clean(body.relationship,80),
    qualities:clean(body.qualities,500),
    story:clean(body.story,1200),
    genre:clean(body.genre,60),
    voice:clean(body.voice,40),
    message:clean(body.message,700)
  };
}
export function validateAnswers(a){
  const missing=[];
  if(!a.honoree)missing.push("nome do aniversariante");
  if(!a.qualities)missing.push("características");
  if(!a.story)missing.push("história");
  if(!a.genre)missing.push("estilo musical");
  if(!a.message)missing.push("mensagem final");
  return missing;
}
export function lyricPrompt(a){
  return [
    "Crie uma letra ORIGINAL em português do Brasil para uma música personalizada de presente.",
    "Ela deve emocionar, soar natural ao cantar e usar somente fatos informados pelo cliente.",
    "Estrutura: TÍTULO, VERSO 1, PRÉ-REFRÃO, REFRÃO, VERSO 2, PONTE, REFRÃO FINAL.",
    "Não invente nomes, datas, parentes ou acontecimentos.",
    "Evite clichês excessivos e preserve respeito familiar.",
    "Comprimento aproximado: 260 a 380 palavras.",
    "",
    "Dados:",
    "Aniversariante: "+a.honoree+(a.age?" | Idade: "+a.age:""),
    "Relação com quem presenteia: "+(a.relationship||"não informada"),
    "Características: "+a.qualities,
    "História/memória: "+a.story,
    "Estilo: "+a.genre,
    "Voz desejada: "+(a.voice||"livre"),
    "Mensagem que precisa entrar: "+a.message,
    "",
    "Retorne apenas a letra, sem explicações."
  ].join("\n");
}
export async function generateLyrics(a){
  const baseUrl=(process.env.QUACKAPI_BASE_URL||"https://quackapi.erlancarreira.com.br").replace(/\/+$/,"");
  const apiKey=process.env.QUACKAPI_API_KEY||"";
  const model=process.env.QUACKAPI_MODEL||"duckai/gpt-5.6-luna";
  if(!apiKey)throw new Error("QUACKAPI_API_KEY não configurada");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),55000);
  try{
    const r=await fetch(baseUrl+"/v1/chat/completions",{
      method:"POST",
      headers:{"content-type":"application/json",authorization:"Bearer "+apiKey},
      body:JSON.stringify({
        model,
        stream:false,
        messages:[
          {role:"system",content:"Você é um compositor profissional brasileiro especializado em músicas personalizadas emocionantes. Use somente os fatos fornecidos, escreva versos cantáveis e naturais e retorne apenas a letra completa."},
          {role:"user",content:lyricPrompt(a)}
        ]
      }),
      signal:controller.signal
    });
    if(!r.ok){const detail=(await r.text()).slice(0,500);throw new Error("QuackAPI HTTP "+r.status+(detail?": "+detail:""))}
    const data=await r.json();
    const out=data?.choices?.[0]?.message?.content;
    if(!out||out.length<120)throw new Error("QuackAPI retornou resposta vazia");
    return {lyrics:out.trim(),source:"quackapi",model};
  }finally{clearTimeout(timer)}
}
export function json(res,status,body){
  res.statusCode=status;
  res.setHeader("content-type","application/json; charset=utf-8");
  res.setHeader("cache-control","no-store");
  res.end(JSON.stringify(body));
}
