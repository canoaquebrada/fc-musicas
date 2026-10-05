export async function dataApi(action, payload = {}) {
  const url = process.env.FC_DATA_API_URL || "";
  const secret = process.env.FC_DATA_API_SECRET || "";
  if (!url || !secret) throw new Error("Banco administrativo não configurado");

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fc-secret": secret
    },
    body: JSON.stringify({ action, ...payload })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || ("Data API HTTP " + r.status));
  return data;
}
