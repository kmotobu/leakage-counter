const $ = (id) => document.getElementById(id);
const REFRESH_MS = 10 * 60 * 1000;
const DAY = 86400000, HOUR = 3600000, MIN = 60000;

let latest = null;

const pad = (n, w = 2) => String(n).padStart(w, '0');
// 1桁ずつ固定幅セルに入れる（フォントの数字幅差でBoxが揺れないように）
const setPlate = (id, str) => {
  const el = $(id);
  if (el.dataset.v === str) return;
  el.dataset.v = str;
  el.innerHTML = [...str].map((c) => `<i>${c}</i>`).join('');
};
const fmtDate = (iso) =>
  new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
const fmtSpan = (ms) => {
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / MIN);
  return d ? `${d}日${h}時間` : h ? `${h}時間${m}分` : `${m}分`;
};

function slogan(ms) {
  if (ms < HOUR) return '速報：記録リセット。現場は只今対応中です。';
  if (ms < DAY) return '本日も漏洩が発生しました。気を引き締めていきましょう。';
  if (ms < 3 * DAY) return '記録継続中。メールの宛先、今一度ご確認を。';
  if (ms < 7 * DAY) return '好調です。パスワードの使い回し、していませんか。';
  return '驚異的な記録です。……本当にRSS取れてますか？';
}

function tick() {
  if (!latest) return;
  const ms = Math.max(0, Date.now() - Date.parse(latest.date));
  setPlate('d', pad(Math.floor(ms / DAY), 3));
  setPlate('h', pad(Math.floor((ms % DAY) / HOUR)));
  setPlate('m', pad(Math.floor((ms % HOUR) / MIN)));
  setPlate('s', pad(Math.floor((ms % MIN) / 1000)));
  $('sign').dataset.level = ms < DAY ? 'danger' : ms < 3 * DAY ? 'caution' : 'safe';
  $('slogan').textContent = slogan(ms);
  $('counter').setAttribute('aria-label', `連続無漏洩記録 ${fmtSpan(ms)}`);
}

function render(data) {
  const prev = latest;
  latest = data.latest;
  if (!latest) {
    $('slogan').textContent = 'フィード内に漏洩報道が見つかりませんでした。';
    return;
  }
  if (prev && prev.link !== latest.link) {
    $('counter').classList.add('reset');
    setTimeout(() => $('counter').classList.remove('reset'), 1600);
  }
  $('lastDate').textContent = fmtDate(latest.date);
  $('lastLink').textContent = latest.title;
  $('lastLink').href = latest.link;
  $('count').textContent = `${data.matchedCount}件 / ${data.totalCount}件中`;
  $('longest').textContent = data.longest
    ? fmtSpan(data.longest.ms) + (data.longest.to ? '' : '（更新中）')
    : '—';
  $('fetched').textContent = `取得 ${fmtDate(data.fetchedAt)}`;

  const ol = $('recent');
  ol.replaceChildren(
    ...(data.recent || []).map((r) => {
      const li = document.createElement('li');
      const t = document.createElement('time');
      t.dateTime = r.date; t.textContent = fmtDate(r.date);
      const a = document.createElement('a');
      a.href = r.link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = r.title;
      li.append(t, a);
      return li;
    })
  );
  $('recentWrap').hidden = !ol.children.length;
  tick();
}

async function load(force = false) {
  try {
    // 手動更新時は1分単位のキーでCDNキャッシュを外す（連打しても元サイトへは最大1回/分）
    const url = force ? `/api/latest?b=${Math.floor(Date.now() / 60000)}` : '/api/latest';
    const r = await fetch(url, { cache: 'no-store' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.status);
    render(data);
  } catch (e) {
    if (!latest) $('slogan').textContent = `記録の取得に失敗しました（${e.message}）`;
  }
}

$('reload').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true; btn.textContent = '確認中…';
  await load(true);
  btn.textContent = '↻ 最新を確認'; btn.disabled = false;
});

load();
setInterval(tick, 1000);
setInterval(load, REFRESH_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { load(); tick(); } });
