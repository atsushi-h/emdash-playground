import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parse } from "jsonc-parser";

const required = [
	"CLOUDFLARE_ACCOUNT_ID",
	"CF_WORKER_NAME",
	"CF_D1_DATABASE_NAME",
	"CF_D1_DATABASE_ID",
	"CF_R2_BUCKET_NAME",
	"CF_SESSION_NAMESPACE_ID",
	"CF_ACCESS_TEAM_DOMAIN",
	"CF_ACCESS_AUDIENCE",
	"CF_ALLOWED_EMAIL",
	"EMDASH_SITE_URL",
];

for (const name of required) {
	if (!process.env[name]?.trim()) throw new Error(`Missing required setting: ${name}`);
}

const settings = Object.fromEntries(required.map((name) => [name, process.env[name].trim()]));
const patterns = {
	CLOUDFLARE_ACCOUNT_ID: /^[a-f0-9]{32}$/,
	CF_WORKER_NAME: /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/,
	CF_D1_DATABASE_NAME: /^[a-z0-9][a-z0-9_-]{0,62}$/,
	CF_D1_DATABASE_ID: /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,
	CF_R2_BUCKET_NAME: /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
	CF_SESSION_NAMESPACE_ID: /^[a-f0-9]{32}$/,
	CF_ACCESS_TEAM_DOMAIN: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/,
	CF_ACCESS_AUDIENCE: /^[a-f0-9]{64}$/,
	CF_ALLOWED_EMAIL: /^[a-z0-9.!#$%&'+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,
};
for (const [name, pattern] of Object.entries(patterns)) {
	if (!pattern.test(settings[name])) throw new Error(`Invalid setting: ${name}`);
}
const site = new URL(settings.EMDASH_SITE_URL);
if (
	site.protocol !== "https:" ||
	site.username ||
	site.password ||
	site.port ||
	site.pathname !== "/" ||
	site.search ||
	site.hash ||
	!new RegExp(`^${settings.CF_WORKER_NAME}\\.[a-z0-9-]+\\.workers\\.dev$`).test(site.hostname)
)
	throw new Error("Invalid setting: EMDASH_SITE_URL (expected this Worker's HTTPS origin)");
settings.EMDASH_SITE_URL = site.origin;
settings.CF_ALLOWED_EMAIL = settings.CF_ALLOWED_EMAIL.toLowerCase();
const base = parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const config = {
	...base,
	name: settings.CF_WORKER_NAME,
	account_id: settings.CLOUDFLARE_ACCOUNT_ID,
	workers_dev: true,
	preview_urls: false,
	assets: { run_worker_first: true },
	d1_databases: [
		{
			binding: "DB",
			database_name: settings.CF_D1_DATABASE_NAME,
			database_id: settings.CF_D1_DATABASE_ID,
		},
	],
	r2_buckets: [{ binding: "MEDIA", bucket_name: settings.CF_R2_BUCKET_NAME }],
	kv_namespaces: [{ binding: "SESSION", id: settings.CF_SESSION_NAMESPACE_ID }],
	vars: {
		CF_ACCESS_TEAM_DOMAIN: settings.CF_ACCESS_TEAM_DOMAIN,
		CF_ACCESS_AUDIENCE: settings.CF_ACCESS_AUDIENCE,
		CF_ALLOWED_EMAIL: settings.CF_ALLOWED_EMAIL,
		EMDASH_SITE_URL: settings.EMDASH_SITE_URL,
	},
};
const directory = resolve(process.argv[2] ?? ".");
const seed = JSON.parse(readFileSync(new URL("../seed/seed.json", import.meta.url), "utf8"));
delete seed.content;
const seedPath = join(directory, ".emdash/seed.json");
const seedText = `${JSON.stringify(seed, null, "\t")}\n`;
if (existsSync(seedPath) && readFileSync(seedPath, "utf8") !== seedText)
	throw new Error("Refusing to overwrite an existing custom seed at .emdash/seed.json");
mkdirSync(join(directory, ".emdash"), { recursive: true });
writeFileSync(seedPath, seedText);
writeFileSync(
	join(directory, "wrangler.production.json"),
	`${JSON.stringify(config, null, "\t")}\n`,
);
