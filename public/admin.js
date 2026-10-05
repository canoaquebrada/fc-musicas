const $ = s => document.querySelector(s);

const labels = {
  novo: "Novo",
  letra_aprovada: "Letra aprovada",
  aguardando_pagamento: "Aguard. pagamento",
  pago: "Pago",
  produzindo: "Produzindo",
  entregue: "Entregue",
  cancelado: "Cancelado"
};

const statusOrder = ["novo","letra_aprovada","aguardando_pagamento","pago","produzindo","entregue","cancelado"];
let orders = [];
let analytics = {};
let activeKey = sessionStorage.getItem("fc_admin_key") || "";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function digits(s) {
  return String(s || "").replace(/\D/g, "");
}

function moneylessDate(value) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Fortaleza",
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  } catch { return value || "-"; }
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 2200);
}

function apiHeaders() {
  return { "content-type": "application/json", "x-admin-key": activeKey };
}

function showLogin(message = "") {
  $("#loginWrap").classList.remove("hidden");
  $("#dashboard").classList.add("hidden");
  $("#logout").classList.add("hidden");
  $("#refreshTop").classList.add("hidden");
  $("#loginError").textContent = message;
  setTimeout(() => $("#adminKey").focus(), 40);
}

function showDashboard() {
  $("#loginWrap").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  $("#logout").classList.remove("hidden");
  $("#refreshTop").classList.remove("hidden");
}

async function load() {
  try {
    const r = await fetch("/api/admin/orders", { headers: apiHeaders() });
    const data = await r.json();
    if (r.status === 401) {
      sessionStorage.removeItem("fc_admin_key");
      activeKey = "";
      return showLogin("Chave de acesso inválida.");
    }
    if (!r.ok) throw new Error(data.error || "Não foi possível carregar o painel.");

    orders = Array.isArray(data.orders) ? data.orders : [];
    analytics = data.analytics || {};
    showDashboard();
    renderAll();
  } catch (error) {
    toast(error.message || "Erro ao carregar painel.");
  }
}

function renderAll() {
  const visit = Number(analytics.visit || 0);
  const started = Number(analytics.quiz_started || 0);
  const q4 = Number(analytics.q4 || 0);
  const generated = Number(analytics.lyrics_generated || 0);
  const created = Number(analytics.order_created || orders.length || 0);
  const cta = Number(analytics.checkout_clicked || 0);

  const conv = visit ? ((created / visit) * 100).toFixed(1) : "0.0";
  const finishQuiz = started ? ((q4 / started) * 100).toFixed(1) : "0.0";

  const statItems = [
    ["Visitas", visit, "Total registrado"],
    ["Iniciaram", started, visit ? ((started/visit)*100).toFixed(1)+"% das visitas" : "0%"],
    ["Chegaram à 4ª", q4, finishQuiz+"% dos iniciados"],
    ["Letras geradas", generated, q4 ? ((generated/q4)*100).toFixed(1)+"% da etapa 4" : "0%"],
    ["Pedidos", created, conv+"% das visitas"],
    ["CTA WhatsApp", cta, created ? ((cta/created)*100).toFixed(1)+"% dos pedidos" : "0%"]
  ];
  $("#stats").innerHTML = statItems.map(([label,value,hint]) =>
    `<div class="stat"><b>${value}</b><span>${label}</span><small>${hint}</small></div>`
  ).join("");

  $("#funnel").innerHTML = [
    ["Visitas", visit],
    ["Início do quiz", started],
    ["Letra criada", generated],
    ["Pedido", created]
  ].map(([label,value]) => `<div><b>${value}</b><span>${label}</span></div>`).join("");

  const counts = Object.fromEntries(statusOrder.map(s => [s, orders.filter(o => o.status === s).length]));
  $("#statusSummary").innerHTML = statusOrder.map(s =>
    `<div class="status-chip"><span>${labels[s]}</span><b>${counts[s]}</b></div>`
  ).join("");

  $("#lastUpdate").textContent = "Atualizado em " + moneylessDate(new Date().toISOString());
  renderRows();
}

function filteredOrders() {
  const term = $("#search").value.trim().toLowerCase();
  const status = $("#statusFilter").value;
  return orders.filter(o => {
    if (status && o.status !== status) return false;
    if (!term) return true;
    return [
      o.id, o.customer_name, o.customer_whatsapp, o.honoree, o.genre, o.voice
    ].some(v => String(v || "").toLowerCase().includes(term));
  });
}

