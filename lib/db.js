// alma-alert/lib/db.js
// version: 0.1.0
//
// Il collegamento al database unico di Alma, lo stesso del gestionale. Come in
// gestionale-alma/lib/db.js: l'integrazione Neon di Vercel scrive piu' nomi a
// seconda del prefisso scelto, quindi si guardano in ordine.

import { Pool } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";

const NOMI = ["ALMA_DATABASE_URL", "DATABASE_URL", "ALMA_POSTGRES_URL", "POSTGRES_URL", "DATABASE_POSTGRES_URL"];

export function stringaDiConnessione(env = process.env) {
  for (const nome of NOMI) {
    const v = env[nome];
    if (v && v.trim()) return v.trim();
  }
  return null;
}

export const configurato = () => !!stringaDiConnessione();

let pool = null;
function piscina() {
  if (pool) return pool;
  const url = stringaDiConnessione();
  if (!url) throw new Error("Database non configurato: manca ALMA_DATABASE_URL (o DATABASE_URL) nelle variabili del progetto Vercel.");
  pool = new Pool({ connectionString: url });
  return pool;
}

export async function query(testo, valori = []) {
  return (await piscina().query(testo, valori)).rows;
}

/** Tutto o niente; il cliente risponde come query(), con le righe. */
export async function transazione(lavoro) {
  const vero = await piscina().connect();
  const cliente = { async query(testo, valori = []) { return (await vero.query(testo, valori)).rows; } };
  try {
    await vero.query("begin");
    const esito = await lavoro(cliente);
    await vero.query("commit");
    return esito;
  } catch (e) {
    await vero.query("rollback").catch(() => {});
    throw e;
  } finally {
    vero.release();
  }
}

/** La versione scritta in testa a schema.sql. */
export const versioneSchema = (testo) => (String(testo).match(/--\s*version:\s*([\d.]+)/) || [])[1] || "0";

/**
 * Crea o aggiorna lo schema `alert` se la versione scritta nel database non e'
 * quella del file. Ogni istruzione e' «if not exists»: rifarla non rompe
 * niente, ma costa, e con il controllo della versione la si fa una volta.
 */
export async function preparaSchema(db = { query, transazione }) {
  const testo = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
  const voluta = versioneSchema(testo);
  const [c] = await db.query(
    "select valore from alert.impostazione where chiave = 'schema'"
  ).catch(() => []);
  if (c && c.valore === voluta) return { schema: voluta, preparato: false };
  await db.transazione(async (t) => {
    await t.query(testo);
    await t.query(
      "insert into alert.impostazione (chiave, valore) values ('schema', $1) on conflict (chiave) do update set valore = excluded.valore",
      [voluta]);
  });
  return { schema: voluta, preparato: true };
}
