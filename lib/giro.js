// alma-alert/lib/giro.js
// version: 0.1.1
//
// Il giro di ogni ora, lo stesso di eseguiTutto() nell'Apps Script:
//   1. le notizie nuove dai feed dei Google Alert;
//   2. il primo giudizio sul titolo (stato «classified_kw»);
//   3. il corpo dell'articolo, scaricato finche' c'e' tempo, e il giudizio
//      definitivo (stato «full_3.1»);
//   4. i Comuni caldi.
//
// FINCHE' IL FOGLIO E' ACCESO comanda il foglio: l'Apps Script continua il
// suo lavoro e il gestionale ne importa il risultato ogni notte. Qui allora si
// lavorano solo le notizie arrivate dai feed (origine «rss») e i Comuni caldi
// non si toccano. Quando il foglio si spegne (pagina Fonti del gestionale),
// questo giro fa tutto. Due padroni per la stessa riga vorrebbe dire perdere
// ogni notte una modifica senza sapere quale.

import {
  preparaMotore, applicaRegole, valuta, dominioNoFetch, titoloHaSegnale, htmlToTesto,
  CORPO_MAX_CHAR, STATO_FATTO,
} from "./motore.js";
import { leggiFeed } from "./feed.js";
import { comuniCaldi } from "./lead.js";

export const COMUNI_JSON_URL = "https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json";

const NAVIGATORE = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9",
};

// Senza il carattere nullo (\u0000): Postgres lo rifiuta dentro un testo, e
// qualche pagina scaricata se lo porta dietro.
const json = (x) => JSON.stringify(x, (_k, v) => (typeof v === "string" ? v.replace(/\u0000/g, "").replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "\ufffd") : v));
const messaggio = (e) => (e && e.message) || String(e);

export async function impostazione(db, chiave, predefinito = null) {
  const [r] = await db.query("select valore from alert.impostazione where chiave = $1", [chiave]);
  return r ? r.valore : predefinito;
}

/** Il foglio e' acceso finche' nessuno l'ha spento dal gestionale. */
export const foglioAcceso = async (db) => (await impostazione(db, "foglio", "acceso")) !== "spento";

// ---------------------------------------------------------------------------
// 1. I feed
// ---------------------------------------------------------------------------

