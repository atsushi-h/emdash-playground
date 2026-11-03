# Cloudflareへのデプロイと初回移行

[合意した仕様](cloudflare-deployment-spec.md)の実行手順。GitHub Actionsの`Cloudflare`ワークフローを使う。初回のデータ移行は通常のデプロイと分離し、手元のバックアップから一度だけ行う。

## 現在の状態

コードとワークフローは実装済み。実際のCloudflareアカウントでの設定・初回デプロイ・データ移行・Googleログインの検証は未実施。

2026-11-03のローカル検証では、format・lint・型チェック（診断0件）、設定生成の4テスト、本番向けビルド、Wrangler dry-runが成功した。Miniflareで本番URLを再現し、トップ・管理画面・メディア・静的ファイルへの未認証要求がAccessへリダイレクトされ、偽造JWTが403になることを確認した。これは実際のGoogleログインや移行後の表示検証を代替しない。

既存のCLIログインに表示された`supa.app`と`supateam`は今回のデプロイ先ではない。どちらにもリソースを作らない。目的のアカウントのIDと資格情報を設定してから進める。

## 1. Cloudflareリソースを準備する

対象アカウントのダッシュボードで、以下を作成または確認する。

- Workersのサブドメインと、利用するWorker名。URLは`https://<Worker名>.<サブドメイン>.workers.dev`。
- D1データベース。名前とDatabase IDを控える。
- R2バケット。R2の利用開始手続きを完了する。**公開アクセス（r2.devとカスタムドメイン）は無効のまま**にする。
- Astroのセッション用KV名前空間。Namespace IDを控える。
- Zero Trustの組織とチームドメイン（`<チーム名>.cloudflareaccess.com`）。

リソースの作成はデプロイとは別に行う。本番設定はD1とKVのIDを必須とし、名前だけから別リソースを自動作成させない。Sandboxプラグイン用のWorker Loaderは今回追加しない。

R2の無料枠超過分は従量課金される。画像配信は元の画像を返す構成とし、AstroのCloudflare Imagesバインディングは追加しない。全リクエストをWorkerに通すため、画像・静的ファイルのアクセスもWorkersの利用量に含めて見積もる。

## 2. GoogleとCloudflare Accessを設定する

1. [Google IdP設定](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/)に従い、GoogleのOAuthクライアントを作る。リダイレクト先はチームドメインの`/cdn-cgi/access/callback`。
2. GoogleのClient IDとClient SecretをCloudflare Zero TrustのGoogle IdPへ登録する。Client SecretはGitやチャットへ貼らない。
3. 対象の`<Worker名>.<サブドメイン>.workers.dev`全体を対象とするSelf-hosted Accessアプリを作る。パスで管理画面だけに限定しない。ホスト名を先に確定して、Workerの初回デプロイ前に設定する。
4. 再利用可能なAllowポリシーを作り、Includeは指定した本人のメールアドレス1件だけにする。メールアドレスのドメイン全体やEveryoneは許可しない。RequireでGoogleのLogin Methodを指定する。
5. アプリにそのポリシーを付け、ログイン方法をGoogleだけにする。One-time PIN、Bypass、Service Authによる例外は追加しない。
6. Application Audience（AUD）Tagを控える。チームドメインとAUDはEmDashとWorkerの両方で使う。

Worker側でもAccessの署名・issuer・audienceを検証し、許可メールアドレスと照合する。設定不足なら503、無効な資格情報や許可外のメールアドレスなら403とし、CMSを呼ばない。`assets.run_worker_first: true`で静的ファイルにもこの検証を通す。プレビューURLは無効にする。既存バケットの公開設定をWorkerコードから変更することはないため、R2の非公開設定は別途確認する。

EmDashは本番ビルド時にAccess認証を有効にする。許可された本人だけが通過する前提で管理者ロール（50）を割り当てる。ローカル開発は従来の認証を維持する。将来、閲覧だけのユーザーを追加する場合は、先にこの権限設定を変更する。

## 3. GitHub Actionsの設定

