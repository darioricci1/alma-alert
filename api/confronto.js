// alma-alert/api/confronto.js
// version: 0.1.0
//
// La prova del motore sul vero: prende le notizie che l'Apps Script del
// foglio ha gia' finito (stato «full_3.1», origine «foglio»), le rivaluta con
// lib/motore.js nelle stesse condizioni (col corpo salvato, o dal solo titolo
// quando il motivo dice [solo-titolo] o [corpo:ko]) e conta dove i due
// giudizi non coincidono. Solo col CRON_SECRET: e' un controllo, non una pagina.

import * as db from "../lib/db.js";
import { caricaMotore } from "../lib/giro.js";
import { valuta, STATO_FATTO } from "../lib/motore.js";
import { autorizzato, risposta } from "../lib/porta.js";

export default async function handler(req, res) {
  if (!autorizzato(req)) return risposta(res, 401, { errore: "Token mancante o sbagliato." });
  const quante = Math.min(Number(new URL(req.url, "http://x").searchParams.get("quante")) || 3000, 20000);
  try {
    const M = await caricaMotore(db);
    const righe = await db.query(
      `select a.titolo, a.url, a.score, a.rilevante, a.comune, a.tema, a.motivo, c.corpo, (c.url is not null) as in_cache
         from alert.articolo a left join alert.corpo c on c.url = a.url
        where a.origine = 'foglio' and a.stato = $1
        order by a.data_mail desc nulls last limit $2`, [STATO_FATTO, quante]);
    const conta = { righe: righe.length, score: 0, rilevante: 0, comune: 0, tema: 0, motivo: 0, tutto: 0 };
    const esempi = [];
    for (const a of righe) {
      const motivo = String(a.motivo || "");
      const tag = motivo.endsWith(" [solo-titolo]") ? " [solo-titolo]" : motivo.endsWith(" [corpo:ko]") && !a.in_cache ? " [corpo:ko]" : "";
      const r = valuta(a.titolo, a.url, a.in_cache ? a.corpo || "" : "", M, tag);
      const diversi = [];
      if (Number(r.score) !== Number(a.score)) diversi.push("score");
      if (Boolean(r.rilevante) !== Boolean(a.rilevante)) diversi.push("rilevante");
      if (String(r.comune || "") !== String(a.comune || "")) diversi.push("comune");
      if (String(r.tema || "") !== String(a.tema || "")) diversi.push("tema");
      if (r.motivo !== motivo) diversi.push("motivo");
      for (const d of diversi) conta[d]++;
      if (!diversi.length) conta.tutto++;
      else if (esempi.length < 25 && diversi.some((d) => d !== "motivo")) {
        esempi.push({ titolo: a.titolo, url: a.url, foglio: { score: a.score, rilevante: a.rilevante, comune: a.comune, tema: a.tema, motivo },
          qui: { score: r.score, rilevante: r.rilevante, comune: r.comune, tema: r.tema, motivo: r.motivo }, diversi });
      }
    }
    return risposta(res, 200, { ...conta, esempi });
  } catch (e) {
    return risposta(res, 500, { errore: (e && e.message) || String(e) });
  }
}
