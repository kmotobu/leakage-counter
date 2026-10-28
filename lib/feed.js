// RSS 1.0 (RDF) / RSS 2.0 / Atom を依存なしでパースし、漏洩系記事を抽出する

// タイトルにこれらが含まれる記事を「漏洩ニュース」とみなす
export const LEAK_PATTERN =
  /漏洩|漏えい|流出|不正アクセス|誤送信|誤送付|誤配信|誤掲載|紛失|盗難|閲覧可能|閲覧できる状態|公開状態|ランサムウェア|サイバー攻撃|個人情報/;

// 漏洩事故ではない記事を除外（イベント告知・解説・製品等）
export const EXCLUDE_PATTERN = /セミナー|ウェビナー|イベント|カンファレンス|発売|リリース|提供開始|調査レポート|ランキング|対策製品/;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(s) {
  return s
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/<[^>]+>/g, '')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : null;
}

function attrLink(block) {
  // Atom: <link href="..."/>
  const m = block.match(/<link\b[^>]*href="([^"]+)"/i);
  return m ? decode(m[1]) : null;
}

export function parseFeed(xml) {
  const items = [];
  const re = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[2];
    const title = tag(b, 'title');
    const link = tag(b, 'link') || attrLink(b);
    const dateStr = tag(b, 'dc:date') || tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated');
    const t = dateStr ? Date.parse(dateStr) : NaN;
    if (!title || !link || Number.isNaN(t)) continue;
    items.push({ title, link, date: new Date(t).toISOString() });
  }
  return items;
}

export function isLeak(item) {
  return LEAK_PATTERN.test(item.title) && !EXCLUDE_PATTERN.test(item.title);
}

// 抽出結果から最新記事と、フィード内の最長間隔を求める
export function summarize(items, now = Date.now()) {
  const seen = new Set();
  const leaks = items
    .filter(isLeak)
    .filter((i) => (seen.has(i.link) ? false : seen.add(i.link)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  let longest = null;
  for (let i = 0; i < leaks.length - 1; i++) {
    const gap = Date.parse(leaks[i].date) - Date.parse(leaks[i + 1].date);
    if (!longest || gap > longest.ms) longest = { ms: gap, from: leaks[i + 1].date, to: leaks[i].date };
  }
  // 現在進行中の記録が最長なら更新中扱い
  if (leaks[0]) {
    const current = now - Date.parse(leaks[0].date);
    if (!longest || current > longest.ms) longest = { ms: current, from: leaks[0].date, to: null };
  }

  return {
    latest: leaks[0] ?? null,
    recent: leaks.slice(1, 6),
    longest,
    matchedCount: leaks.length,
    totalCount: items.length,
  };
}
