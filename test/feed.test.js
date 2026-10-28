import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, summarize, isLeak } from '../lib/feed.js';
import handler from '../api/latest.js';

const RDF = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel rdf:about="https://example.com/"><title>Example Feed</title></channel>
<item rdf:about="https://example.com/article/2026/10/28/1.html">
  <title>セキュリティ製品の提供開始</title><link>https://example.com/article/2026/10/28/1.html</link><dc:date>2026-10-28T12:00:00+09:00</dc:date></item>
<item rdf:about="https://example.com/article/2026/10/28/2.html">
  <title><![CDATA[A社で顧客情報が漏えい、メール誤送信で &amp; 謝罪]]></title><link>https://example.com/article/2026/10/28/2.html</link><dc:date>2026-10-28T10:00:00+09:00</dc:date></item>
<item rdf:about="https://example.com/article/2026/10/25/3.html">
  <title>B大学に不正アクセス</title><link>https://example.com/article/2026/10/25/3.html</link><dc:date>2026-10-25T10:00:00+09:00</dc:date></item>
<item rdf:about="x"><title>C社でUSB紛失</title><link>https://example.com/article/2026/10/24/4.html</link><dc:date>2026-10-24T10:00:00+09:00</dc:date></item>
</rdf:RDF>`;

const RSS2 = `<rss version="2.0"><channel><item><title>D社 個人情報流出</title><link>https://example.com/d</link><pubDate>Tue, 27 Oct 2026 01:00:00 GMT</pubDate></item></channel></rss>`;

test('RSS1.0 parse + CDATA/entity decode', () => {
  const items = parseFeed(RDF);
  assert.equal(items.length, 4);
  assert.equal(items[1].title, 'A社で顧客情報が漏えい、メール誤送信で & 謝罪');
  assert.equal(items[1].date, '2026-10-28T01:00:00.000Z');
});

test('RSS2.0 parse', () => {
  const [i] = parseFeed(RSS2);
  assert.equal(i.link, 'https://example.com/d');
  assert.ok(isLeak(i));
});

test('filter, latest, longest gap', () => {
  const s = summarize(parseFeed(RDF), Date.parse('2026-10-28T12:00:00+09:00'));
  assert.equal(s.matchedCount, 3);
  assert.match(s.latest.title, /^A社/);
  assert.equal(s.longest.ms, 3 * 86400000);
  assert.equal(s.recent.length, 2);
});

test('handler: success + cache header', async () => {
  globalThis.fetch = async () => new Response(RDF, { status: 200 });
  const res = mockRes();
  await handler({}, res);
  assert.equal(res.code, 200);
  assert.match(res.headers['Cache-Control'], /s-maxage=600/);
  assert.match(res.body.latest.title, /^A社/);
});

test('handler: upstream failure -> 502', async () => {
  globalThis.fetch = async () => new Response('x', { status: 503 });
  const res = mockRes();
  await handler({}, res);
  assert.equal(res.code, 502);
});

test('handler: ?b= は現在の分±1のみ許可', async () => {
  globalThis.fetch = async () => new Response(RDF, { status: 200 });
  const now = Math.floor(Date.now() / 60000);
  for (const [b, code] of [[String(now), 200], [String(now - 1), 200], [String(now + 5), 400], ['abc', 400]]) {
    const res = mockRes();
    await handler({ url: `/api/latest?b=${b}` }, res);
    assert.equal(res.code, code, `b=${b}`);
  }
});

function mockRes() {
  return {
    headers: {}, code: 0, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
