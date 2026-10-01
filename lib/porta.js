// alma-alert/lib/porta.js
// version: 0.1.0
//
// Chi puo' far partire un giro. Vercel, quando scatta il cron, manda
// `Authorization: Bearer <CRON_SECRET>`; una persona puo' aggiungere
// ?token=<CRON_SECRET>. Senza CRON_SECRET la porta resta chiusa, tranne al
// primo avvio: finche' nessun giro e' andato bene, il primo che arriva passa,
// come nelle notturne del gestionale. Si chiude da sola al primo giro riuscito.

import { timingSafeEqual } from "node:crypto";

function uguali(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

export function autorizzato(req, env = process.env) {
  const atteso = env.CRON_SECRET;
  if (!atteso) return false;
  const intest = String(req.headers?.authorization || "");
  if (intest.startsWith("Bearer ") && uguali(intest.slice(7), atteso)) return true;
  return uguali(new URL(req.url || "/", "http://x").searchParams.get("token"), atteso);
}

/** Vero finche' non c'e' un giro andato bene (o lo schema non c'e' ancora). */
export async function primoAvvio(db) {
  const r = await db.query("select 1 from alert.giro where esito = 'ok' limit 1").catch(() => []);
  return r.length === 0;
}

export function risposta(res, stato, corpo) {
  res.statusCode = stato;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}
