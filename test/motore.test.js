import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preparaMotore, applicaRegole, valuta, estraiComuneSmart, categorieDaGriglia, htmlToTesto, corpoUtile,
  normNome, dominioNoFetch,
} from "../lib/motore.js";

const COMUNI = [
  { nome: "Bologna", sigla: "BO", popolazione: 390000 },
  { nome: "Forlì", sigla: "FC", popolazione: 118000 },
  { nome: "Montagano", sigla: "CB", popolazione: 1100 },
  { nome: "Palermo", sigla: "PA", popolazione: 630000 },
  { nome: "Prato", sigla: "PO", popolazione: 195000 },
  { nome: "Reggio nell'Emilia", sigla: "RE", popolazione: 170000 },
];
const M = preparaMotore({ comuni: COMUNI });

test("un comune con telecamere contro gli abbandoni e' un lead", () => {
  const r = applicaRegole("Forlì, nuove telecamere contro l'abbandono dei rifiuti", "abbandono rifiuti", "https://www.ilrestodelcarlino.it/x", M);
  assert.equal(r.comune, "Forlì");
  assert.equal(r.rilevante, true);
  assert.equal(r.score, 10);
  assert.equal(r.tema, "rifiuti");
  assert.match(r.motivo, /^soluzione\(telecamere\)\+intento\(nuove telecamere\)\+prob_rif\(rifiuti\) \[Forlì · 118k\]$/);
  assert.equal(r.azione_suggerita, "Contattare sindaco e PL di Forlì (FC)");
});

test("fuori zona, fauna, estero e cronaca si scartano col loro segno", () => {
  assert.match(applicaRegole("Palermo, il sindaco installa telecamere", "", "https://x.it/a", M).motivo, /^\[fuori-zona\] Palermo/);
  const lupi = applicaRegole("Bologna, lupi avvistati: il sindaco installa telecamere", "", "https://x.it/a", M);
  assert.equal(lupi.rilevante, false);
  assert.equal(lupi.comune, "Bologna", "l'originale qui spostava gli argomenti: ora il comune resta il comune");
  assert.match(lupi.motivo, /^\[fauna\]/);
  assert.ok(lupi.score <= 2);
  assert.match(applicaRegole("Nuove telecamere a Bologna", "", "https://news.example.de/a", M).motivo, /url estero/);
  const cronaca = applicaRegole("Bologna, ladro ripreso mentre scappa con la refurtiva", "", "https://x.it/a", M);
  assert.equal(cronaca.rilevante, false);
});

test("il comune si riconosce anche dal sito: comune.<nome>.it e <nome>today", () => {
  assert.equal(estraiComuneSmart("Nuove regole per la raccolta", "https://www.comune.forli.fc.it/notizie/1", M.G)?.nome, "Forlì");
  assert.equal(estraiComuneSmart("Nuove regole per la raccolta", "https://www.forlitoday.it/cronaca/1", M.G)?.nome, "Forlì");
  assert.equal(estraiComuneSmart("Discarica abusiva scoperta a Montagano", "https://x.it/a", M.G)?.nome, "Montagano");
  assert.equal(estraiComuneSmart("il prato del parco", "https://x.it/a", M.G), null, "«prato» minuscolo e' ambiguo");
});

test("senza comune ma con un segnale, dal solo titolo resta da verificare", () => {
  const r = applicaRegole("Bando per la videosorveglianza dei parchi", "", "https://x.it/a", M);
  assert.equal(r.rilevante, true);
  assert.match(r.motivo, /^\[comune\?\] /);
  assert.equal(r.azione_suggerita, "Identificare Comune e contattare PL");
});

test("le parole chiave del foglio sostituiscono quelle del codice, pesi compresi", () => {
  const griglia = [
    ["ATTORE", "SOLUZIONE", "PROB. RIFIUTI", "FAUNA"],
    ["Peso: 3", "Peso: 5 — il più alto", "Peso: 3", "Abbatte lo score"],
    ["sindaco", "fototrappol", "rifiuti", "lupo"],
    ["", "videosorveglianza ◆ nota", "", ""],
  ];
  const { categorie, fauna } = categorieDaGriglia(griglia);
  assert.deepEqual(categorie.soluzione.kw, ["fototrappol", "videosorveglianza"]);
  assert.equal(categorie.prob_rif.peso, 3);
  assert.deepEqual(fauna, ["lupo"]);
  assert.equal(categorie.intento.kw.length > 10, true, "una colonna che manca lascia la categoria del codice");
});

test("il corpo aggiunge e non toglie; i segni dicono perche'", () => {
  const corpo = "Il Comune di Bologna ha approvato il progetto per installare nuove telecamere contro l'abbandono dei rifiuti nelle aree verdi. ".repeat(3);
  const r = valuta("Aree verdi, arriva il progetto", "https://x.it/a", corpo, M);
  assert.equal(r.rilevante, true);
  assert.equal(r.comune, "Bologna");
  assert.match(valuta("Aree verdi, arriva il progetto", "https://x.it/a", "menu cerca accedi", M).motivo, / \[corpo:ko\]$/);
  assert.match(valuta("Aree verdi", "https://www.facebook.com/a", "", M, " [solo-titolo]").motivo, / \[solo-titolo\]$/);
  assert.ok(dominioNoFetch("https://www.facebook.com/a"));
});

test("dal codice della pagina al testo, e il paywall non vale come corpo", () => {
  const html = `<html><head><style>.a{color:red}</style><script>var x=1</script></head><body><nav>menu</nav>
    <article><p>${"Il sindaco ha presentato le nuove fototrappole. ".repeat(10)}</p></article></body></html>`;
  const t = htmlToTesto(html);
  assert.match(t, /^Il sindaco ha presentato le nuove fototrappole\./);
  assert.ok(!t.includes("var x"));
  assert.ok(corpoUtile(t));
  assert.equal(htmlToTesto("<p>Contenuto riservato agli abbonati: solo per abbonati, continua a leggere</p>"), "");
  assert.equal(normNome("Reggio nell'Emilia"), "reggio nell emilia");
});
