import type { Page } from "../../emdash-env";

/** Shared by the company page and footer; empty fields are never invented. */
export function companyRows(page: Page | undefined, siteTitle: string) {
	if (!page) return [];
	return [
		{ label: "会社名", value: siteTitle },
		...(page.company_facts ?? []),
		{ label: "郵便番号", value: page.postal_code },
		{ label: "所在地", value: page.address },
		{ label: "電話番号", value: page.phone },
		{ label: "営業時間", value: page.business_hours },
	].filter((row) => row.value?.trim());
}

export function slashRedirect(url: URL) {
	const target = new URL(url);
	target.pathname += "/";
	return target.pathname + target.search;
}
