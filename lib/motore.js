// alma-alert/lib/motore.js
// version: 0.1.0
//
// Il motore che decide se una notizia e' un'occasione commerciale: le parole
// chiave per categoria, il comune citato, il punteggio da 0 a 10.
//
// E' il «motore 3.1» di AlmaPipeline.gs v3.55.0, l'Apps Script del foglio
// «Alma Alert Pipeline», portato funzione per funzione con gli stessi nomi.
// Le regole restano quelle: chi ha imparato a leggere il motivo di uno score
// nel foglio lo legge uguale qui. Una sola correzione voluta, segnata dove sta
// (la fauna, in calcolaPunteggio).
//
// Qui dentro non c'e' rete ne' database: le parole chiave e l'anagrafe dei
// comuni arrivano da fuori (preparaMotore), cosi' tutto si prova con i numeri.

export const MOTORE_VERSIONE = "3.1";
export const STATO_FATTO = "full_" + MOTORE_VERSIONE;
export const SOGLIA_GRANDE = 30000;
export const CORPO_MAX_CHAR = 1500;

// Le categorie come le scrive il codice. Il foglio ParoleChiave (oggi la tabella
// alert.parola_chiave) le sostituisce quando c'e': e' quello che il motore usa
// davvero, e ha pesi diversi da questi (PROB. SICUREZZA e PROB. RIFIUTI valgono 3).
export const CATEGORIE_PREDEFINITE = {
  attore: { peso: 3, kw: ["comune di", "comuni di", "comune", "comuni", "sindaco", "sindaca",
    "sindaci", "sindache", "assessore", "assessori", "assessora", "giunta",
    "polizia locale", "polizia municipale", "vigili urbani", "vigile urbano", "comandante", "comandanti",
    "carabinieri forestal", "forestale", "prefetto", "prefetti", "prefettura", "prefetture",
    "amministrazione comunal", "municipio", "municipi", "consiglio comunal", "consigli comunal",
    "ordinanza", "ordinanze", "delibera", "delibere", "deliberazion", "determina", "determine",
    "regolamento", "regolamenti", "ente local", "enti local", "operatori ecologici", "operatore ecologico",
    "gestore del servizio", "gestori del servizio", "gestore rifiuti", "gestori rifiuti"] },
  soluzione: { peso: 5, kw: ["videosorveglianza", "video sorveglianza", "telecamere", "telecamera",
    "videocamere", "videocamera", "fototrappol", "foto trappol", "cassonetti intelligenti", "cassonetto intelligente",
    "lettura targh", "lettura delle targh", "occhi elettronici", "occhio elettronico",
    "controllo del territorio", "sistema di videosorv", "sistemi di videosorv",
    "sistema di sorveglianza", "sistemi di sorveglianza", "impianto di videosorv", "impianti di videosorv",
    "rete di telecamere", "reti di telecamere", "varchi", "varco elettronico", "varchi elettronici",
    "sorveglianza", "videocontrollo", "monitoraggio", "controlli", "controllo",
    "deterrente", "deterrenti", "centrale operativa", "centrali operative", "sala operativa", "sale operative"] },
  intento: { peso: 4, kw: ["bando", "bandi", "gara d appalto", "gare d appalto", " appalto", " appalti",
    "pnrr", "finanziament", "fondi per", "fondi regional", "contributo", "contributi",
    "cofinanziament", "progetto esecutivo", "progetti esecutivi", "capitolato", "capitolati",
    "base d asta", "affidamento lavori", "affidamento servizi", "affidamento forniture",
    "affidamento diretto", "aggiudicazion", "avviso pubblico", "avvisi pubblici",
    "fornitura e posa", "posa in opera", "installazione", "installazioni",
    "installate", "installati", "installato", "installata", "installa",
    "nuove telecamere", "nuova telecamera", "nuovo sistema", "nuovi sistemi",
    "realizzazione", "realizzazioni", "potenziamento", "potenziamenti", "potenzia",
    "ammodernament", "approvato il progetto", "approvati i progetti", "investiment",
    "piano sicurezza", "piani sicurezza", "piano straordinario", "piani straordinari",
    "protocollo d intesa", "protocolli d intesa", "accordo", "accordi", "convenzione", "convenzioni",
    "rafforzamento", "rafforzamenti", "rafforzare", "attivat", "inaugurazion",
    "entrano in funzione", "entrata in funzione", "messi in funzione", "messa in funzione",
    "al via le telecamere", "al via il sistema", "dotare", "dotati", "dotata", "dotazione", "dotazioni",
    "verbali", "verbale", "multe", "multa", "sanzion", "contravvenzion",
    "denunce", "denuncia", "sequestri", "sequestro", "operazione", "operazioni"] },
  prob_sic: { peso: 4, kw: ["furti", "furto", "rapina", "rapine", "aggression", "spaccio",
    "criminalit", "microcriminalit", "baby gang", "risse", "rissa", "vandalism", "vandali", "vandalo",
    "atti vandalici", "atto vandalico", "danneggiament", "sicurezza urbana", "ordine pubblico",
    "degrado urbano", "degrado", "insicurezza", "sicurezza", "scippi", "scippo",
    "borseggi", "borseggio", "bivacchi", "bivacco", "schiamazzi", "schiamazzo",
    "movida", "occupazioni abusiv", "occupazione abusiv",
    "decoro urbano", "decoro", "presidio", "presidi", "pattugliament", "controllo di vicinato"] },
  prob_rif: { peso: 4, kw: ["rifiuti", "rifiuto", "immondizia", "spazzatura", "monnezza",
    "zozzeria", "zozzoni", "sporcizia", "abbandonat", "abbandono", "abbandona",
    "discarica", "discariche", "abusiva", "abusive", "abusivo", "abusivi",
    "rifiuti speciali", "rifiuto speciale", "illecito di rifiuti", "traffico illecito", "traffico di rifiuti",
    "conferiment", "rifiuti ingombranti", "rifiuto ingombrante", "sversament",
    "scarico abusivo", "scarichi abusivi", "microdiscarica", "microdiscariche",
    "cumuli", "cumulo", "tonnellate di rifiuti", "raccolta differenziata", "raccolta rifiuti",
    "cassonetti", "cassonetto", "degrado ambientale", "deiezioni", "deiezione",
    "eternit", "amianto", "bonifica", "bonifiche", "rimozione dei rifiuti", "rimozione rifiuti",
    "ecocentro", "ecocentri", "isola ecologica", "isole ecologiche",
    "centro di raccolta", "centri di raccolta", "smaltiment", "percolato"] },
  prob_idro: { peso: 2, kw: ["alluvione", "alluvioni", "allagament", "esondazione", "esondazioni",
    "dissesto idrogeologico", "frane", "frana", "corsi d acqua", "corso d acqua",
    "idrometric", "protezione civile", "rischio idraulic"] },
};