GitHubに`production` Environmentを作り、デプロイ可能なブランチを`main`に制限する。

EnvironmentのVariablesへ以下を登録する。これらは秘密鍵ではない。

| Variable                  | 値                                                |
| ------------------------- | ------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`   | 対象のCloudflareアカウントID                      |
| `CF_WORKER_NAME`          | Worker名                                          |
| `CF_D1_DATABASE_NAME`     | D1名                                              |
| `CF_D1_DATABASE_ID`       | D1のUUID                                          |
| `CF_R2_BUCKET_NAME`       | 非公開R2バケット名                                |
| `CF_SESSION_NAMESPACE_ID` | セッション用KVのID                                |
| `CF_ACCESS_TEAM_DOMAIN`   | `<チーム名>.cloudflareaccess.com`（スキームなし） |
| `CF_ACCESS_AUDIENCE`      | 対象Accessアプリの64桁AUD                         |
| `CF_ALLOWED_EMAIL`        | ヒアリングで指定した本人のGoogleメールアドレス    |
| `EMDASH_SITE_URL`         | 対象WorkerのHTTPSオリジン（パスなし）             |

EnvironmentのSecretへ`CLOUDFLARE_API_TOKEN`を登録する。対象アカウントに限定した、Workers Scriptsの編集、D1・R2・KVへのデプロイに必要な権限を持つトークンを使う。リソースは事前作成する。Access設定はダッシュボードで行うため、このデプロイトークンにAccessの編集権限を付ける必要はない。権限名と要件は[Wranglerの権限ドキュメント](https://developers.cloudflare.com/workers/authorization/workers/#wrangler)と実行エラーで確認する。

リポジトリVariableの`PRODUCTION_DEPLOY_ENABLED`は、初回検証が終わるまで未設定または`false`とする。この変数はジョブ開始前の条件判定に使うため、Environmentではなく**リポジトリ**に登録する。

PRと`main`のチェックジョブはSecretsなしでformat・lint・型チェック・テスト・Access有効の本番相当ビルド・Wrangler dry-runを実行する。テスト用設定は架空のIDで、実リソースを操作しない。デプロイジョブはチェック成功後にのみ実行し、トークンはアップロードのステップだけへ渡す。

## 4. 移行元をバックアップする

この作業用チェックアウトには元のCMSデータがない。元の開発環境のチェックアウトと、そこで使っていた開発サーバーのポートを特定する。空の開発サーバーを起動して移行元と取り違えない。

1. 元の管理画面で記事数・画像・現在の内容を確認する。
2. 編集を止め、元の開発サーバーを停止する。ローカルD1/R2がある`.wrangler/state`をまとめてバックアップする。別構成ならDBとuploadsも対象にする。SQLiteはWALを含めて停止状態で保存する。
3. 復元は元と同じ構成・バージョンのチェックアウトへ戻して行う。バックアップの一式と元の設定を手元で保管する。
4. 元の開発サーバーだけを再起動し、編集を止めたままサイトパッケージをエクスポートする。

以下は元のチェックアウトで実行する例。ポートは実際の元サーバーに合わせる。

```bash
mkdir -p backups
bunx emdash site export --url http://127.0.0.1:4322 --output backups/site.emdash
shasum -a 256 backups/site.emdash > backups/site.emdash.sha256
```

サイトパッケージにはモデル・コンテンツ・履歴・設定・画像を含むが、ユーザー・認証情報・Secretsは含まれない。著者等のメールアドレスや下書きが含まれるため、GitHub ActionsのArtifactやリポジトリへアップロードしない。`backups/`と`*.emdash`はGitから除外している。復旧用の元データバックアップと、移行用パッケージは両方保管する。

## 5. 初回はActionsから手動デプロイする

1. ワークフローを`main`へ取り込む。`PRODUCTION_DEPLOY_ENABLED`が無効であることを確認する。
2. Actions → Cloudflare → Run workflowで`main`を選ぶ。
3. 成功後の匿名アクセスチェック結果を見る。未認証で本文を読めず、Accessへ誘導されることを確認する。
4. 許可したGoogleアカウントで`/_emdash/admin`に入り、管理者になっていることを確認する。
5. 初期設定が表示されたら、サンプルコンテンツを追加せず完了する。本番ビルドにはサンプル記事を含まないseedを埋め込んでいる。
6. 本番の管理画面でSettings → Transferを開き、手元の`site.emdash`をアップロードする。
7. 分析結果のBlockers・Warnings・変換内容・除去する初期設定を確認し、著者を本番の自分のユーザーへ対応付ける。`dev@emdash.local`等のローカルユーザーはそのまま移行されない。
8. 分析した計画を確認してからStart importを実行し、Verifiedの受領証を保存する。既存データがあると分析がブロックされる。DBの初期化や再seedで回避しない。

CLIを使う場合も、`site import --analyze`で計画を確認した後、表示されたdigestを`--plan`へ渡して`--confirm`する。Access配下のCLI認証には別途ブラウザー認証が必要なため、初回は本人のGoogleログイン済み管理画面での移行を推奨する。移行用のService Auth例外は作らない。

移行中は公開側の読み取りまで自動停止するわけではないが、Accessで自分以外を拒否した状態を維持する。失敗した移行はデータを部分的に残すことがある。自動リセットせず、状態と受領証を調べて公式の復旧手順を選ぶ。

## 6. 受け入れ確認と自動デプロイの有効化

- 未認証と許可外Googleアカウントで、トップ・記事・管理画面・API・実在する画像URLへアクセスできない。
- 実在する`/_astro/`のCSSやJavaScriptも、Cookieなしでは取得できない。R2の公開URLやプレビューURLから迂回できない。
- 本人のGoogleログインで記事と画像を表示でき、管理画面で記事更新・画像アップロードができる。
- 移行前後の記事数・固定ページ・製作実績・画像・メニュー等を照合する。
- 下書きとプレビューの分離、検索、予約公開、メンテナンスCronを確認する。
- 本番で記事と画像を更新した後、もう一度Actionsから手動デプロイし、更新内容と画像が保持される。
- すべて成功したら、リポジトリVariableの`PRODUCTION_DEPLOY_ENABLED`を文字列`true`にする。

以後は`main`更新で自動デプロイする。PRはチェックとビルドだけを実行する。通常デプロイにはバックアップ・インポート・DB初期化のコマンドを入れていない。

コードのロールバックはWorkersの既存バージョンへ戻す。D1/R2のデータはそれだけでは戻らないため、本番データを変更する作業の前には別途バックアップする。自動デプロイを止めるには`PRODUCTION_DEPLOY_ENABLED`を`false`へ戻す。Accessの保護は維持する。

## 手元での検証

```bash
bun install --frozen-lockfile
bun run types:bindings
bun run check
bun run test
```

本番ビルドは上記Variablesと同名の環境変数を設定して`bun run build:production`を実行する。`wrangler.production.json`と`.emdash/seed.json`は生成物で、Gitへ追加しない。`.emdash/seed.json`がある間はローカル開発でもサンプル記事なしのseedが優先される。既存DBへの再適用はしない。通常のローカルseedへ戻すときは、生成したファイルだけを削除する。

既存のカスタム`.emdash/seed.json`が生成予定の内容と異なる場合、設定生成は上書きせず失敗する。カスタムseedをバックアップしてから、クリーンなチェックアウトで本番ビルドする。元のseedやDBを削除して回避しない。

```bash
bunx wrangler deploy --config dist/server/wrangler.json --dry-run
```

dry-runはバンドルと設定の検証であり、実際の認証やD1/R2の動作を保証しない。本番の接続先と資格情報が揃ってから、上記の受け入れ確認を行う。

## 公式資料

- [EmDash Access連携](https://docs.emdashcms.com/guides/authentication/#cloudflare-access)
- [EmDashサイト移行](https://docs.emdashcms.com/guides/site-transfer/)
- [Cloudflare AccessとWorkers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [静的ファイルより先にWorkerを実行](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [R2の利用開始](https://developers.cloudflare.com/r2/get-started/)
