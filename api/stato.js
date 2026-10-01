// alma-alert/api/stato.js
// version: 0.1.0
//
// A che punto e' la pipeline, in numeri. Niente nomi, niente recapiti: quelli
// stanno nel gestionale, dietro l'accesso.

import * as db from "../lib/db.js";
import { risposta } from "../lib/porta.js";
import { STATO_FATTO, MOTORE_VERSIONE } from "../lib/motore.js";
import { foglioAcceso } from "../lib/giro.js";

export default async function handler(req, res) {
  if (!db.configurato()) return risposta(res, 200, { pronto: false, motivo: "database non collegato" });
  try {
    const [a] = await db.query(
      `select count(*)::int as articoli, count(*) filter (where rilevante)::int as rilevanti,
              count(*) filter (where stato <> $1)::int as da_elaborare, max(data_mail) as ultima_notizia
         from alert.articolo`, [STATO_FATTO]);
    const [c] = await db.query("select count(*)::int as comuni_caldi from alert.comune_caldo");
    const [f] = await db.query("select count(*) filter (where attivo)::int as feed_attivi from alert.feed");
    const [g] = await db.query("select iniziato_il, finito_il, esito from alert.giro where tipo = 'giro' order by id desc limit 1");
    return risposta(res, 200, {
      pronto: true, motore: MOTORE_VERSIONE, foglio: (await foglioAcceso(db)) ? "acceso" : "spento",
      ...a, ...c, ...f, ultimoGiro: g || null,
    });
  } catch {
    return risposta(res, 200, { pronto: false, motivo: "lo schema alert non c'e' ancora: lo crea il primo giro" });
  }
}
