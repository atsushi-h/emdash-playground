import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const command = new URL("./production-config.mjs", import.meta.url);
const settings = {
	PATH: process.env.PATH,
	CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
	CF_WORKER_NAME: "private-cms",
	CF_D1_DATABASE_NAME: "private-cms",
	CF_D1_DATABASE_ID: "11111111-2222-4333-8444-555555555555",
	CF_R2_BUCKET_NAME: "private-cms-media",
	CF_SESSION_NAMESPACE_ID: "b".repeat(32),
	CF_ACCESS_TEAM_DOMAIN: "private-team.cloudflareaccess.com",
	CF_ACCESS_AUDIENCE: "c".repeat(64),
	CF_ALLOWED_EMAIL: "owner@example.com",
	EMDASH_SITE_URL: "https://private-cms.example.workers.dev",
};

test("production config refuses missing settings without writing a deployable file", () => {
	const directory = mkdtempSync(join(tmpdir(), "emdash-config-"));
	try {
		const result = spawnSync(process.execPath, [command.pathname, directory], {
			env: { PATH: process.env.PATH },
			encoding: "utf8",
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /CLOUDFLARE_ACCOUNT_ID/);
		assert.throws(() => readFileSync(join(directory, "wrangler.production.json")));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("production config pins resources, protects static assets and leaves import target empty", () => {
	const directory = mkdtempSync(join(tmpdir(), "emdash-config-"));
	try {
		const result = spawnSync(process.execPath, [command.pathname, directory], {
			env: settings,
			encoding: "utf8",
		});
		assert.equal(result.status, 0, result.stderr);
		const config = JSON.parse(readFileSync(join(directory, "wrangler.production.json"), "utf8"));
		assert.equal(config.name, "private-cms");
		assert.equal(config.account_id, settings.CLOUDFLARE_ACCOUNT_ID);
		assert.equal(config.preview_urls, false);
		assert.equal(config.assets.run_worker_first, true);
		assert.deepEqual(config.d1_databases, [
			{
				binding: "DB",
				database_name: "private-cms",
				database_id: settings.CF_D1_DATABASE_ID,
			},
		]);
		assert.deepEqual(config.r2_buckets, [{ binding: "MEDIA", bucket_name: "private-cms-media" }]);
		assert.deepEqual(config.kv_namespaces, [
			{ binding: "SESSION", id: settings.CF_SESSION_NAMESPACE_ID },
		]);
		assert.equal(config.vars.CF_ALLOWED_EMAIL, "owner@example.com");
		assert.equal(config.vars.CF_ACCESS_AUDIENCE, settings.CF_ACCESS_AUDIENCE);
		assert.equal(config.vars.CF_ACCESS_TEAM_DOMAIN, "private-team.cloudflareaccess.com");
		const seed = JSON.parse(readFileSync(join(directory, ".emdash/seed.json"), "utf8"));
		assert.deepEqual(seed.content, undefined);
		assert.ok(seed.collections.some((collection) => collection.slug === "works"));
		assert.equal("CLOUDFLARE_API_TOKEN" in config.vars, false);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("production config rejects untrusted origins and malformed resource or Access identifiers", () => {
	for (const [name, value] of [
		["EMDASH_SITE_URL", "http://private-cms.example.workers.dev"],
		["EMDASH_SITE_URL", "https://attacker.example"],
		["EMDASH_SITE_URL", "https://other.example.workers.dev"],
		["EMDASH_SITE_URL", "https://private-cms.example.workers.dev/path"],
		["CF_ACCESS_TEAM_DOMAIN", "attacker.example/path"],
		["CF_ACCESS_AUDIENCE", "not-an-audience"],
		["CF_D1_DATABASE_ID", "create-a-new-database"],
		["CF_SESSION_NAMESPACE_ID", "create-a-new-namespace"],
		["CF_ALLOWED_EMAIL", "*@example.com"],
	]) {
		const directory = mkdtempSync(join(tmpdir(), "emdash-config-"));
		try {
			const result = spawnSync(process.execPath, [command.pathname, directory], {
				env: { ...settings, [name]: value },
				encoding: "utf8",
			});
			assert.notEqual(result.status, 0, `${name} accepted ${value}`);
			assert.match(result.stderr, new RegExp(name));
			assert.throws(() => readFileSync(join(directory, "wrangler.production.json")));
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}
});

test("production config preserves an existing custom seed instead of overwriting it", () => {
	const directory = mkdtempSync(join(tmpdir(), "emdash-config-"));
	const original = '{"version":"1","settings":{"title":"My exported site"}}';
	try {
		mkdirSync(join(directory, ".emdash"));
		writeFileSync(join(directory, ".emdash/seed.json"), original);
		const result = spawnSync(process.execPath, [command.pathname, directory], {
			env: settings,
			encoding: "utf8",
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /existing.*seed/i);
		assert.equal(readFileSync(join(directory, ".emdash/seed.json"), "utf8"), original);
		assert.throws(() => readFileSync(join(directory, "wrangler.production.json")));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