function renderRows() {
  const list = filteredOrders();
  $("#rows").innerHTML = list.map(o => {
    const wa = digits(o.customer_whatsapp);
    return `<tr>
      <td><span class="id">${esc(o.id)}</span><br><small class="muted">${esc(o.source || "")}</small></td>
      <td><b>${esc(o.customer_name || "Não informado")}</b><br><a class="wa-btn" target="_blank" rel="noopener" href="https://wa.me/55${wa.replace(/^55/,"")}">${esc(o.customer_whatsapp)}</a></td>
      <td><b>${esc(o.honoree)}</b><br><small class="muted">${esc(o.age ? o.age + " anos" : "")}</small></td>
      <td>${esc(o.genre || "-")}<br><small class="muted">${esc(o.voice || "-")}</small></td>
      <td class="nowrap">${moneylessDate(o.created_at)}</td>
      <td><select class="status" data-status-id="${esc(o.id)}">${statusOrder.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${labels[s]}</option>`).join("")}</select></td>
      <td><button class="smallbtn" data-view="${esc(o.id)}">Ver pedido</button></td>
    </tr>`;
  }).join("");

  $("#empty").classList.toggle("hidden", list.length > 0);
}

async function setStatus(id, status) {
  const r = await fetch("/api/admin/orders", {
    method: "PATCH",
    headers: apiHeaders(),
    body: JSON.stringify({ id, status })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Erro ao atualizar status.");

  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = status;
    order.updated_at = data.order?.updated_at || new Date().toISOString();
  }
  renderAll();
  toast("Status atualizado.");
}

function view(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  const wa = digits(o.customer_whatsapp);
  const message = encodeURIComponent("Olá! Estou falando sobre seu pedido " + o.id + " da música para " + o.honoree + ".");

  $("#detailBody").innerHTML = `
    <span class="eyebrow">${esc(o.id)}</span>
    <h2>${esc(o.honoree)}</h2>
    <div class="detail-meta">Criado em ${moneylessDate(o.created_at)} • Status: ${esc(labels[o.status] || o.status)}</div>

    <div class="answer-grid">
      <div class="answer"><b>Cliente</b>${esc(o.customer_name || "Não informado")}</div>
      <div class="answer"><b>WhatsApp</b>${esc(o.customer_whatsapp)}</div>
      <div class="answer"><b>Idade</b>${esc(o.age || "Não informada")}</div>
      <div class="answer"><b>Relação</b>${esc(o.relationship || "Não informada")}</div>
      <div class="answer"><b>Estilo</b>${esc(o.genre || "-")}</div>
      <div class="answer"><b>Voz</b>${esc(o.voice || "-")}</div>
      <div class="answer full"><b>Características</b>${esc(o.qualities || "-")}</div>
      <div class="answer full"><b>História</b>${esc(o.story || "-")}</div>
      <div class="answer full"><b>Mensagem especial</b>${esc(o.special_message || "-")}</div>
    </div>

    <h3>Letra gerada</h3>
    <div class="lyrics-box" id="detailLyrics">${esc(o.lyrics || "")}</div>
    <div class="detail-actions">
      <a class="primary-link" target="_blank" rel="noopener" href="https://wa.me/55${wa.replace(/^55/,"")}?text=${message}">Abrir WhatsApp</a>
      <button id="copyLyrics">Copiar letra</button>
      <button id="copyOrder">Copiar pedido</button>
    </div>
  `;

  $("#detail").showModal();

  $("#copyLyrics").onclick = async () => {
    await navigator.clipboard.writeText(o.lyrics || "");
    toast("Letra copiada.");
  };

  $("#copyOrder").onclick = async () => {
    const text = [
      "Pedido: " + o.id,
      "Cliente: " + (o.customer_name || "Não informado"),
      "WhatsApp: " + o.customer_whatsapp,
      "Aniversariante: " + o.honoree,
      "Estilo: " + (o.genre || "-"),
      "Voz: " + (o.voice || "-"),
      "",
      o.lyrics || ""
    ].join("\n");
    await navigator.clipboard.writeText(text);
    toast("Pedido copiado.");
  };
}

function exportCsv() {
  const list = filteredOrders();
  const header = ["pedido","data","status","cliente","whatsapp","aniversariante","idade","relacao","estilo","voz"];
  const rows = list.map(o => [
    o.id,o.created_at,o.status,o.customer_name||"",o.customer_whatsapp,o.honoree,o.age||"",o.relationship||"",o.genre||"",o.voice||""
  ]);
  const csv = [header, ...rows].map(row => row.map(v => '"' + String(v ?? "").replaceAll('"','""') + '"').join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fc-musicas-pedidos.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

$("#loginButton").addEventListener("click", async () => {
  activeKey = $("#adminKey").value.trim();
  if (!activeKey) return showLogin("Informe a chave de acesso.");
  sessionStorage.setItem("fc_admin_key", activeKey);
  $("#loginError").textContent = "";
  await load();
});
$("#adminKey").addEventListener("keydown", e => { if (e.key === "Enter") $("#loginButton").click(); });
$("#logout").addEventListener("click", () => {
  activeKey = "";
  sessionStorage.removeItem("fc_admin_key");
  $("#adminKey").value = "";
  showLogin();
});
$("#refreshTop").addEventListener("click", load);
$("#search").addEventListener("input", renderRows);
$("#statusFilter").addEventListener("change", renderRows);
$("#exportCsv").addEventListener("click", exportCsv);
$("#closeDetail").addEventListener("click", () => $("#detail").close());
$("#rows").addEventListener("click", e => {
  const button = e.target.closest("[data-view]");
  if (button) view(button.dataset.view);
});
$("#rows").addEventListener("change", async e => {
  if (!e.target.matches("[data-status-id]")) return;
  const id = e.target.dataset.statusId;
  try { await setStatus(id, e.target.value); }
  catch (error) { toast(error.message); await load(); }
});

if (activeKey) load(); else showLogin();
