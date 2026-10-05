import crypto from "node:crypto";
import { clean, json, normalizeAnswers, validateAnswers } from "../lib/quack.mjs";
import { dataApi } from "../lib/data.mjs";

function orderId() {
  return "FCM-" + new Date().toISOString().slice(2, 10).replaceAll("-", "") + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido" });

  const body = req.body || {};
  const answers = normalizeAnswers(body.answers || {});
  const missing = validateAnswers(answers);
  if (missing.length) return json(res, 400, { error: "Dados incompletos" });

  const customer = {
    name: clean(body.customer?.name, 100),
    whatsapp: clean(body.customer?.whatsapp, 40)
  };
  const lyrics = clean(body.lyrics, 12000);

  if (!customer.whatsapp) return json(res, 400, { error: "Informe seu WhatsApp." });
  if (!lyrics) return json(res, 400, { error: "Letra não encontrada." });

  const id = orderId();

  try {
    await dataApi("create_order", {
      order: {
        id,
        customer_name: customer.name,
        customer_whatsapp: customer.whatsapp,
        honoree: answers.honoree,
        age: answers.age,
        relationship: answers.relationship,
        qualities: answers.qualities,
        story: answers.story,
        genre: answers.genre,
        voice: answers.voice,
        special_message: answers.message,
        lyrics,
        source: clean(body.source, 80)
      }
    });
    await dataApi("event", { event: "order_created" }).catch(() => {});
  } catch (error) {
    console.error("order_persist_error", error?.message || error);
    return json(res, 502, { error: "Não foi possível salvar o pedido agora. Tente novamente." });
  }

  const number = (process.env.WHATSAPP_NUMBER || "5585992019111").replace(/\D/g, "");
  const message = encodeURIComponent(
    "Olá! Quero transformar esta letra em música cantada.\n\n" +
    "Pedido: " + id + "\n" +
    "Cliente: " + (customer.name || "Não informado") + "\n" +
    "WhatsApp do cliente: " + customer.whatsapp + "\n" +
    "Aniversariante: " + answers.honoree + (answers.age ? " (" + answers.age + " anos)" : "") + "\n" +
    "Relação: " + answers.relationship + "\n" +
    "Características: " + answers.qualities + "\n" +
    "História: " + answers.story + "\n" +
    "Estilo: " + answers.genre + "\n" +
    "Voz: " + answers.voice + "\n" +
    "Mensagem: " + answers.message + "\n\n" +
    "LETRA GERADA:\n" + lyrics
  );

  return json(res, 201, {
    ok: true,
    orderId: id,
    nextUrl: "https://wa.me/" + number + "?text=" + message,
    whatsappConfigured: true
  });
}
