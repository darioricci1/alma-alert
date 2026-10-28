# Istruzioni per Claude su alma-alert

Repository suo dal 28/10/2026 (prima era una cartella del monorepo dei
progetti nuovi). Le regole di sempre:

- Push diretto su `main` appena il lavoro è finito, senza branch né pull
  request: Vercel ripubblica da solo. Prima del push si controlla che il
  codice sia sano.
- Ogni file di codice porta la versione in testa: patch per una correzione,
  minor per una funzionalità nuova.
- I dati stanno solo su Neon.

In più, questo è software di Alma Sicurezza:

- È elencato nel registro del gestionale (`nucleo/software-registro.js` di
  `darioricci1/gestionale-alma`, pagina Software): ogni lavoro qui che cambia
  cosa fa, quali dati legge o scrive, o lo schema `alert`, aggiorna anche il
  registro nello stesso lavoro, con un push su `main` del gestionale.
- Lo schema `alert` lo possiede questo progetto (`schema.sql`, con la sua
  versione). Il gestionale lo legge e scrive solo stato e recapiti dei Comuni
  caldi, fonti, impostazioni e l'import dal foglio: se cambi una colonna che
  usa il gestionale (`pagine/commerciale-*.js`, `sincronizza/alert-foglio.js`),
  cambiala anche lì.
- Il motore (`lib/motore.js`) segue AlmaPipeline.gs v3.55.0: se cambi una
  regola, alza `MOTORE_VERSIONE`, così gli articoli già valutati si rifanno.
- Niente segreti nel codice: CRON_SECRET e il database stanno nelle variabili
  del progetto Vercel `alma-alert`.
