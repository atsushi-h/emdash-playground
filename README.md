# 株式会社ミナトテック 企業サイトPoC

フェーズ1のお知らせ運用を実装しています。一覧は`/news/`、管理画面の内部コレクション名は`posts`です。

フェーズ2では製作実績`works`を追加しました。一覧は`/works/`です。画像付きデモ登録と管理画面の運用・確認手順は[フェーズ2の引き継ぎ資料](docs/phase2-works.md)を参照してください。

起動・既存DBへの適用・検証結果・管理画面での確認手順は[フェーズ1の引き継ぎ資料](docs/phase1-news.md)を参照してください。以下は元テンプレートの説明です。

# EmDash Starter Template (Cloudflare)

A general-purpose starting point for building sites with [EmDash](https://github.com/emdash-cms/emdash) on Cloudflare Workers. Includes posts, pages, categories, and tags with minimal styling -- designed as a base you can build on rather than a finished theme.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/emdash-cms/templates/tree/main/starter-cloudflare)

## What's Included

- Posts with category and tag archives
- Static pages via slug routing
- Seed data with demo content
- D1 database and R2 storage pre-configured

## Pages

| Page             | Route             |
| ---------------- | ----------------- |
| Homepage         | `/`               |
| All posts        | `/posts`          |
| Single post      | `/posts/:slug`    |
| Category archive | `/category/:slug` |
| Tag archive      | `/tag/:slug`      |
| Static pages     | `/:slug`          |
| 404              | fallback          |

## Infrastructure

- **Runtime:** Cloudflare Workers
- **Database:** D1
- **Storage:** R2
- **Framework:** Astro with `@astrojs/cloudflare`

## Local Development

```bash
bun install
bun dev
```

Open http://localhost:4321/_emdash/admin and complete the setup wizard. EmDash runs database migrations and applies the starter seed during setup. The site is available at http://localhost:4321.

## Code Quality

Use the Bun version pinned in `mise.toml` (`mise install` if needed).

```bash
bun run format        # Format files, including .astro
bun run format:check  # Check formatting without writing
bun run lint          # Run Oxlint; fail on warnings
bun run lint:fix      # Apply automatic lint fixes
bun run typecheck     # Check Astro and TypeScript types
bun run check         # Run all three checks
```

Oxfmt formats Astro files with `astro: true` and `@astrojs/compiler-rs`.
Its Astro support uses a bundled Prettier implementation; Prettier and ESLint
are not direct project dependencies. Oxlint checks supported JavaScript and
TypeScript regions of Astro files, not the entire Astro template. `astro check`
provides the complementary Astro and TypeScript diagnostics.

Generated files (`emdash-env.d.ts`, `worker-configuration.d.ts`) and build/runtime
directories are excluded from formatting and linting.

## Deploying

```bash
bun wrangler login
bun run deploy
```

The first deployment provisions the named D1 database and R2 bucket from `wrangler.jsonc`. See [Deploy to Cloudflare](https://docs.emdashcms.com/deployment/cloudflare/) for production setup, or use the deploy button above.

## See Also

- [Node.js variant](../starter) -- same template using SQLite and local file storage
- [All templates](../)
- [EmDash documentation](https://docs.emdashcms.com/)
