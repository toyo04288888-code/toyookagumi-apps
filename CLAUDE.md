# 豊岡組 業務アプリ

株式会社 豊岡組（土木会社）向けの社内Webアプリ集。各アプリは単一HTMLファイルで、Supabase（クラウドDB）と連携する。
オーナーは非エンジニア。説明は専門用語を避け、操作手順を具体的に示すこと。

## アプリ一覧（4ファイル）

| ファイル | アプリ名 | 用途 | 技術 |
|---|---|---|---|
| `index.html` | 工事日報（監督用） | 日々の作業日報を入力・保存。Excel/印刷出力。 | 素のJS + SheetJS(xlsx) |
| `toyooka-tenken.html` | 点検簿ジェネレーター（事務用） | 機械の点検簿Excelを読み込み、日報データから使用日を自動で✔ | 素のJS + ExcelJS |
| `genba-kanri.html` | 現場管理表 | 複数現場の進行状況（未着手/施工中/完了）を管理 | 素のJS（Supabase REST直叩き） |
| `mitsumori.html` | 現場見積アプリ | 工事項目の単価・複合単価から見積作成 | React + Tailwind（ビルド済みインライン） |

## 公開URL（本番）

ベース: `https://toyookagumi-apps.toyo-04288888.workers.dev`
- 工事日報: `/index.html`
- 点検簿ジェネレーター: `/toyooka-tenken.html`
- 現場管理表: `/genba-kanri.html`
- 見積アプリ: `/mitsumori.html`

## デプロイの仕組み

- GitHub: `https://github.com/toyo04288888-code/toyookagumi-apps`（mainブランチ）
- ホスティング: Cloudflare Workers（静的アセット配信。`wrangler.toml`で`directory = "./"`を指定）
- **`git push`すると Cloudflare が自動でデプロイし直す**（手動アップロード不要）
- 編集後の反映手順: `git add -A` → `git commit -m "..."` → `git push`

## Supabase連携

- 日報アプリと点検簿ジェネレーターが**同じSupabaseプロジェクト**を共有する（現場管理表は別系統で、共有不要）
- 日報アプリが `kantoku_nippou` テーブルに日報を保存 → 点検簿ジェネレーターが同テーブルを読み、機種・形式に一致する機械の使用日を自動で✔
- URL・publishable key は **端末ごとに** 各アプリの設定画面で入力（localStorageに保存）。新しい端末では初回1回だけ入力が必要
- テーブル作成SQLは `index.html` の設定タブ内（`kantoku_nippou` と `app_config`）

## 実装済みの主な機能（点検簿ジェネレーター）

- Excel読込→対象月シート選択時に、クラウドから当月日報を**自動取得**し、機種・形式に一致する機械を**自動チェック**（`isMachineMatch`で数字/英字トークンを照合）
- **複数Excelファイルの一括処理**（`multiple`選択 → 月・点検者を一度指定 → まとめて自動処理しファイルごとにダウンロード）
- 機械の絞り込みは月単位（工事単位の絞り込みは現状なし）

## PWA（ホーム画面/アプリとしてインストール）

- 4ファイルとも `<link rel="manifest">`（data URI）＋ apple-touch-icon を埋め込み済み
- 各アプリで `id` / `start_url` / `scope` を **ファイル名単位で固有**にしてある（共通の`./`にすると全アプリが同一PWA扱いになり、1つ消すと全部消える不具合が出るため）
- インストールは**HTTPSの公開URL**でのみ可能。ローカルの`file://`では出ない

## 作業上の注意

- 複数PCで作業する場合、編集前に必ず `git pull`。同時編集は避ける
- 日本語ファイル名はURL互換性のため英数字にリネーム済み（元: `現場管理_クラウド版.html`→`genba-kanri.html`、`豊岡組_現場見積アプリ.html`→`mitsumori.html`）
- 旧Netlifyデプロイ（手動D&D、Git連携なし）は古い版のまま。本番はCloudflareに一本化
