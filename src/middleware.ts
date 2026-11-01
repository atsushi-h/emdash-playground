import { defineMiddleware } from "astro:middleware";
import { getSiteChrome } from "./utils/site-chrome";
import { contentUnavailable } from "./utils/news";

export const onRequest = defineMiddleware(async (context, next) => {
	// Leave EmDash's admin/API/media/preview verification middleware in charge.
	const path = context.url.pathname;
	if (
		path === "/_emdash" ||
		path.startsWith("/_emdash/") ||
		path.startsWith("/_astro/") ||
		path === "/_image"
	)
		return next();
	const chrome = await getSiteChrome();
	if (!chrome) return contentUnavailable();
	context.locals.corporateChrome = chrome;
	if (context.cache?.enabled) for (const result of chrome) context.cache.set(result.cacheHint);
	return next();
});