export const FAUNA_PREDEFINITA = ["lupo", "lupi", "orso", "orsi", "cinghial", "ungulat", "capriol", "cervo", "cervi",
  "daino", "daini", "fauna selvatica", "animali selvatici", "foca", "lince", "predator", "bracconagg"];

export const CRONACA_PREDEFINITA = ["ripres", "incastrat", "denunciat", "arrestat", "immortalat", "sgominat", "rubat",
  "ladr", "scipp", "aggredit", "aggression", "rissa", "accoltellat", "omicidi", "cadavere",
  "autopsia", "sequestrat", "spaccio", "truffa", "evaso", "fermati i responsabili", "individuati"];

/** Le intestazioni del foglio ParoleChiave e la categoria che ognuna riempie. */
export const PAROLECHIAVE_MAP = {
  "ATTORE": "attore", "SOLUZIONE": "soluzione", "INTENTO": "intento",
  "PROB. SICUREZZA": "prob_sic", "PROB. RIFIUTI": "prob_rif",
  "PROB. IDROGEOLOGICO": "prob_idro", "FAUNA": "_fauna", "CRONACA": "_cronaca",
};

export const PROVINCE_ESCLUSE = new Set([
  "AG", "CL", "CT", "EN", "ME", "PA", "RG", "SR", "TP",
  "CA", "CI", "MD", "NU", "OG", "OR", "OT", "SS", "SU", "VS",
]);

