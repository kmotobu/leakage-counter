import { parseFeed, summarize } from '../lib/feed.js';

// 複数指定可（カンマ区切り）。既定はScanNetSecurityのRSS
const FEED_URLS = (process.env.FEED_URLS || 'https://scan.netsecurity.ne.jp/rss/index.rdf')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function fetchFeed(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'leakage-counter/1.0 (+https://vercel.com)', Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return parseFeed(await r.text());
}

export default async function handler(req, res) {
  const results = await Promise.allSettled(FEED_URLS.map(fetchFeed));
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const errors = results.filter((r) => r.status === 'rejected').map((r) => String(r.reason?.message || r.reason));

  if (!items.length) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(502).json({ error: 'フィード取得失敗', errors });
  }

  // CDNで10分キャッシュ。期限切れ後1時間は古い値を返しつつ裏で更新
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.status(200).json({ ...summarize(items), sources: FEED_URLS, errors, fetchedAt: new Date().toISOString() });
}
