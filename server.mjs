import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");

const PORT = Number(process.env.PORT || 3090);
const BRAND_NAME = process.env.BRAND_NAME || "FC Músicas";
const WHATSAPP_NUMBER = (process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
const CHECKOUT_URL = process.env.CHECKOUT_URL || "";
const QUACK_CONFIG_FILE = path.join(__dirname, "quackapi.local.json");
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const MAX_BODY = 1024 * 1024;
const rate = new Map();
let aiQueue = Promise.resolve();

await fs.mkdir(DATA_DIR, { recursive: true });
await ensureJson(ORDERS_FILE, []);
await ensureJson(ANALYTICS_FILE, {});

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
    "cache-control": "no-store"
  });
  res.end(data);
}

function text(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "content-length": Buffer.byteLength(body) });
  res.end(body);
}

async function ensureJson(file, fallback) {
  try { JSON.parse(await fs.readFile(file, "utf8")); }
  catch { await fs.writeFile(file, JSON.stringify(fallback, null, 2), "utf8"); }
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
}
async function writeJson(file, value) {
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("Corpo da requisição muito grande");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
}
function localRequest(req) {
  const ip = clientIp(req);
  return ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1";
}
function safeEqual(a,b) {
  const aa=Buffer.from(String(a||"")); const bb=Buffer.from(String(b||""));
  return aa.length===bb.length && aa.length>0 && crypto.timingSafeEqual(aa,bb);
}
function isAdmin(req, url) {
  if (localRequest(req) && !ADMIN_KEY) return true;
  const key = req.headers["x-admin-key"] || url.searchParams.get("key") || "";
  return Boolean(ADMIN_KEY && safeEqual(key, ADMIN_KEY));
}
function allowed(req, bucket, limit = 18, windowMs = 60000) {
  const key = bucket + ":" + clientIp(req);
  const now = Date.now();
  const list = (rate.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= limit) return false;
  list.push(now); rate.set(key, list); return true;
}
function clean(v, max = 1200) {
  return String(v ?? "").replace(/\0/g, "").trim().slice(0, max);
}
function normalizeAnswers(body) {
  return {
    honoree: clean(body.honoree, 80),
    age: clean(body.age, 10),
    relationship: clean(body.relationship, 80),
    qualities: clean(body.qualities, 500),
    story: clean(body.story, 1200),
    genre: clean(body.genre, 60),
    voice: clean(body.voice, 40),
    message: clean(body.message, 700)
  };
}
function validateAnswers(a) {
  const missing = [];
  if (!a.honoree) missing.push("nome do aniversariante");
  if (!a.qualities) missing.push("características");
  if (!a.story) missing.push("história");
  if (!a.genre) missing.push("estilo musical");
  if (!a.message) missing.push("mensagem final");
  return missing;
}
async function quackConfig() {
  let local = {};
  try { local = JSON.parse(await fs.readFile(QUACK_CONFIG_FILE, "utf8")); } catch {}
  const baseUrl = clean(process.env.QUACKAPI_BASE_URL || local.baseUrl || "https://quackapi.erlancarreira.com.br", 300).replace(/\/+$/, "");
  const apiKey = clean(process.env.QUACKAPI_API_KEY || local.apiKey || "", 500);
  const model = clean(process.env.QUACKAPI_MODEL || local.model || "duckai/gpt-5.6-luna", 120);
  if (!apiKey) throw new Error("QUACKAPI_API_KEY não configurada");
  return { baseUrl, apiKey, model };
}
function lyricPrompt(a) {
  return [
    "Crie uma letra ORIGINAL em português do Brasil para uma música personalizada de presente.",
    "Ela deve emocionar, soar natural ao cantar e usar somente fatos informados pelo cliente.",
    "Estrutura: TÍTULO, VERSO 1, PRÉ-REFRÃO, REFRÃO, VERSO 2, PONTE, REFRÃO FINAL.",
    "Não invente nomes, datas, parentes ou acontecimentos.",
    "Evite clichês excessivos e preserve respeito familiar.",
    "Comprimento aproximado: 260 a 380 palavras.",
    "",
    "Dados:",
    "Aniversariante: " + a.honoree + (a.age ? " | Idade: " + a.age : ""),
    "Relação com quem presenteia: " + (a.relationship || "não informada"),
    "Características: " + a.qualities,
    "História/memória: " + a.story,
    "Estilo: " + a.genre,
    "Voz desejada: " + (a.voice || "livre"),
    "Mensagem que precisa entrar: " + a.message,
    "",
    "Retorne apenas a letra, sem explicações."
  ].join("\n");
}
async function generateViaAI(a) {
  const cfg = await quackConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const r = await fetch(cfg.baseUrl + "/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        messages: [
          { role: "system", content: "Você é um compositor profissional brasileiro especializado em músicas personalizadas emocionantes. Use somente os fatos fornecidos, escreva versos cantáveis e naturais, e retorne apenas a letra completa." },
          { role: "user", content: lyricPrompt(a) }
        ]
      }),
      signal: controller.signal
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 600);
      throw new Error("QuackAPI respondeu HTTP " + r.status + (detail ? ": " + detail : ""));
    }
    const data = await r.json();
    const out = data?.choices?.[0]?.message?.content;
    if (!out || out.length < 120) throw new Error("QuackAPI retornou uma resposta vazia");
    return out.trim();
  } finally { clearTimeout(timer); }
}
function localLyrics(a) {
  const age = a.age ? "Hoje são " + a.age + " anos para celebrar" : "Hoje é dia de celebrar";
  const rel = a.relationship ? "de quem te ama como " + a.relationship : "de quem te ama de verdade";
  return `TÍTULO: Para ${a.honoree}

VERSO 1
${age}, ${a.honoree}, vem sorrir
Tem uma história bonita que merece existir
${a.qualities}
E em cada detalhe há um motivo pra cantar

PRÉ-REFRÃO
O tempo passa, mas o carinho fica aqui
E essa lembrança volta sempre a nos unir

REFRÃO
${a.honoree}, essa canção é pra você
Um presente em forma de som, ${rel}
Que a vida abrace os sonhos que você guardou
E nunca falte perto de você quem te amou

VERSO 2
Tem um momento que ninguém vai esquecer:
${a.story}
É dessas coisas que o coração sabe guardar
E quando a música tocar, vão todos recordar

PONTE
No ritmo de ${a.genre}, deixa a emoção falar
${a.message}

REFRÃO FINAL
${a.honoree}, essa canção é pra você
Pra celebrar sua história e tudo que ainda vai viver
Que cada verso leve amor por onde for
E hoje o seu nome vire música, memória e amor.`;
}
async function queuedAI(a) {
  const job = aiQueue.then(() => generateViaAI(a), () => generateViaAI(a));
  aiQueue = job.catch(() => {}); return job;
}
async function event(name) {
  const data = await readJson(ANALYTICS_FILE, {});
  data[name] = Number(data[name] || 0) + 1;
  data.updatedAt = new Date().toISOString();
  await writeJson(ANALYTICS_FILE, data);
}
function orderId() {
  return "FCM-" + new Date().toISOString().slice(2,10).replaceAll("-","") + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}
