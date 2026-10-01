-- alma-alert/schema.sql
-- version: 0.1.0
--
-- Lo schema `alert` nel database unico di Alma (Neon, lo stesso del
-- gestionale). Lo crea e lo aggiorna questo progetto; il gestionale lo legge
-- e scrive solo dove e' detto (stato e recapiti dei Comuni caldi, fonti,
-- impostazioni, e l'import dal foglio finche' il foglio e' acceso).
--
-- Ogni tabella ha il nome della scheda del foglio «Alma Alert Pipeline» da
-- cui viene, cosi' chi conosce il foglio ritrova le cose.

create schema if not exists alert;

-- Le notizie, una per indirizzo (era la scheda «Elenco articoli», prima «Coda»).
create table if not exists alert.articolo (
  id               bigserial primary key,
  url              text not null unique,
  titolo           text not null,
  query_alert      text,
  data_mail        timestamptz,
  data_estrazione  timestamptz not null default now(),
  stato            text not null default 'nuovo',   -- nuovo, classified_kw, full_<versione del motore>
  score            integer,
  rilevante        boolean,
  motivo           text,
  comune           text,
  provincia        text,
  tema             text,
  azione_suggerita text,
  usato_outreach   boolean not null default false,
  kw_attore        text,
  kw_soluzione     text,
  kw_intento       text,
  estratto         text,
  origine          text not null default 'rss',     -- rss, foglio
  aggiornato_il    timestamptz not null default now()
);
create index if not exists articolo_stato on alert.articolo (stato);
create index if not exists articolo_data on alert.articolo (data_mail desc);
create index if not exists articolo_comune on alert.articolo (lower(comune)) where rilevante;

-- Il testo degli articoli scaricati (era «Corpi»): 1500 caratteri al massimo.
create table if not exists alert.corpo (
  url           text primary key,
  corpo         text not null default '',
  scaricato_il  timestamptz not null default now()
);

-- Una riga per comune (era «Comuni Caldi»). Le colonne calcolate le riscrive il
-- giro; recapiti, stato e contatto li scrivono le persone.
create table if not exists alert.comune_caldo (
  id                            bigserial primary key,
  chiave                        text not null unique,   -- il nome normalizzato
  comune                        text not null,
  prov                          text,
  abitanti                      integer,
  data_contatto                 date,
  prodotto_proposto             text,
  stato                         text,                   -- attivo, ex, da verificare...
  score                         integer,
  data_ultima_mail              date,
  data_ultimo_articolo          date,
  n_art                         integer,
  tema                          text,
  url_migliore                  text,
  conflitti                     text,
  sindaco                       text,
  email_sindaco                 text,
  assessore_sicurezza_ambiente  text,
  email_assessore               text,
  nome_comandante_pl            text,
  email_pl                      text,
  email_pl_2                    text,
  sito_web                      text,
  telefono                      text,
  verifica_email                text,
  destinatari                   text,
  testo_mail                    text,
  opportunita_ente              text,
  origine                       text not null default 'alert',   -- alert, foglio
  aggiornato_il                 timestamptz not null default now()
);

-- Le parole chiave (era «ParoleChiave»): la griglia com'e' nel foglio, una
-- cella per riga, cosi' il motore la legge con le stesse regole.
create table if not exists alert.parola_chiave (
  riga     integer not null,
  colonna  integer not null,
  valore   text not null,
  primary key (riga, colonna)
);

-- L'anagrafe dei comuni con la popolazione (era «Popolazione Comuni»).
create table if not exists alert.comune (
  ordine       integer primary key,
  nome         text not null,
  sigla        text,
  popolazione  integer
);

-- I comuni e le loro unioni (era «Unioni»).
create table if not exists alert.unione (
  ordine       integer primary key,
  comune       text not null,
  unione       text,
  sito_unione  text
);

-- Gli enti sopra i comuni, come ALEA Ambiente (era «EntiSovracomunali»).
create table if not exists alert.ente_sovracomunale (
  ordine   integer primary key,
  ente     text not null,
  comune   text not null
);

-- I comuni di un ente o di un'unione dove ci sono gia' clienti (era «Opportunità»).
create table if not exists alert.opportunita (
  ordine        integer primary key,
  comune        text not null,
  ente          text,
  tipo          text,
  soci_clienti  integer,
  quali_soci    text,
  motivo        text
);

-- I clienti attivi per servizio (era «Clienti attivi»).
create table if not exists alert.cliente_attivo (
  ordine         integer primary key,
  regione        text,
  comune         text not null,
  mvt            boolean,
  vds            boolean,
  one_shot       boolean,
  inizio_mvt     date,
  fine_mvt       date,
  inizio_vds     date,
  fine_vds       date,
  data_one_shot  date
);

-- Le mail commerciali gia' inviate (era «MailCommerciali»).
create table if not exists alert.mail_commerciale (
  ordine            integer primary key,
  file              text,
  data_invio        date,
  mittente          text,
  destinatari       text,
  cc                text,
  oggetto           text,
  comune            text,
  provincia         text,
  unione_o_dominio  text,
  temi_estratti     text,
  incipit           text,
  body_completo     text,
  errore            text,
  note_correzione   text
);

-- Le fonti: i feed RSS dei Google Alert.
create table if not exists alert.feed (
  id            bigserial primary key,
  url           text not null unique,
  nome          text,
  attivo        boolean not null default true,
  ultimo_giro   timestamptz,
  ultimo_esito  text,
  aggiunto_il   timestamptz not null default now()
);

-- Le impostazioni, chiave e valore (foglio acceso o spento, versione dello schema).
create table if not exists alert.impostazione (
  chiave  text primary key,
  valore  text
);

-- I giri, per sapere quando e' andato l'ultimo e com'e' andato.
create table if not exists alert.giro (
  id           bigserial primary key,
  iniziato_il  timestamptz not null default now(),
  finito_il    timestamptz,
  tipo         text not null,
  esito        text not null default 'in corso',
  dettagli     jsonb
);
