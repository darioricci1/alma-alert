# Alma Alert

> Repository suo dal 28/10/2026 (prima era una cartella del monorepo dei progetti nuovi). Sito: https://alma-alert.vercel.app.

<!-- version: 0.1.0 -->

La pipeline dei Google Alert di Alma Sicurezza, fuori dal foglio Google.
Ogni ora legge le notizie, decide quali sono occasioni commerciali e tiene
aggiornata una riga per comune (i **Comuni caldi**) con l'articolo più
recente, i destinatari e il testo della mail già scritto. Le persone la usano
dal gestionale, area **Commerciale**: Comuni caldi, Notizie, Fonti.

È nata dall'Apps Script del foglio «Alma Alert Pipeline» (AlmaPipeline.gs
v3.55.0, recuperato dalla storia delle conversazioni di claude.ai): stesse
regole, stessi nomi di funzione, stesso punteggio da 0 a 10.

## Com'è fatto

- `lib/motore.js`: il motore 3.1. Parole chiave per categoria (attore,
  soluzione, intento, problemi di sicurezza, rifiuti, idrogeologico), il
  comune citato (dal titolo, dal testo, dal sito), il punteggio e il motivo.
- `lib/feed.js`: le notizie dai feed RSS dei Google Alert.
- `lib/lead.js`: i Comuni caldi, il testo della mail, i destinatari senza PEC.
- `lib/giro.js`: il giro di ogni ora (feed → titoli → corpi → Comuni caldi).
- `schema.sql`: lo schema `alert` nel database unico di Alma (Neon, lo stesso
  del gestionale). Ogni tabella porta il nome della scheda del foglio da cui
  viene.
- `api/giro.js`: il giro (cron ogni ora, al minuto 7). `api/stato.js`: i numeri.

## Il passaggio dal foglio

Finché il foglio è **acceso** comanda il foglio: l'Apps Script continua a
leggere la posta e a calcolare, e il gestionale ne importa tutto ogni notte
(e quando si preme «Importa adesso» nella pagina Fonti). Qui si lavorano solo
le notizie arrivate dai feed.

Per spegnerlo:

1. In Google Alert (account almasicurezzasrl@gmail.com), per ogni ricerca:
   matita → «Mostra opzioni» → **Recapita a: Feed RSS** → Aggiorna avviso.
   Accanto alla ricerca compare l'icona del feed: il suo indirizzo va
   incollato nella pagina **Fonti** del gestionale (uno per riga).
2. Nel foglio, menu ⚡ Alma: fermare l'automazione dell'Apps Script.
3. Nella pagina Fonti: «Spegni il foglio». Da lì Comuni caldi e recapiti si
   modificano nel gestionale e questo giro fa tutto.

## Cosa manca rispetto al foglio

- Lo scraper dei recapiti dai siti dei comuni (ScrapaContattiComunali.gs) e la
  verifica delle email (VerificaEmailPL.gs, verifica_email_smtp.py): i
  recapiti già raccolti arrivano dall'import, quelli nuovi per ora si scrivono
  a mano nella pagina Comuni caldi.
- Clienti attivi e Opportunità si importano dal foglio; ricalcolarli dai
  contratti del gestionale è il passo dopo.

## Prove

    npm test
