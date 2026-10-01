// alma-alert/api/giro.js
// version: 0.1.0
//
// Il giro di ogni ora (vedi vercel.json e lib/giro.js).

import * as db from "../lib/db.js";
import { giro } from "../lib/giro.js";
import { autorizzato, primoAvvio, risposta } from "../lib/porta.js";

export default async function handler(req, res) {
  if (!db.configurato()) return risposta(res, 500, { errore: "Database non configurato: manca ALMA_DATABASE_URL." });
  const partito = Date.now();
  try {
    if (!autorizzato(req) && !(await primoAvvio(db))) return risposta(res, 401, { errore: "Token mancante o sbagliato." });
    const schema = await db.preparaSchema(db);
    // Vercel chiude la funzione a 300 secondi: il giro si ferma a 250 e il
    // resto lo fa il giro dopo.
    const esito = await giro(db, { scadenza: partito + 250000 });
    return risposta(res, 200, { ...schema, ...esito, durataMs: Date.now() - partito });
  } catch (e) {
    return risposta(res, 500, { errore: (e && e.message) || String(e), durataMs: Date.now() - partito });
  }
}
