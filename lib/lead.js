// alma-alert/lib/lead.js
// version: 0.1.0
//
// I Comuni caldi: una riga per comune, con l'articolo piu' recente, quanti
// articoli rilevanti, i destinatari e il testo della mail gia' scritto.
//
// E' riconciliaMailArticoli() di AlmaPipeline.gs v3.55.0, con le stesse regole:
//   - contano solo gli articoli rilevanti con un comune;
//   - un comune gia' contattato (MailCommerciali) prende i destinatari di
//     quella mail, e i suoi articoli si segnano «usato_outreach»;
//   - un comune che sta in un ente o un'unione dove ci sono gia' clienti
//     (Opportunita') prende 3 punti in piu', fino a 10, e chi non ha articoli
//     arriva almeno a 5;
//   - le PEC non vanno mai fra i destinatari: per una mail commerciale servono
//     indirizzi ordinari.
// Pura: le righe entrano, le righe da scrivere escono.

export const OPP_BONUS_SCORE = 3;
export const OPP_SCORE_BASE = 5;

export function normalizzaNome(s) {
  if (!s) return "";
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/['‘’`"]/g, "").replace(/[-]/g, " ").replace(/\s+/g, " ");
}

/** Gli indirizzi PEC, che per la posta commerciale non si usano. */
export function isPecLike(email) {
  return /pec|postacert|legalmail|pecpa|@pec|cert\.|\.cert|cert@|mailcert/i.test(String(email || ""));
}

/** «Nome <email>; ...» dai recapiti di una riga dei Comuni caldi. */
export function costruisciDestinatari(c) {
  if (!c) return "";
  const parti = [];
  const add = (email, nome) => {
    const e = String(email || "").trim();
    if (!e || e.startsWith("[pattern]") || isPecLike(e)) return;
    parti.push(nome ? `${nome} <${e}>` : `<${e}>`);
  };
  add(c.email_pl, c.nome_comandante_pl || "Comando PL");
  add(c.email_pl_2, "");
  add(c.email_sindaco, c.sindaco || "Sindaco");
  add(c.email_assessore, c.assessore_sicurezza_ambiente || "");
  return parti.join("; ");
}

/** Il saluto: il comandante se c'e' (e non e' «vacante»), se no il sindaco. */
export function saluto(c) {
  if (c) {
    const com = String(c.nome_comandante_pl || "").trim(), sind = String(c.sindaco || "").trim();
    if (com && !com.toLowerCase().includes("vacante")) return `Gentile Comandante ${com.split(" ").pop()},`;
    if (sind) return `Gentile Sindaco ${sind.split(" ").pop()},`;
  }
  return "Gentile Comando di Polizia Locale,";
}

/** Il testo della mail, con gli a capo, secondo il tema dell'ultimo articolo. */
export function generaTestoMail(comune, tema, urlArticolo, apertura) {
  const link = urlArticolo || "";
  const firma = "\n\nCordiali saluti,\n[Nome] - Alma Sicurezza\ntel. +39 051 ...\nm.masciantonio@almasicurezza.it\nwww.almasicurezza.it";
  const temiRif = ["rifiuti", "vandalismo"], temiZtl = ["varchi_ZTL", "bandi_gare"];
  let oggetto, corpo;
  if (temiZtl.includes(tema)) {
    oggetto = `Varchi e lettura targhe a ${comune}`;
    corpo = `${apertura}\n\nho letto del tema varchi/ZTL a ${comune}` + (link ? ` (${link})` : "") +
      `. Realizziamo sistemi di lettura targhe per il controllo accessi e le ZTL, integrati con la centrale operativa della Polizia Locale: accertamento automatico, riduzione del lavoro manuale, dati pronti per la sanzione.\n\nSiamo Alma Sicurezza (Bologna), specializzati in soluzioni per la PA, con oltre 90 Comuni serviti e conformità privacy con DPO dedicato.\n\nLe propongo una breve call per valutare la fattibilità sui varchi di ${comune}.` + firma;
  } else if (temiRif.includes(tema)) {
    oggetto = `Abbandoni a ${comune}: come altri Comuni li hanno azzerati`;
    corpo = `${apertura}\n\nho letto della questione rifiuti a ${comune}` + (link ? ` (${link})` : "") +
      `. È un problema che conosciamo bene: lavoriamo con oltre 90 Comuni italiani sul contrasto agli abbandoni con fototrappole e videosorveglianza mobile, che individuano il responsabile e producono prove utilizzabili per la sanzione.\n\nSiamo Alma Sicurezza, azienda di Bologna specializzata in videosorveglianza per la PA. I nostri impianti includono la videoanalisi che segnala in automatico l'abbandono nei punti critici, e la conformità privacy con DPO dedicato.\n\nLe farebbe piacere una call di 20 minuti per capire se ha senso un sopralluogo sui punti più colpiti?` + firma;
  } else {
    oggetto = `Sicurezza urbana a ${comune}: un confronto operativo`;
    corpo = `${apertura}\n\nho seguito quanto sta emergendo a ${comune} sul fronte sicurezza` + (link ? ` (${link})` : "") +
      `. Su questi temi affianchiamo oltre 90 Comuni con sistemi di videosorveglianza urbana integrati con videoanalisi intelligente: rilevamento di comportamenti anomali, supporto alle indagini, lettura targhe per i veicoli sospetti.\n\nSiamo Alma Sicurezza, di Bologna. Lavoriamo solo con enti pubblici, quindi conosciamo gare, capitolati e vincoli privacy, gestiti con DPO dedicato.\n\nLe va una call di 20 minuti per vedere quali interventi avrebbero più impatto sul territorio di ${comune}?` + firma;
  }
  return `OGGETTO: ${oggetto}\n\n${corpo}`;
}

/** Cerca per nome normalizzato, poi per inizio (come l'originale: «Reggio» trova «Reggio Emilia»). */
function trovaIn(mappa, nCom) {
  if (!nCom) return null;
  if (mappa.has(nCom)) return mappa.get(nCom);
  for (const [k, v] of mappa) if (nCom.startsWith(k) || k.startsWith(nCom)) return v;
  return null;
}

const giorno = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/**
 * Il giro dei Comuni caldi.
 *
 * @param articoli   [{ id, comune, rilevante, data_mail, data_estrazione, url, tema, score, usato_outreach }]
 * @param comuni     le righe di alert.comune_caldo (con chiave = normalizzaNome(comune))
 * @param mail       [{ comune, data_invio, destinatari }] da alert.mail_commerciale
 * @param opportunita [{ comune, ente, soci_clienti }]
 * @returns { aggiorna: [riga comune_caldo con solo le colonne calcolate], nuovi: [...], outreach: [id articolo] }
 */
export function comuniCaldi({ articoli = [], comuni = [], mail = [], opportunita = [] } = {}) {
  const oppMap = new Map();
  for (const o of opportunita) {
    const c = normalizzaNome(o.comune);
    if (c && !oppMap.has(c)) oppMap.set(c, { ente: String(o.ente || ""), soci: o.soci_clienti || 0 });
  }

  const contattati = new Map();
  for (const m of mail) {
    const com = normalizzaNome(m.comune);
    if (!com) continue;
    const d = m.data_invio ? new Date(m.data_invio) : null;
    const valida = d && !isNaN(d.getTime()) ? d : null;
    const dest = String(m.destinatari || "").replace(/[\r\n]+/g, " ").trim();
    if (!contattati.has(com)) contattati.set(com, { dataUltima: valida, dest });
    const e = contattati.get(com);
    if (valida && (!e.dataUltima || valida > e.dataUltima)) { e.dataUltima = valida; e.dest = dest; }
  }

  const perChiave = new Map();
  for (const c of comuni) { const n = c.chiave || normalizzaNome(c.comune); if (n && !perChiave.has(n)) perChiave.set(n, c); }

  const perComune = new Map(), outreach = [];
  for (const a of articoli) {
    if (!a.rilevante) continue;
    const com = String(a.comune || "").trim();
    const nCom = normalizzaNome(com);
    if (!nCom) continue;
    const d = a.data_mail || a.data_estrazione || null;
    const dataObj = d ? new Date(d) : null;
    if (!perComune.has(nCom)) {
      perComune.set(nCom, { com, ultimaData: dataObj, ultimaUrl: String(a.url || ""), ultimoTema: String(a.tema || ""), ultimoScore: a.score || 0, nArticoli: 0 });
    }
    const e = perComune.get(nCom);
    e.nArticoli++;
    if (dataObj && (!e.ultimaData || dataObj > e.ultimaData)) {
      e.ultimaData = dataObj; e.ultimaUrl = String(a.url || ""); e.ultimoTema = String(a.tema || ""); e.ultimoScore = a.score || 0;
    }
    if (trovaIn(contattati, nCom) && a.usato_outreach !== true) outreach.push(a.id);
  }

  const aggiorna = [], nuovi = [], toccate = new Set();
  for (const [nCom, e] of perComune) {
    const mailEntry = trovaIn(contattati, nCom);
    const contatto = trovaIn(perChiave, nCom);
    const destinatari = (mailEntry && mailEntry.dest) ? mailEntry.dest : costruisciDestinatari(contatto);
    const testoMail = generaTestoMail(e.com, e.ultimoTema, e.ultimaUrl, saluto(contatto));
    const opp = oppMap.get(nCom);
    let score = Number(e.ultimoScore) || 0;
    if (opp) score = Math.min(10, score + OPP_BONUS_SCORE);
    const riga = {
      chiave: nCom,
      score,
      n_art: e.nArticoli,
      tema: e.ultimoTema,
      url_migliore: e.ultimaUrl,
      data_ultimo_articolo: giorno(e.ultimaData),
      data_ultima_mail: mailEntry && mailEntry.dataUltima ? giorno(mailEntry.dataUltima) : null,
      destinatari,
      testo_mail: testoMail,
      opportunita_ente: opp ? `${opp.ente} (${opp.soci} soci clienti)` : null,
    };
    if (perChiave.has(nCom)) aggiorna.push(riga);
    else nuovi.push({ ...riga, comune: e.com, prov: contatto ? contatto.prov || null : null });
    toccate.add(nCom);
  }

  // Le opportunita' che sono gia' fra i comuni ma senza articoli: l'ente e lo
  // score di partenza.
  const soloOpportunita = [];
  for (const [nCom, opp] of oppMap) {
    if (!perChiave.has(nCom) || toccate.has(nCom)) continue;
    const c = perChiave.get(nCom);
    soloOpportunita.push({
      chiave: nCom,
      opportunita_ente: `${opp.ente} (${opp.soci} soci clienti)`,
      score: Math.max(Number(c.score) || 0, OPP_SCORE_BASE),
    });
  }
  return { aggiorna, nuovi, soloOpportunita, outreach };
}
