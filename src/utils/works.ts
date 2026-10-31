/** Entry slugs are public identifiers; database IDs are reserved for API calls. */
export const worksPath = (slug: string) => `/works/${encodeURIComponent(slug)}/`;

export const formatWorkDate = (date: Date) =>
	new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(date);