const mime = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".ico":"image/x-icon"};
async function serveStatic(url,res) {
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==="/") pathname="/index.html";
  if(pathname==="/admin") pathname="/admin.html";
  const full=path.normalize(path.join(PUBLIC_DIR,pathname));
  if(!full.startsWith(PUBLIC_DIR)) return false;
  try {
    const data=await fs.readFile(full);
    res.writeHead(200,{"content-type":mime[path.extname(full).toLowerCase()]||"application/octet-stream","cache-control":path.extname(full)===".html"?"no-cache":"public, max-age=300"});
    res.end(data); return true;
  } catch { return false; }
}

const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url||"/","http://localhost:"+PORT);
    if(req.method==="GET"&&url.pathname==="/api/health") {
      let ai={provider:"quackapi",configured:false,model:""};
      try { const cfg=await quackConfig(); ai={provider:"quackapi",configured:true,model:cfg.model}; } catch {}
      return json(res,200,{ok:true,service:"fc-musicas-personalizadas",ai,time:new Date().toISOString()});
    }
    if(req.method==="GET"&&url.pathname==="/api/config") return json(res,200,{brandName:BRAND_NAME,whatsappConfigured:Boolean(WHATSAPP_NUMBER),checkoutConfigured:Boolean(CHECKOUT_URL)});
    if(req.method==="POST"&&url.pathname==="/api/analytics"){
      const body=await readBody(req); const name=clean(body.event,50).replace(/[^a-z0-9_-]/gi,"");
      if(name) await event(name); return json(res,200,{ok:true});
    }
    if(req.method==="POST"&&url.pathname==="/api/lyrics/preview"){
      if(!allowed(req,"lyrics",8,600000)) return json(res,429,{error:"Muitas tentativas. Aguarde alguns minutos."});
      const a=normalizeAnswers(await readBody(req)); const missing=validateAnswers(a);
      if(missing.length) return json(res,400,{error:"Preencha: "+missing.join(", ")});
      try {
        const lyrics=await queuedAI(a);
        await event("lyrics_generated");
        return json(res,200,{lyrics,source:"quackapi"});
      } catch (error) {
        console.error("QuackAPI text generation failed", error?.message || error);
        return json(res,502,{error:"Não foi possível criar a letra agora. Tente novamente em alguns instantes."});
      }
    }
    if(req.method==="POST"&&url.pathname==="/api/orders"){
      if(!allowed(req,"orders",12,600000)) return json(res,429,{error:"Muitas tentativas. Aguarde alguns minutos."});
      const body=await readBody(req); const answers=normalizeAnswers(body.answers||{}); const missing=validateAnswers(answers);
      if(missing.length) return json(res,400,{error:"Dados incompletos"});
      const order={id:orderId(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:"novo",customer:{name:clean(body.customer?.name,100),whatsapp:clean(body.customer?.whatsapp,40)},answers,lyrics:clean(body.lyrics,12000),source:clean(body.source,40)};
      if(!order.customer.name||!order.customer.whatsapp) return json(res,400,{error:"Informe seu nome e WhatsApp."});
      const orders=await readJson(ORDERS_FILE,[]); orders.unshift(order); await writeJson(ORDERS_FILE,orders.slice(0,5000)); await event("order_created");
      const message=encodeURIComponent("Olá! Quero transformar esta letra em música cantada.\n\nPedido: "+order.id+"\nCliente: "+order.customer.name+"\nWhatsApp do cliente: "+order.customer.whatsapp+"\nAniversariante: "+answers.honoree+(answers.age?" ("+answers.age+" anos)":"")+"\nRelação: "+answers.relationship+"\nEstilo: "+answers.genre+"\nVoz: "+answers.voice+"\n\nLETRA GERADA:\n"+order.lyrics);
      const whatsappUrl=WHATSAPP_NUMBER?"https://wa.me/"+WHATSAPP_NUMBER+"?text="+message:"";
      return json(res,201,{ok:true,orderId:order.id,nextUrl:CHECKOUT_URL||whatsappUrl,checkoutConfigured:Boolean(CHECKOUT_URL),whatsappConfigured:Boolean(WHATSAPP_NUMBER)});
    }
    if(req.method==="GET"&&url.pathname==="/api/admin/orders"){
      if(!isAdmin(req,url)) return json(res,401,{error:"Não autorizado"});
      return json(res,200,{orders:await readJson(ORDERS_FILE,[]),analytics:await readJson(ANALYTICS_FILE,{})});
    }
    const patch=url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
    if(req.method==="PATCH"&&patch){
      if(!isAdmin(req,url)) return json(res,401,{error:"Não autorizado"});
      const body=await readBody(req); const status=clean(body.status,40);
      const valid=new Set(["novo","letra_aprovada","aguardando_pagamento","pago","produzindo","entregue","cancelado"]);
      if(!valid.has(status)) return json(res,400,{error:"Status inválido"});
      const orders=await readJson(ORDERS_FILE,[]); const order=orders.find(o=>o.id===patch[1]);
      if(!order) return json(res,404,{error:"Pedido não encontrado"});
      order.status=status; order.updatedAt=new Date().toISOString(); await writeJson(ORDERS_FILE,orders); return json(res,200,{ok:true,order});
    }
    if(await serveStatic(url,res)) return;
    return text(res,404,"Não encontrado");
  } catch(e) {
    console.error(e); return json(res,500,{error:e?.message||"Erro interno"});
  }
});
server.requestTimeout=240000;
server.listen(PORT,"127.0.0.1",()=>{
  console.log(`FC_MUSICAS_READY http://127.0.0.1:${PORT}`);
  console.log(`ADMIN http://127.0.0.1:${PORT}/admin`);
});
