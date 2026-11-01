/** Public URLs use the entry slug, never the database ID. */
export const newsPath = (slug: string) => `/news/${encodeURIComponent(slug)}/`;

export const formatNewsDate = (date: Date) =>
	new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(date);

/** Headers must be set by the route, before Astro renders nested components. */
export function protectPreview(response: { headers: Headers }, url: URL, isPreview = false) {
	if (!isPreview && !url.searchParams.has("_preview")) return;
	response.headers.set("X-Robots-Tag", "noindex, nofollow");
	response.headers.set("Cache-Control", "private, no-store");
}

/** Do not render database errors as an empty list or a missing article. */
export const contentUnavailable = () =>
	new Response("ただいま情報を取得できません。時間をおいて再度お試しください。", {
		status: 503,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Robots-Tag": "noindex",
		},
	});
