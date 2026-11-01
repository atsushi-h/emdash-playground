import { getEmDashEntry, getMenuWithCacheHint, getSiteSettingsWithCacheHint } from "emdash";

/** Resolve shared CMS dependencies before Astro starts streaming page HTML. */
export async function getSiteChrome() {
	const result = await Promise.all([
		getSiteSettingsWithCacheHint(),
		getMenuWithCacheHint("primary"),
		getMenuWithCacheHint("footer"),
		getEmDashEntry("pages", "company"),
	]).catch(() => null);
	return !result || result[3].error ? null : result;
}
export type SiteChrome = NonNullable<Awaited<ReturnType<typeof getSiteChrome>>>;
