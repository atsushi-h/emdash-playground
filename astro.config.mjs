import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { access, d1, r2 } from "@emdash-cms/cloudflare";
import { readFileSync } from "node:fs";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

const production = process.env.EMDASH_DEPLOYMENT === "production";
const deployment = production
	? JSON.parse(readFileSync(new URL("./wrangler.production.json", import.meta.url), "utf8"))
	: undefined;

export default defineConfig({
	output: "server",
	adapter: cloudflare({
		configPath: production ? "wrangler.production.json" : undefined,
		imageService: "passthrough",
	}),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			...(deployment
				? {
						siteUrl: deployment.vars.EMDASH_SITE_URL,
						auth: access({
							teamDomain: deployment.vars.CF_ACCESS_TEAM_DOMAIN,
							audienceEnvVar: "CF_ACCESS_AUDIENCE",
							defaultRole: 50,
						}),
					}
				: {}),
			database: d1({ binding: "DB", session: "auto", coalesce: true }),
			storage: r2({ binding: "MEDIA" }),
		}),
	],
	devToolbar: { enabled: false },
});
