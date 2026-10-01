// alma-alert/lib/feed.js
// version: 0.1.0
//
// Le notizie dai feed dei Google Alert.
//
// L'Apps Script le leggeva dalla posta (GmailApp), che da un server non si
// legge senza un permesso Google da rinnovare ogni settimana. Google Alert
// pero' sa consegnare le stesse notizie anche come feed RSS: un indirizzo per
// ricerca, che si legge senza password. Qui si legge quello.
//
// Un feed di Google Alert e' Atom: <entry> con titolo in HTML, il collegamento
// che passa da google.com/url (l'indirizzo vero sta nel parametro `url`) e la
// data. Si accetta anche l'RSS classico (<item>), per le fonti che non sono
// Google. Pura: niente rete, si prova con il testo di un feed.

/** I caratteri speciali dell'XML e quelli dell'HTML piu' comuni. */
export function decodifica(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Testo semplice da un titolo HTML: i tag via, le entita' sciolte. */
export function testo(html) {
  // Due giri: il titolo arriva come HTML dentro l'XML, quindi le entita'
  // sono scritte due volte (&amp;#39; diventa &#39; e poi l'apostrofo).
  return decodifica(decodifica(html).replace(/<[^>]+>/g, "")).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** L'indirizzo vero dietro il rimando di Google, o quello dato se non e' un rimando. */
export function estraiUrlReale(indirizzo) {
  const u = decodifica(indirizzo).trim();
  const m = u.match(/^https?:\/\/(www\.)?google\.[a-z.]+\/url\?(.*)$/i);
  if (!m) return u || null;
  const p = m[2].match(/(?:^|&)url=([^&]+)/);
  if (!p) return null;
  try { return decodeURIComponent(p[1]); } catch { return null; }
}

/** La ricerca dal titolo del feed: «Google Alert - sanzioni rifiuti» → «sanzioni rifiuti». */
export function ricercaDaTitolo(titolo) {
  return testo(titolo).replace(/^Google\s+Alert[s]?\s*[-–]\s*/i, "").trim();
}

const dentro = (blocco, tag) => {
  const m = blocco.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : "";
};

// Le voci di servizio che Google mette fra i collegamenti: non sono notizie.
const SERVIZIO = /^(visualizza tutti|view all|annulla|unsubscribe|flag as|modifica|edit|see more|rss feed)/i;

/**
 * { ricerca, voci: [{ titolo, url, data, estratto }] } da un feed Atom o RSS.
 * Le voci senza indirizzo o con un titolo troppo corto si scartano, come
 * nell'Apps Script (meno di 8 caratteri non e' un titolo).
 */
export function leggiFeed(xml) {
  const s = String(xml || "");
  const testaFeed = s.split(/<entry[\s>]|<item[\s>]/i)[0];
  const ricerca = ricercaDaTitolo(dentro(testaFeed, "title"));
  const voci = [], visti = new Set();
  const blocchi = s.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || s.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocchi) {
    const titolo = testo(dentro(b, "title"));
    let link = "";
    const atom = b.match(/<link\b[^>]*href="([^"]+)"/i);
    if (atom) link = atom[1];
    else link = dentro(b, "link");
    const url = estraiUrlReale(link);
    if (!url || !titolo || titolo.length < 8 || SERVIZIO.test(titolo) || visti.has(url)) continue;
    visti.add(url);
    const quando = dentro(b, "published") || dentro(b, "updated") || dentro(b, "pubDate") || dentro(b, "dc:date");
    const d = quando ? new Date(decodifica(quando).trim()) : null;
    voci.push({
      titolo,
      url,
      data: d && !isNaN(d.getTime()) ? d.toISOString() : null,
      estratto: testo(dentro(b, "content") || dentro(b, "description")).slice(0, 600),
    });
  }
  return { ricerca, voci };
}