export async function raccogliFeed(db, { scarica = fetch } = {}) {
  const feed = await db.query("select id, url, nome from alert.feed where attivo order by id");
  let notizie = 0, nuove = 0, errori = 0;
  for (const f of feed) {
    try {
      const r = await scarica(f.url, { headers: NAVIGATORE, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error("il feed risponde " + r.status);
      const { ricerca, voci } = leggiFeed(await r.text());
      const righe = voci.map((v) => ({
        url: v.url, titolo: v.titolo, query_alert: ricerca || f.nome || null, data_mail: v.data, estratto: v.estratto,
      }));
      const inserite = righe.length ? await db.query(
        `insert into alert.articolo (url, titolo, query_alert, data_mail, estratto, origine)
         select url, titolo, query_alert, data_mail, estratto, 'rss'
           from json_populate_recordset(null::alert.articolo, $1::json)
         on conflict (url) do nothing returning id`, [json(righe)]) : [];
      notizie += voci.length;
      nuove += inserite.length;
      await db.query(
        "update alert.feed set ultimo_giro = now(), ultimo_esito = $2, nome = coalesce(nome, $3) where id = $1",
        [f.id, `${voci.length} notizie, ${inserite.length} nuove`, ricerca || null]);
    } catch (e) {
      errori++;
      await db.query("update alert.feed set ultimo_giro = now(), ultimo_esito = $2 where id = $1",
        [f.id, "errore: " + messaggio(e)]).catch(() => {});
    }
  }
  return { feed: feed.length, notizie, nuove, errori };
}

// ---------------------------------------------------------------------------
// 2. Il motore: parole chiave e anagrafe dei comuni dal database
// ---------------------------------------------------------------------------

async function scaricaComuni(db, scarica) {
  const r = await scarica(COMUNI_JSON_URL, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("l'anagrafe dei comuni non si scarica: " + r.status);
  const righe = (await r.json()).map((c, i) => ({ ordine: i + 1, nome: c.nome, sigla: c.sigla, popolazione: c.popolazione || 0 }));
  await db.query(
    `insert into alert.comune (ordine, nome, sigla, popolazione)
     select ordine, nome, sigla, popolazione from json_populate_recordset(null::alert.comune, $1::json)
     on conflict (ordine) do nothing`, [json(righe)]);
  return righe;
}

export async function caricaMotore(db, { scarica = fetch } = {}) {
  const celle = await db.query("select riga, colonna, valore from alert.parola_chiave");
  let griglia = null;
  if (celle.length) {
    griglia = [];
    for (const c of celle) { (griglia[c.riga] = griglia[c.riga] || [])[c.colonna] = c.valore; }
    for (let i = 0; i < griglia.length; i++) griglia[i] = griglia[i] || [];
  }
  let comuni = await db.query("select nome, sigla, popolazione from alert.comune order by ordine");
  if (!comuni.length) comuni = await scaricaComuni(db, scarica);
  return preparaMotore({ parole: griglia, comuni });
}

// ---------------------------------------------------------------------------
// 3. I giudizi
// ---------------------------------------------------------------------------

const campi = (r) => ({
  score: r.score, rilevante: r.rilevante, motivo: r.motivo, comune: r.comune, provincia: r.provincia,
  tema: r.tema, azione_suggerita: r.azione_suggerita,
  kw_attore: r.kw_attore, kw_soluzione: r.kw_soluzione, kw_intento: r.kw_intento,
});

async function scriviEsiti(db, esiti) {
  for (let i = 0; i < esiti.length; i += 1000) {
    await db.query(
      `update alert.articolo a set
         score = x.score, rilevante = x.rilevante, motivo = x.motivo, comune = x.comune,
         provincia = x.provincia, tema = x.tema, azione_suggerita = x.azione_suggerita,
         kw_attore = x.kw_attore, kw_soluzione = x.kw_soluzione, kw_intento = x.kw_intento,
         stato = x.stato, aggiornato_il = now()
       from json_populate_recordset(null::alert.articolo, $1::json) x
       where a.id = x.id`, [json(esiti.slice(i, i + 1000))]);
  }
}

export async function classificaTitoli(db, M, { soloOrigine = null, limite = 5000 } = {}) {
  const righe = await db.query(
    `select id, titolo, query_alert, url from alert.articolo
      where stato = 'nuovo' and ($2::text is null or origine = $2) order by id limit $1`, [limite, soloOrigine]);
  const esiti = righe.map((a) => ({ id: a.id, ...campi(applicaRegole(a.titolo, a.query_alert || "", a.url, M)), stato: "classified_kw" }));
  await scriviEsiti(db, esiti);
  return esiti.length;
}

async function scaricaCorpo(url, scarica) {
  try {
    const r = await scarica(url, { redirect: "follow", headers: NAVIGATORE, signal: AbortSignal.timeout(15000) });
    if (r.status !== 200) return null;
    return htmlToTesto(await r.text()).slice(0, CORPO_MAX_CHAR);
  } catch {
    return null;
  }
}

/**
 * Il corpo degli articoli non ancora alla versione del motore. Prima quelli
 * gia' scaricati (niente rete), poi i siti da non scaricare (social, sport:
 * giudizio sul solo titolo), poi si scarica: prima i titoli con un segnale,
 * a gruppi, finche' c'e' tempo. Quello che resta lo fa il giro dopo.
 */
export async function analizzaCorpi(db, M, { scadenza, scarica = fetch, soloOrigine = null, insieme = 6, limite = 600 } = {}) {
  const righe = await db.query(
    `select a.id, a.titolo, a.url, c.corpo, (c.url is not null) as in_cache
       from alert.articolo a left join alert.corpo c on c.url = a.url
      where a.stato <> $1 and a.stato <> 'nuovo' and ($3::text is null or a.origine = $3)
      order by a.data_mail desc nulls last, a.id desc limit $2`, [STATO_FATTO, limite, soloOrigine]);
  const subito = [], daScaricare = [];
  let daCache = 0, soloTitolo = 0;
  for (const a of righe) {
    if (a.in_cache) { daCache++; subito.push({ id: a.id, ...campi(valuta(a.titolo, a.url, a.corpo || "", M)), stato: STATO_FATTO }); }
    else if (dominioNoFetch(a.url)) { soloTitolo++; subito.push({ id: a.id, ...campi(valuta(a.titolo, a.url, "", M, " [solo-titolo]")), stato: STATO_FATTO }); }
    else daScaricare.push({ ...a, promette: titoloHaSegnale(a.titolo, M) });
  }
  await scriviEsiti(db, subito);
  // Prima i promettenti; a parita', l'ordine di data resta (sort stabile).
  daScaricare.sort((x, y) => Number(y.promette) - Number(x.promette));

  let i = 0, scaricati = 0, falliti = 0;
  while (i < daScaricare.length && Date.now() + 25000 < scadenza) {
    const gruppo = daScaricare.slice(i, i + insieme);
    i += gruppo.length;
    const corpi = await Promise.all(gruppo.map((a) => scaricaCorpo(a.url, scarica)));
    const nuovi = [], esiti = [];
    gruppo.forEach((a, j) => {
      const corpo = corpi[j];
      if (corpo === null) falliti++; else { scaricati++; nuovi.push({ url: a.url, corpo }); }
      esiti.push({ id: a.id, ...campi(valuta(a.titolo, a.url, corpo || "", M, corpo === null ? " [corpo:ko]" : "")), stato: STATO_FATTO });
    });
    if (nuovi.length) {
      await db.query(
        `insert into alert.corpo (url, corpo) select url, corpo from json_populate_recordset(null::alert.corpo, $1::json)
         on conflict (url) do update set corpo = excluded.corpo, scaricato_il = now()`, [json(nuovi)]);
    }
    await scriviEsiti(db, esiti);
  }
  return { daCache, soloTitolo, scaricati, falliti, rimasti: daScaricare.length - i };
}

// ---------------------------------------------------------------------------
// 4. I Comuni caldi
// ---------------------------------------------------------------------------

export async function aggiornaComuniCaldi(db) {
  const articoli = await db.query(
    `select id, comune, rilevante, data_mail, data_estrazione, url, tema, score, usato_outreach
       from alert.articolo where rilevante and coalesce(comune, '') <> ''`);
  const comuni = await db.query("select * from alert.comune_caldo");
  const mail = await db.query("select comune, data_invio, destinatari from alert.mail_commerciale");
  const opportunita = await db.query("select comune, ente, soci_clienti from alert.opportunita order by ordine");
  const { aggiorna, nuovi, soloOpportunita, outreach } = comuniCaldi({ articoli, comuni, mail, opportunita });

  await db.transazione(async (t) => {
    if (aggiorna.length) {
      await t.query(
        `update alert.comune_caldo c set
           score = x.score, n_art = x.n_art, tema = x.tema, url_migliore = x.url_migliore,
           data_ultimo_articolo = x.data_ultimo_articolo, data_ultima_mail = x.data_ultima_mail,
           destinatari = x.destinatari, testo_mail = x.testo_mail,
           opportunita_ente = coalesce(x.opportunita_ente, c.opportunita_ente), aggiornato_il = now()
         from json_populate_recordset(null::alert.comune_caldo, $1::json) x
         where c.chiave = x.chiave`, [json(aggiorna)]);
    }
    if (nuovi.length) {
      await t.query(
        `insert into alert.comune_caldo (chiave, comune, prov, score, n_art, tema, url_migliore, data_ultimo_articolo,
                                         data_ultima_mail, destinatari, testo_mail, opportunita_ente, origine)
         select chiave, comune, prov, score, n_art, tema, url_migliore, data_ultimo_articolo,
                data_ultima_mail, destinatari, testo_mail, opportunita_ente, 'alert'
           from json_populate_recordset(null::alert.comune_caldo, $1::json)
         on conflict (chiave) do nothing`, [json(nuovi)]);
    }
    if (soloOpportunita.length) {
      await t.query(
        `update alert.comune_caldo c set opportunita_ente = x.opportunita_ente, score = x.score, aggiornato_il = now()
           from json_populate_recordset(null::alert.comune_caldo, $1::json) x where c.chiave = x.chiave`,
        [json(soloOpportunita)]);
    }
    if (outreach.length) {
      await t.query("update alert.articolo set usato_outreach = true where id = any($1::bigint[])", [outreach]);
    }
  });
  return { aggiornati: aggiorna.length, nuovi: nuovi.length, opportunita: soloOpportunita.length, outreach: outreach.length };
}

// ---------------------------------------------------------------------------
// Il giro intero
// ---------------------------------------------------------------------------

/** Un passo che fallisce si scrive e non ferma gli altri. */
async function passo(dettagli, nome, lavoro) {
  try { dettagli[nome] = await lavoro(); } catch (e) { dettagli[nome] = { errore: messaggio(e) }; dettagli.errori = (dettagli.errori || 0) + 1; }
}

export async function giro(db, { scadenza = Date.now() + 240000, scarica = fetch } = {}) {
  const [g] = await db.query("insert into alert.giro (tipo) values ('giro') returning id");
  const d = {};
  const acceso = await foglioAcceso(db);
  d.foglio = acceso ? "acceso" : "spento";
  const soloOrigine = acceso ? "rss" : null;
  await passo(d, "feed", () => raccogliFeed(db, { scarica }));
  let M = null;
  await passo(d, "motore", async () => { M = await caricaMotore(db, { scarica }); return { comuni: M.G.gaz.size }; });
  if (M) {
    await passo(d, "titoli", () => classificaTitoli(db, M, { soloOrigine }));
    await passo(d, "corpi", () => analizzaCorpi(db, M, { scadenza, scarica, soloOrigine }));
  }
  if (!acceso) await passo(d, "comuniCaldi", () => aggiornaComuniCaldi(db));
  const esito = d.errori ? "errore" : "ok";
  await db.query("update alert.giro set finito_il = now(), esito = $2, dettagli = $3::jsonb where id = $1",
    [g.id, esito, json(d)]);
  return { esito, ...d };
}