export const AMBIGUI = new Set(("sale mira bra cento mele sole sona sede arena prata prato rocca villa serra colle " +
  "monte sasso ponte dolo foro noto are atena bee cella dro este fara fino gera lu ne oggi orio pago " +
  "rho sava sori suni taio ula uri vado vas zoppola viale maglie alto carlino montagna resto bosco " +
  "strada centro nuovo nuova citta porto piazza chiesa torre forte ferro campo lago bagno terme " +
  "mezzo riva isola capo croce stella ello pieve borgo bene corte rosa fonte vita gioia pace pino " +
  "roe vico cura mura ora baia dosso era massa nave pera ruda sant santa san ville zona faiano " +
  "costa marina rio solaro vetta lido foce").split(" "));

export const DOMINI_TRAPPOLA = ["ilrestodelcarlino", "montagna", "lanazione", "ilgiorno", "larena", "lastampa",
  "milanofinanza", "ilsole24ore", "traderlink", "focus", "fanpage", "tgcom24", "corriere", "repubblica",
  "ilfatto", "pressreader", "treccani", "ilmeteo", "sport", "quotidiano"];

export const SUFFISSI_GIORNALE = ["tomorrow", "today", "news", "oggi", "cronaca", "quotidiano", "informa",
  "notizie", "press", "online", "post", "web", "tv", "sera", "24", "point", "time", "tg"];

export const PREFISSI_GIORNALE = ["tele", "radio", "web", "news", "info"];

export const DOMINI_NO_FETCH = [
  "facebook.com", "instagram.com", "twitter.com", "x.com", "youtube.com", "tiktok.com",
  "linkedin.com", "pinterest.", "amazon.", "ebay.", "aliexpress.",
  "hdblog.it", "mistergadget.tech", "techprincess.it", "yourlifeupdated.net",
  "ceotech.it", "tomshw.it", "tuttoandroid.net", "androidworld.it",
  "msn.com", "pressreader.com", "dailymotion.com", "ipsoa.it", "siciliaweb.it", "laziotv.it",
  "sport.sky.it", "tg24.sky.it", "gazzetta.it", "mediasetinfinity.mediaset.it",
  "sportmediaset.mediaset.it", "raiplay.it", "raisport.", "olympics.com", "la7.it",
  "rsi.ch", "dazn.com", "eurosport.", "onefootball.com", "tuttomercatoweb.com",
  "calciomercato.com", "sport.tiscali.it",
];

const TLD_ESTERI = /\.(mk|rs|hr|si|ba|me|al|bg|ro|hu|sk|cz|pl|de|fr|es|pt|nl|be|at|ch|uk|gb|us|ca|au|nz|br|ar|mx|jp|cn|ru|ua|tr|il|ae|sa)\//i;

export const urlEstero = (url) => TLD_ESTERI.test(String(url || ""));

export function dominioNoFetch(url) {
  const u = String(url || "").toLowerCase();
  return DOMINI_NO_FETCH.some((d) => u.indexOf(d) >= 0);
}

