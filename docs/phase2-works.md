# ミナトテック 製作実績PoC（フェーズ2）

既存のEmDash 1.4.0 / Astro 7.4.4プロジェクトに、標準Collection `works`を追加しました。企業サイト全体のデザイン・問い合わせは後続フェーズです。

## ローカルで開く

```sh
bun dev --host 127.0.0.1 --port 4322
```

- 一覧：<http://127.0.0.1:4322/works/>
- 長文・ギャラリーあり：<http://127.0.0.1:4322/works/positioning-jig/>
- 任意項目なし：<http://127.0.0.1:4322/works/inspection-bracket/>
- 管理画面：[開発用ログイン](http://127.0.0.1:4322/_emdash/api/auth/dev-bypass?redirect=/_emdash/admin/content/works)

開発用ログインはEmDash標準機能で、本番では無効になります。同じチェックアウトの開発サーバーを重複起動しないでください。

## モデル

内部名`works`、表示名「製作実績」、URLパターン`/works/{slug}/`。supportsは`drafts` / `revisions` / `preview` / `search` / `seo`です。

| 内部名         | 表示名     | 型           | 必須 |
| -------------- | ---------- | ------------ | ---- |
| title          | タイトル   | string       | ○    |
| summary        | 概要       | text         | ○    |
| featured_image | メイン画像 | image        | ○    |
| content        | 本文       | portableText | —    |
| material       | 材質       | string       | —    |
| process        | 加工方法   | string       | —    |
| industry       | 対象業種   | string       | —    |
| gallery        | ギャラリー | repeater     | —    |

`gallery.validation.subFields`は、必須の`image: image`と任意の`caption: string`。ギャラリー全体は空でも保存でき、行を作成した場合は画像が必要です。画像は標準メディアオブジェクトを使用します。

公開日は標準`publishedAt`。一覧は`published_at`降順、12件ずつのカーソル方式です。日付表示は日本語・Asia/Tokyo。`completed_on`、予約公開の検証、コメント、独自分類は対象外です。

## 既存DBへの適用と新規環境

**seed編集は既存DBへ自動適用されません。** 既存DBにseedを再適用せず、初期化・既存記事削除もしません。

1. 対象URL・起動プロセス・DB/R2を確認し、整合性のあるバックアップを取得する。
2. 既存の`works` Collection、同名固定ページ、URL上書き等との競合を確認する。
3. 管理画面の「コンテンツタイプ」で上記モデルを追加する。既存Collection・フィールドは変更しない。
4. 標準の検索設定で`works`を有効化する。日本語の部分一致には`trigram`を使用する。検索語は3 Unicode文字以上が必要。
5. `primary`メニューに「製作実績」→`/works/`を追加し、他の項目を保持する。
6. 型を生成してコードとの整合を確認する。`emdash-env.d.ts`は手編集しない。

ローカル環境では、手順3～5を標準APIで行うスクリプトを用意しています。接続先は明示的な`http://127.0.0.1:PORT`に限定しています。

```sh
bun scripts/phase2-works.ts schema http://127.0.0.1:4322
bun scripts/phase2-works.ts demo http://127.0.0.1:4322
bunx --no-install emdash types --url http://127.0.0.1:4322
```

`schema`は不足するフィールドとメニュー項目だけを追加します。既存モデルの型・必須・検索対象・validation・supports・URLが異なる場合は停止します。検索有効化は`works`の索引を再構築します。失敗した場合は適用済みの各段階を確認してから再開してください。

`demo`は同じスラッグの既存記事を上書きしません。公開3件と下書き1件を登録します。画像は標準メディアAPIでアップロードし、記事は下書きとして作成後、公開対象だけ標準公開APIで公開します。

新規DBでは`seed/seed.json`からモデルとメニューを初期構築します。その後、上記`schema`で日本語検索を設定し、必要なら`demo`で画像付きサンプルを登録してください。seedには環境固有のメディアIDを埋め込んでいません。EmDashの`$media`はURL方式で、ローカル`file`直接取り込みには対応していないためです。`fixtures/works/content.json`の`$asset`はこのスクリプト専用で、EmDash seed構文ではありません。

## 素材・公開側の挙動

素材の出典と再生成方法は[fixtures/works/README.md](../fixtures/works/README.md)を参照。SVG/PNGはPoC用に自作した模式図、本文も架空です。実在顧客・実案件・第三者の写真や図面は使っていません。

- SSRで標準`getEmDashCollection` / `getEmDashEntry` / `Image` / `PortableText`を使用。
- 任意の仕様項目・本文・ギャラリーが空の場合、その内容を省略。
- SEOは標準`getSeoMeta` / `EmDashHead`。管理画面のSEO説明がなければ`summary`を使用。
- 公開URLとcanonicalは末尾スラッシュあり。スラッシュなしは308で転送し、クエリを保持。
- 標準のプレビュー発行URLとサイトマップは、EmDash側の補間で末尾スラッシュが除去される場合がある。転送後は同じ詳細へ到達し、署名を保持する。グローバルなtrailingSlashや標準サイトマップの独自実装は追加していない。
- プレビューに確認表示・noindex/nofollow・private/no-store。標準署名検証とキャッシュ回避を維持。
- 未存在・一般閲覧の下書きは404、クエリ取得失敗は503/no-store、日本語案内。正常な空一覧は200。
- コンテンツ・設定・メニューのcacheHintを登録。ルートキャッシュ自体は新たに有効化していない。
- ホーム・メニュー・検索から製作実績へ接続。検索対象に`works`を追加。

## 管理画面でのユーザー最終確認

1. 開発用ログインを開き、「製作実績」→「新規追加」。タイトル・概要を入力する。
2. メイン画像の「ファイルを選択」→「ファイルをアップロード」から、手元のPNG/JPEGを追加する。用意済みの`fixtures/works/*.png`も利用できる。代替テキストを確認する。
3. ギャラリーに2行以上を追加し、各行で画像を選び、任意でキャプションを入力する。行左側のハンドルをドラッグして並び替える。
4. 必要なら「本文」に課題・対応・成果を入力する。材質・加工方法・対象業種は空でもよい。
5. 「保存」で下書きにする。新規作成画面では、まず保存してからプレビュー・公開操作が利用できる。
6. 「プレビュー」で表示と画像順序を確認する。別の未ログインブラウザーでは詳細が404、一覧・検索には出ないことを確認する。
7. 「今すぐ公開」で公開し、一般表示に反映されることを確認する。
8. ギャラリーや本文を変更して保存する。プレビューだけが新しくなり、一般表示は公開版を保つことを確認。「変更を公開」で更新する。
9. 非公開化し、一般表示から消えることを確認する。操作の間に再起動やビルドは不要。

**完了条件：非エンジニアがエンジニアの介入なしに、管理画面で製作実績・画像を追加し、下書き確認・並び替え・公開できること。ユーザーによる管理画面の最終確認も完了しています。**

## 検証結果（2026-10-31）

| 検証                                                             | 結果                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 公開3事例、長文、日本語、任意項目なし                            | API/HTTP確認済み                                           |
| 画像の標準アップロード・R2配信・Astro画像配信・alt・キャプション | API/HTTP確認済み                                           |
| 管理画面から新規作成・画像選択・ギャラリー追加・必須画像エラー   | ブラウザー実操作で確認済み                                 |
| 管理画面でドラッグ並び替え・保存・公開                           | ブラウザー実操作＋API/HTTPで順序保持を確認済み             |
| ギャラリー行削除を更新下書きとして保存、公開版は維持             | ブラウザー実操作＋API/HTTPで確認済み                       |
| 下書き・署名プレビュー・公開・更新下書き・再公開・非公開化       | 標準API/HTTP確認済み。フロー内で再起動・再ビルドなし       |
| 改ざん・期限切れ・別記事の署名、noindex/private/no-store         | API/HTTP確認済み                                           |
| SEOタイトル・説明の上書き、summaryフォールバック、canonical      | API/HTTP確認済み                                           |
| 一覧12件＋次ページ、公開日降順・重複なし                         | 13件の一時事例を追加して確認済み                           |
| 日本語部分一致検索、非公開時に検索から消える                     | trigram設定後に確認済み                                    |
| サイトマップの公開works・下書き除外                              | 確認済み                                                   |
| 404、空一覧200、取得失敗503                                      | 確認済み。空一覧・取得失敗は一時注入し、元コードへ復元済み |
| 末尾スラッシュ308とクエリ保持                                    | 確認済み                                                   |
| 既存news、ホーム、About、カテゴリ・タグ、旧posts転送             | HTTP回帰確認済み                                           |
| 既存ec_posts/ec_pagesの全行                                      | 変更前バックアップとの一致を確認済み                       |
| schema/demo再実行で既存事例を保持                                | 確認済み                                                   |
| seed検証・format・lint・型検査・build                            | 成功。ビルドはEmDash管理画面の大きなチャンク警告あり       |
| 管理画面からのファイルアップロードとユーザー自身の一連操作       | ユーザーによる管理画面の最終確認OK。API検証と別に確認      |
| Workers/D1/R2のリモート検証・本番デプロイ                        | 未実施                                                     |

ページ送り用13件は復元可能なゴミ箱へ移動済みです。途中の検証記事もゴミ箱へ整理し、最終のライフサイクル検証記事と`phase2-admin-check`は下書きとして残しています。メディアは削除していません。

ページ送り検証を再現する場合：

```sh
bun scripts/phase2-works.ts pagination
# /works/ と「次のページ」を確認
bun scripts/phase2-works.ts cleanup-pagination
```

生成IDは`.wrangler/phase2-pagination.json`に保存されます。整理はそのIDと接頭辞を確認してからソフト削除します。記録ファイルが残っていると次の追加バッチを止めるため、再検証時は前回分が整理済みであることを確認し、その記録を別名で退避してから実行してください。

## バックアップ・戻し方

適用前の状態は`.wrangler/backups/20261031-101118-phase2/`。同じチェックアウトの2つの開発プロセスを停止し、`.wrangler/state`全体（D1/R2、WAL/SHM、blobを含む）をコピーしました。コンテンツD1とR2のSQLite整合性検査は成功しています。`phase1-content.json`に既存記事の比較記録があります。バックアップ・セッション・検証記録はGit対象外です。

通常の取り消しは、worksへのリンクを外し、works依存コードを戻す方法を優先します。作品データや画像の削除は不要です。全データを復元する場合は開発サーバーを停止し、その時点のデータも退避してからバックアップの`v3`を`.wrangler/state/v3`へ戻します。稼働中のDBを差し替えず、バックアップ内の補助JSONをstateへ混ぜないでください。

## 後続環境と参照先

リモートの接続先・権限・バックアップ・検証URLを確定してから、モデル追加→コード反映→画像とデモ登録→公開フロー検証の順に進めます。今回のローカル専用スクリプトはリモートへ接続しません。Workersでは署名プレビュー、画像オリジン、セッション、公開更新とキャッシュ無効化を別途確認する必要があります。

公式MCP `search_docs`とインストール版の型・コードを照合しました。

- [Collections and fields](https://docs.emdashcms.com/concepts/collections/)
- [Repeater field](https://docs.emdashcms.com/reference/field-types/#repeater)
- [Seed files / media references](https://docs.emdashcms.com/themes/seed-files/)
- [Schema evolution](https://docs.emdashcms.com/deployment/schema-evolution/)
- [Search tokenizers](https://docs.emdashcms.com/reference/rest-api/#search-tokenizers)
- [フェーズ1の手順と検証記録](phase1-news.md)
