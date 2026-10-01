import { test } from "node:test";
import assert from "node:assert/strict";
import { comuniCaldi, costruisciDestinatari, saluto, generaTestoMail, normalizzaNome } from "../lib/lead.js";

const comuni = [
  { chiave: "bologna", comune: "Bologna", prov: "BO", nome_comandante_pl: "Com.te Romano Mignani",
    email_pl: "poliziamunicipale@comune.bologna.it", sindaco: "Matteo Lepore", email_sindaco: "sindaco@pec.comune.bologna.it", score: 4 },
  { chiave: "galeata", comune: "Galeata", prov: "FC", score: 1 },
];
const articoli = [
  { id: 1, comune: "Bologna", rilevante: true, data_mail: "2026-09-01T08:00:00Z", url: "https://a.it/1", tema: "rifiuti", score: 6 },
  { id: 2, comune: "Bologna", rilevante: true, data_mail: "2026-09-20T08:00:00Z", url: "https://a.it/2", tema: "varchi_ZTL", score: 8 },
  { id: 3, comune: "Cesena", rilevante: true, data_mail: "2026-09-10T08:00:00Z", url: "https://a.it/3", tema: "rifiuti", score: 7 },
  { id: 4, comune: "Bologna", rilevante: false, data_mail: "2026-09-30T08:00:00Z", url: "https://a.it/4", tema: "altro", score: 2 },
];

test("una riga per comune: l'articolo piu' recente, quanti sono, il testo della mail", () => {
  const { aggiorna, nuovi } = comuniCaldi({ articoli, comuni });
  const bo = aggiorna.find((r) => r.chiave === "bologna");
  assert.equal(bo.n_art, 2);
  assert.equal(bo.url_migliore, "https://a.it/2");
  assert.equal(bo.tema, "varchi_ZTL");
  assert.equal(bo.score, 8);
  assert.equal(bo.data_ultimo_articolo, "2026-09-20");
  assert.match(bo.testo_mail, /^OGGETTO: Varchi e lettura targhe a Bologna\n\nGentile Comandante Mignani,/);
  assert.equal(bo.destinatari, "Com.te Romano Mignani <poliziamunicipale@comune.bologna.it>", "la PEC del sindaco resta fuori");
  assert.equal(nuovi.length, 1);
  assert.equal(nuovi[0].comune, "Cesena");
  assert.match(nuovi[0].testo_mail, /Gentile Comando di Polizia Locale,/);
});

test("le mail gia' inviate e le opportunita'", () => {
  const mail = [{ comune: "Bologna", data_invio: "2026-04-24", destinatari: "<pm@comune.bologna.it>" }];
  const opportunita = [{ comune: "Bologna", ente: "ALEA", soci_clienti: 9 }, { comune: "Galeata", ente: "ALEA Ambiente", soci_clienti: 9 }];
  const { aggiorna, soloOpportunita, outreach } = comuniCaldi({ articoli, comuni, mail, opportunita });
  const bo = aggiorna.find((r) => r.chiave === "bologna");
  assert.equal(bo.destinatari, "<pm@comune.bologna.it>");
  assert.equal(bo.data_ultima_mail, "2026-04-24");
  assert.equal(bo.score, 10, "8 piu' 3, fino a 10");
  assert.equal(bo.opportunita_ente, "ALEA (9 soci clienti)");
  assert.deepEqual(outreach.sort(), [1, 2]);
  assert.deepEqual(soloOpportunita, [{ chiave: "galeata", opportunita_ente: "ALEA Ambiente (9 soci clienti)", score: 5 }]);
});

test("saluto, destinatari e nomi", () => {
  assert.equal(saluto({ nome_comandante_pl: "Vacante", sindaco: "Vittoria Ferdinandi" }), "Gentile Sindaco Ferdinandi,");
  assert.equal(costruisciDestinatari({ email_pl: "[pattern] pl@x.it", email_pl_2: "pl2@x.it" }), "<pl2@x.it>");
  assert.match(generaTestoMail("Forlì", "rifiuti", "", "Gentile X,"), /^OGGETTO: Abbandoni a Forlì: come altri Comuni li hanno azzerati/);
  assert.equal(normalizzaNome("Forlì-Cesena "), "forli cesena");
});