export function normNome(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/'/g, " ").replace(/-/g, " ").replace(/\s+/g, " ");
}

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function paroleCapitalizzate(titolo) {
  const out = new Set();
  String(titolo || "").split(/\s+/).forEach((tok) => {
    const clean = tok.replace(/[^A-Za-zÀ-ÿ']/g, "");
    if (clean && clean.charAt(0) === clean.charAt(0).toUpperCase() && clean.charAt(0) !== clean.charAt(0).toLowerCase()) {
      out.add(normNome(clean));
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Preparazione: parole chiave e anagrafe dei comuni
// ---------------------------------------------------------------------------

/**
 * Le categorie da una griglia nel formato del foglio ParoleChiave: prima riga
 * i titoli, seconda i pesi («Peso: 5 — il più alto»), poi le parole in colonna.
 * Una colonna vuota lascia la categoria com'e' nel codice, come faceva
 * caricaCategorieDAFoglio().
 */
export function categorieDaGriglia(griglia) {
  const categorie = JSON.parse(JSON.stringify(CATEGORIE_PREDEFINITE));
  let fauna = [...FAUNA_PREDEFINITA], cronaca = [...CRONACA_PREDEFINITA];
  if (!griglia || griglia.length < 3) return { categorie, fauna, cronaca };
  const titoli = griglia[0] || [], pesi = griglia[1] || [];
  const nCols = Math.max(...griglia.map((r) => (r || []).length));
  for (let c = 0; c < nCols; c++) {
    const chiave = PAROLECHIAVE_MAP[String(titoli[c] || "").toUpperCase().trim()];
    if (!chiave) continue;
    const kws = [];
    for (let r = 2; r < griglia.length; r++) {
      const v = String((griglia[r] || [])[c] || "").replace(/◆.*$/, "").trim();
      if (v) kws.push(v.toLowerCase());
    }
    if (!kws.length) continue;
    if (chiave === "_fauna") fauna = kws;
    else if (chiave === "_cronaca") cronaca = kws;
    else if (categorie[chiave]) {
      const pm = String(pesi[c] || "").match(/\d+/);
      if (pm) categorie[chiave].peso = parseInt(pm[0], 10);
      categorie[chiave].kw = kws;
    }
  }
  return { categorie, fauna, cronaca };
}

/**
 * L'anagrafe dei comuni nelle tre forme che servono al motore. `righe` sono
 * {nome, sigla, popolazione} NELL'ORDINE del foglio «Popolazione Comuni»:
 * a parita' di nome vince l'ultimo, come nella Map dell'originale.
 */
export function gazetteer(righe) {
  const gaz = new Map(), grandi = [], joinMap = new Map();
  for (const r of righe || []) {
    const nome = r.nome;
    if (!nome) continue;
    const sigla = r.sigla || "", pop = Number(r.popolazione) || 0, nn = normNome(nome);
    gaz.set(nn, { nome, sigla, pop });
    if (pop >= SOGLIA_GRANDE && !AMBIGUI.has(nn) && nn.length >= 4) grandi.push({ nn, nome, sigla, pop });
    if (nn.length >= 4) joinMap.set(nn.replace(/ /g, ""), nn);
  }
  grandi.sort((a, b) => b.pop - a.pop);
  return { gaz, grandi, joinMap };
}

/** Tutto quello che il motore usa, pronto: regex compilate una volta sola. */
export function preparaMotore({ parole = null, comuni = [] } = {}) {
  const { categorie, fauna, cronaca } = categorieDaGriglia(parole);
  const CR = {};
  for (const cat in categorie) {
    CR[cat] = {
      peso: categorie[cat].peso,
      re: categorie[cat].kw.map((k) => new RegExp("\\b" + escapeRe(k.trim()))),
      kw: categorie[cat].kw.map((k) => k.trim()),
    };
  }
  return {
    CR,
    faunaRe: fauna.map((k) => new RegExp("\\b" + escapeRe(k))),
    cronacaRe: cronaca.map((k) => new RegExp("\\b" + escapeRe(k))),
    G: gazetteer(comuni),
  };
}

// ---------------------------------------------------------------------------
// Il comune citato
// ---------------------------------------------------------------------------

export function estraiComuneSmart(titolo, url, G) {
  const t = " " + normNome(titolo) + " ";
  const capSet = paroleCapitalizzate(titolo);
  const m = t.match(/^\s*([a-z][a-z\s]+?)\s*[,:]/);
  if (m) { const c = m[1].trim(); if (G.gaz.has(c) && !AMBIGUI.has(c)) return G.gaz.get(c); }
  let re = /comune di ([a-z\s]+?)[\s,:.]/g, mm;
  while ((mm = re.exec(t)) !== null) {
    const parts = mm[1].trim().split(" ");
    for (let k = Math.min(3, parts.length); k >= 1; k--) { const sub = parts.slice(0, k).join(" "); if (G.gaz.has(sub)) return G.gaz.get(sub); }
  }
  re = /\ba ([a-z\s]+?)[\s,:.]/g;
  while ((mm = re.exec(t)) !== null) {
    const parts = mm[1].trim().split(" ");
    for (let k = Math.min(3, parts.length); k >= 1; k--) {
      const sub = parts.slice(0, k).join(" ");
      if (G.gaz.has(sub) && !AMBIGUI.has(sub) && capSet.has(sub.split(" ")[0])) return G.gaz.get(sub);
    }
  }
  for (const g of G.grandi) {
    const reN = new RegExp("\\b" + escapeRe(g.nn) + "\\b");
    if (reN.test(t) && capSet.has(g.nn.split(" ")[0])) return { nome: g.nome, sigla: g.sigla, pop: g.pop };
  }
  // Comuni piccoli citati ovunque nel titolo: una parola con l'iniziale
  // maiuscola (almeno 4 lettere, non ambigua) che sia un Comune in anagrafe.
  for (const w of capSet) {
    if (w.length >= 4 && !AMBIGUI.has(w) && G.gaz.has(w)) return G.gaz.get(w);
  }
  const dm = (url || "").toLowerCase().match(/https?:\/\/([^/]+)/);
  if (dm) {
    const host = dm[1].replace(/^www\./, "");
    // Siti ufficiali come comune.<nome>.it: il nome del Comune e' il secondo livello.
    const parti = host.split(".");
    if (parti.length >= 2 && ["comune", "comuni", "citta", "city", "cittadi", "comunedi"].indexOf(normNome(parti[0]).replace(/ /g, "")) !== -1) {
      const cand = normNome(parti[1]).replace(/ /g, "");
      if (G.gaz.has(cand) && !AMBIGUI.has(cand)) return G.gaz.get(cand);
      if (G.joinMap.has(cand) && !AMBIGUI.has(G.joinMap.get(cand))) return G.gaz.get(G.joinMap.get(cand));
    }
    const primo = host.split(".")[0], dom = normNome(primo).replace(/ /g, "");
    if (dom && !DOMINI_TRAPPOLA.some((tr) => dom === tr || dom.indexOf(tr) === 0)) {
      for (const suf of SUFFISSI_GIORNALE) {
        if (dom.length > suf.length && dom.endsWith(suf)) {
          const pref = dom.slice(0, -suf.length);
          if (G.joinMap.has(pref)) return G.gaz.get(G.joinMap.get(pref));
        }
      }
      for (let L = Math.min(dom.length, 20); L >= 5; L--) {
        const pref = dom.substring(0, L);
        if (G.joinMap.has(pref) && !AMBIGUI.has(G.joinMap.get(pref))) return G.gaz.get(G.joinMap.get(pref));
      }
      for (const pre of PREFISSI_GIORNALE) {
        if (dom.startsWith(pre) && dom.length > pre.length) {
          const resto = dom.slice(pre.length);
          for (let L = Math.min(resto.length, 20); L >= 3; L--) {
            const sub = resto.substring(0, L);
            if (G.joinMap.has(sub) && !AMBIGUI.has(G.joinMap.get(sub))) return G.gaz.get(G.joinMap.get(sub));
          }
        }
      }
    }
  }
  return null;
}

export function estraiComuneDaTesto(testo, G) {
  const t = " " + normNome(testo) + " ";
  const capSet = paroleCapitalizzate(testo);
  const re = /comune di ([a-z\s]+?)[\s,:.]/g;
  let mm;
  while ((mm = re.exec(t)) !== null) {
    const parts = mm[1].trim().split(" ");
    for (let k = Math.min(3, parts.length); k >= 1; k--) { const sub = parts.slice(0, k).join(" "); if (G.gaz.has(sub)) return G.gaz.get(sub); }
  }
  for (const pat of [/\ba ([a-z\s]+?)[\s,:.]/g, /\bdi ([a-z\s]+?)[\s,:.]/g]) {
    while ((mm = pat.exec(t)) !== null) {
      const parts = mm[1].trim().split(" ");
      for (let k = Math.min(3, parts.length); k >= 1; k--) {
        const sub = parts.slice(0, k).join(" ");
        if (G.gaz.has(sub) && !AMBIGUI.has(sub) && capSet.has(sub.split(" ")[0])) return G.gaz.get(sub);
      }
    }
  }
  let best = null, bestCount = 0;
  for (const g of G.grandi) {
    if (!capSet.has(g.nn.split(" ")[0])) continue;
    const found = t.match(new RegExp("\\b" + escapeRe(g.nn) + "\\b", "g"));
    if (found && found.length > bestCount) { bestCount = found.length; best = { nome: g.nome, sigla: g.sigla }; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Il punteggio
// ---------------------------------------------------------------------------

export function mkResult(score, rilevante, tipoLead, motivo, comune, provincia, tema, kwAttore, kwSoluzione, kwIntento) {
  let azione;
  if (rilevante) azione = comune ? `Contattare sindaco e PL di ${comune}${provincia ? " (" + provincia + ")" : ""}` : "Identificare Comune e contattare PL";
  else if (score >= 4) azione = "Da rivedere manualmente";
  else azione = "Ignorare";
  return {
    score, rilevante, motivo, comune: comune || null, provincia: provincia || "", tema,
    azione_suggerita: azione, kw_attore: kwAttore || "", kw_soluzione: kwSoluzione || "", kw_intento: kwIntento || "",
  };
}

/**
 * Score, rilevanza, motivo e tema. Il cancello e' uno solo: rilevante vuol
 * dire un segnale commerciale (una soluzione, un intento d'acquisto, o un ente
 * con un problema) piu' un comune, e niente off-topic o fauna. La cronaca
 * declassa solo se manca ogni altro segnale.
 */
export function calcolaPunteggio(testo, comuneInfo, M, soloTitolo) {
  const text = String(testo || "").toLowerCase();
  const comune = comuneInfo ? comuneInfo.nome : null;
  const provincia = comuneInfo ? comuneInfo.sigla : "";
  const pop = comuneInfo && comuneInfo.pop ? comuneInfo.pop : 0;
  const popTxt = pop ? (pop >= 1000 ? Math.round(pop / 1000) + "k" : pop + " ab") : "";

  if (provincia && PROVINCE_ESCLUSE.has(provincia.toUpperCase())) {
    return mkResult(0, false, "no", "[fuori-zona] " + (comune || provincia) + (popTxt ? " · " + popTxt : ""), comune, provincia, "altro", "", "", "");
  }

  let score = 0;
  const cats = new Set(), hit = {};
  for (const cat in M.CR) {
    const re = M.CR[cat].re;
    for (let k = 0; k < re.length; k++) {
      if (re[k].test(text)) { score += M.CR[cat].peso; cats.add(cat); hit[cat] = M.CR[cat].kw[k]; break; }
    }
  }
  if (cats.size >= 2) score += 3;
  if (cats.size >= 3) score += 2;
  if (cats.has("attore") && cats.has("soluzione")) score += 3;
  if (comune) score += 2; else score -= 2;

  // Corretto rispetto all'originale, che qui passava gli argomenti spostati di
  // uno: il motivo diventava il nome del comune e il comune la provincia.
  if (M.faunaRe.some((r) => r.test(text))) {
    return mkResult(Math.min(2, Math.max(0, score)), false, "no", "[fauna] fauna selvatica (no lead)", comune, provincia, "altro", "", "", "");
  }

  const sc = Math.max(0, Math.min(10, score));

  const offTopic = /\bdash.?cam\b|\baction.?cam\b|\bgopro\b|\bserie\s+[a-z]\b|\bplayoff\b|\bcampionato\b|\bstadio\b|\bpartita\b|\btifosi\b|\bmasterchef\b|\bnetflix\b|\bformula\s*1\b|\bmotogp\b/i.test(text)
    && !cats.has("attore");

  const problema = cats.has("prob_sic") || cats.has("prob_rif") || cats.has("prob_idro");
  const cronaca = M.cronacaRe.some((r) => r.test(text));
  const haSegnale = cats.has("soluzione") || cats.has("intento") || (cats.has("attore") && problema);

  let rilevante, comuneDaVerificare = false;
  if (offTopic || !haSegnale) {
    rilevante = false;
  } else if (!comune) {
    if (soloTitolo) { rilevante = true; comuneDaVerificare = true; } else rilevante = false;
  } else if (cronaca && !cats.has("intento") && !cats.has("attore") && !cats.has("soluzione")) {
    rilevante = false;
  } else {
    rilevante = true;
  }

  let tema = "altro";
  if (cats.has("soluzione") || cats.has("intento")) tema = "bandi_gare";
  if (cats.has("prob_idro")) tema = "idrogeologico";
  if (cats.has("prob_rif")) tema = "rifiuti";
  if (cats.has("prob_sic")) tema = "sicurezza_urbana";
  if (/\bvandal/.test(text)) tema = "vandalismo";
  if (/\bztl\b|\bvarco|\btargh/.test(text)) tema = "varchi_ZTL";

  const dettaglio = Array.from(cats).map((c) => c + "(" + hit[c] + ")").join("+");
  let tag = "";
  if (!rilevante) {
    if (offTopic) tag = "[off-topic] ";
    else if (cronaca) tag = "[cronaca] ";
    else if (cats.size === 0) tag = "[nessun segnale] ";
    else if (!comune) tag = "[manca comune] ";
    else if (!haSegnale) tag = "[manca segnale: serve soluzione, intento, o ente+problema] ";
    else tag = "[debole] ";
  } else if (comuneDaVerificare) {
    tag = "[comune?] ";
  }
  const motivo = tag + dettaglio + (comune ? " [" + comune + (popTxt ? " · " + popTxt : "") + "]" : "");
  return mkResult(sc, rilevante, rilevante ? "lead" : "no", motivo, comune, provincia, tema,
    hit.attore || "", hit.soluzione || "", hit.intento || "");
}

export function titoloHaSegnale(testo, M) {
  const text = String(testo || "").toLowerCase();
  for (const cat in M.CR) for (const r of M.CR[cat].re) if (r.test(text)) return true;
  return false;
}

/** Il primo passo, sul titolo e sulla ricerca del Google Alert. */
export function applicaRegole(titolo, queryAlert, url, M) {
  if (urlEstero(url)) return mkResult(0, false, "no", "[off-topic] url estero", null, "", "altro", "", "", "");
  const comuneInfo = estraiComuneSmart(titolo, url, M.G);
  return calcolaPunteggio(titolo + " " + queryAlert, comuneInfo, M, true);
}

/**
 * Il secondo passo, col corpo dell'articolo quando c'e'. Il corpo puo' solo
 * aggiungere informazione: si tiene il migliore fra titolo e titolo+corpo, e
 * il corpo non abbassa mai la rilevanza del titolo. Torna il risultato col
 * motivo gia' completo del suo segno ([corpo:ko], [solo-titolo]).
 */
export function valuta(titolo, url, corpo, M, tag = "") {
  if (urlEstero(url)) return mkResult(0, false, "no", "[off-topic] url estero", null, "", "altro", "", "", "");
  const comuneTit = estraiComuneSmart(titolo, url, M.G);
  const rTit = calcolaPunteggio(titolo, comuneTit, M, true);
  let r = rTit;
  let tagFinale = tag || "";
  if (corpo && corpoUtile(corpo)) {
    const comuneFull = comuneTit || estraiComuneDaTesto(corpo, M.G);
    const rFull = calcolaPunteggio(titolo + " " + corpo, comuneFull, M, false);
    if ((rFull.score > rTit.score && (rFull.rilevante || !rTit.rilevante)) || (!rTit.rilevante && rFull.rilevante)) r = rFull;
  } else if (corpo && !tagFinale) {
    // Scaricato ma inservibile (CSS, paywall, abstract tronco): si e' deciso
    // sul solo titolo, e il motivo lo dice.
    tagFinale = " [corpo:ko]";
  }
  return { ...r, motivo: r.motivo + tagFinale };
}

// ---------------------------------------------------------------------------
// Il corpo dell'articolo
// ---------------------------------------------------------------------------

/** Un corpo serve se, tolte le parole di navigazione, restano piu' di 200 caratteri. */
export function corpoUtile(corpo) {
  if (!corpo) return false;
  const pulito = String(corpo)
    .replace(/\b(home|news|cronaca|sport|notizie|menu|cerca|accedi|abbonati|iscriviti|registrati|contatti|redazione|economia|cultura|politica|eventi|privacy|cookie|newsletter|seguici|condividi|commenti|leggi|articolo|pubblicit)\b/gi, "")
    .replace(/[{}();:.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return pulito.length > 200;
}

export function htmlToTesto(html) {
  let h = String(html || "").substring(0, 120000);
  h = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/@[a-z-]+[^{]*\{[\s\S]*?\}/gi, " ").replace(/[^{}<>]*\{[^{}]*\}/g, " ");
  const semantici = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*\b(article|articolo|content|contenuto|testo|body|post|entry|notizia|news)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*\b(article|articolo|content|contenuto|testo|body|post|entry)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  for (const re of semantici) {
    const m = h.match(re);
    if (m) { const e = m[m.length - 1]; if (e && e.length > 300) { h = e; break; } }
  }
  h = h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
  const paywallRe = /\b(abbonament|consentless|consenso ai cookie|accedi per leggere|piano di abbonamento|iscriviti|registrati per|contenuto riservato|articolo riservato|solo per abbonati|sblocca l.articolo|continua a leggere|leggi l.articolo completo)\b/gi;
  if ((h.match(paywallRe) || []).length >= 2) return "";
  return h.substring(0, 6000);
}
