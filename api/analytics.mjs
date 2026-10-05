import { json } from "../lib/quack.mjs";
import { dataApi } from "../lib/data.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido" });
  const event = String(req.body?.event || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 50);
  if (!event) return json(res, 400, { error: "Evento inválido" });

  try {
    await dataApi("event", { event });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("analytics_error", error?.message || error);
    return json(res, 200, { ok: false });
  }
}
