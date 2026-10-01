import { test } from "node:test";
import assert from "node:assert/strict";
import { leggiFeed, estraiUrlReale, ricercaDaTitolo } from "../lib/feed.js";

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:idx="urn:atom-extension:indexing">
  <id>tag:google.com,2005:reader/user/1/state/com.google/alerts/2</id>
  <title>Google Alert - sanzioni rifiuti</title>
  <entry>
    <id>tag:google.com,2013:googlealerts/feed:1</id>
    <title type="html">Stretta su &lt;b&gt;rifiuti&lt;/b&gt; e decoro: l&amp;#39;assessore annuncia multe</title>
    <link href="https://www.google.com/url?rct=j&amp;sa=t&amp;url=https://brescia.corriere.it/notizie/rifiuti%3Fa%3D1&amp;ct=ga&amp;cd=CAI&amp;usg=AOv"/>
    <published>2026-10-01T08:14:54Z</published>
    <updated>2026-10-01T08:14:54Z</updated>
    <content type="html">Il &lt;b&gt;Comune&lt;/b&gt; ha deciso...</content>
  </entry>
  <entry>
    <title type="html">Breve</title>
    <link href="https://www.google.com/url?url=https://x.it/b"/>
  </entry>
  <entry>
    <title type="html">Stretta su rifiuti, di nuovo lo stesso articolo</title>
    <link href="https://www.google.com/url?rct=j&amp;url=https://brescia.corriere.it/notizie/rifiuti%3Fa%3D1&amp;ct=ga"/>
  </entry>
</feed>`;

test("un feed di Google Alert diventa notizie con l'indirizzo vero", () => {
  const { ricerca, voci } = leggiFeed(ATOM);
  assert.equal(ricerca, "sanzioni rifiuti");
  assert.equal(voci.length, 1, "il titolo troppo corto e il doppione non entrano");
  assert.equal(voci[0].titolo, "Stretta su rifiuti e decoro: l'assessore annuncia multe");
  assert.equal(voci[0].url, "https://brescia.corriere.it/notizie/rifiuti?a=1");
  assert.equal(voci[0].data, "2026-10-01T08:14:54.000Z");
  assert.equal(voci[0].estratto, "Il Comune ha deciso...");
});

test("anche l'RSS classico", () => {
  const rss = `<rss><channel><title>Albo</title><item><title>Avviso pubblico per la videosorveglianza</title>
    <link>https://comune.forli.fc.it/avviso/1</link><pubDate>Wed, 01 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
  const { voci } = leggiFeed(rss);
  assert.equal(voci[0].url, "https://comune.forli.fc.it/avviso/1");
  assert.equal(voci[0].data, "2026-10-01T08:00:00.000Z");
});

test("gli indirizzi e il titolo del feed", () => {
  assert.equal(estraiUrlReale("https://www.google.com/url?rct=j&amp;url=https%3A%2F%2Fa.it%2Fb&amp;ct=ga"), "https://a.it/b");
  assert.equal(estraiUrlReale("https://a.it/diretto"), "https://a.it/diretto");
  assert.equal(ricercaDaTitolo("Google Alert – fototrappole"), "fototrappole");
});
