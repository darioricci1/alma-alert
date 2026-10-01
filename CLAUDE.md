# Istruzioni per Claude su alma-alert

Vale tutto il CLAUDE.md della culla (push diretto su `main`, versioni in
testa ai file). In più, questo è software di Alma Sicurezza:

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
