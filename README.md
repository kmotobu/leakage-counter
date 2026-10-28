# 連続無漏洩記録

最後に情報漏洩ニュースが出てからの経過時間を「連続無災害記録」看板風に表示するミニアプリ。

## 構成

```
public/        静的フロント（index.html / style.css / app.js）
api/latest.js  Vercel Function：RSS取得 → 漏洩記事抽出 → JSON返却
lib/feed.js    RSSパーサ・キーワード判定（依存ゼロ）
test/          node:test
```

- ブラウザから直接RSSは取れない（CORS）ため、`/api/latest` で取得
- `Cache-Control: s-maxage=600, stale-while-revalidate=3600` でCDNキャッシュ → 元サイトへのアクセスは最大10分に1回
- 経過時間の計算・秒カウントはフロント側

## デプロイ

1. GitHubで空リポジトリ作成 → push
   ```
   git remote add origin https://github.com/<user>/leakage-counter.git
   git push -u origin main
   ```
2. Vercel → Add New Project → リポジトリをImport → Framework Preset: **Other**、Build設定はすべて空のまま Deploy
3. 以降は `main` へのpushで自動デプロイ

## 設定（Vercel Environment Variables・任意）

| 変数 | 既定値 | 内容 |
|---|---|---|
| `FEED_URLS` | `https://scan.netsecurity.ne.jp/rss/index.rdf` | カンマ区切りで複数フィード可 |

漏洩判定キーワードは `lib/feed.js` の `LEAK_PATTERN` / `EXCLUDE_PATTERN`。

## ローカル

```
npm test          # パーサ・APIのテスト
npx vercel dev    # API込みで起動
```
