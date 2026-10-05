import crypto from "node:crypto";
import { json } from "../../lib/quack.mjs";
import { dataApi } from "../../lib/data.mjs";

function authorized(req) {
  const expected = String(process.env.ADMIN_KEY || "");
  const actual = String(req.headers["x-admin-key"] || "");
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return expected.length >= 16 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!authorized(req)) return json(res, 401, { error: "Acesso não autorizado" });

  try {
    if (req.method === "GET") {
      const data = await dataApi("admin_list");
      return json(res, 200, data);
    }

    if (req.method === "PATCH") {
      const id = String(req.body?.id || "");
      const status = String(req.body?.status || "");
      if (!id || !status) return json(res, 400, { error: "Pedido e status são obrigatórios" });

      const data = await dataApi("update_status", { id, status });
      return json(res, 200, data);
    }

    return json(res, 405, { error: "Método não permitido" });
  } catch (error) {
    console.error("admin_api_error", error?.message || error);
    return json(res, 502, { error: "Não foi possível acessar os dados do painel." });
  }
}
