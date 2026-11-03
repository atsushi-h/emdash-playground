import { readdirSync } from "node:fs";

const site = process.env.EMDASH_SITE_URL;
if (!site || new URL(site).protocol !== "https:") throw new Error("EMDASH_SITE_URL must be HTTPS");

// No cookies, Access tokens or redirects: test the public entry points directly.
const asset = readdirSync(new URL("../dist/client/_astro/", import.meta.url)).find((name) =>
	/\.(css|js)$/.test(name),
);
if (!asset) throw new Error("No built static asset found for anonymous access check");
const paths = [
	"/",
	"/news/",
	"/works/",
	"/_emdash/admin",
	"/_emdash/api/content/posts",
	"/_emdash/api/media/file/private-access-check.jpg",
	`/_astro/${asset}`,
];
for (const path of paths) {
	const response = await fetch(new URL(path, site), {
		redirect: "manual",
		signal: AbortSignal.timeout(30_000),
	});
	if (![302, 303, 401, 403].includes(response.status))
		throw new Error(`Anonymous access check failed: ${path} returned ${response.status}`);
	if ([302, 303].includes(response.status)) {
		const location = new URL(response.headers.get("location"), site);
		const allowedHosts = [new URL(site).hostname, process.env.CF_ACCESS_TEAM_DOMAIN];
		if (
			location.protocol !== "https:" ||
			!allowedHosts.includes(location.hostname) ||
			!location.pathname.startsWith("/cdn-cgi/access/")
		)
			throw new Error(`Unexpected authentication redirect: ${path}`);
	}
	await response.body?.cancel();
	console.log(`Anonymous access blocked: ${path} (${response.status})`);
}
