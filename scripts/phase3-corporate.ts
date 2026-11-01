/** Additive local setup. Never re-seeds a database or overwrites an existing page. */
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { LocalEmDash } from "./phase2-works";

const [command, origin] = process.argv.slice(2);
if (!["schema", "drafts", "publish"].includes(command) || !origin)
	throw new Error(
		"Usage: bun scripts/phase3-corporate.ts schema|drafts|publish http://127.0.0.1:PORT",
	);
const client = new LocalEmDash(origin);
const seed = JSON.parse(await readFile(new URL("../seed/seed.json", import.meta.url), "utf8"));
const model = seed.collections.find((item: { slug: string }) => item.slug === "pages");
const fixtures = seed.content.pages.filter((item: { slug: string }) =>
	["company", "services", "privacy", "contact"].includes(item.slug),
);
await client.login();

if (command === "schema") {
	const { item: collection } = await client.request("schema/collections/pages");
	if (!isDeepStrictEqual([...collection.supports].sort(), [...model.supports].sort()))
		throw new Error("Existing pages supports differ; inspect before applying.");
	if (!["/{slug}", "/{slug}/"].includes(collection.urlPattern))
		throw new Error("Existing pages URL pattern differs.");
	const current = (await client.request("schema/collections/pages/fields")).items;
	// Validate the whole model before making changes.
	for (const field of model.fields) {
		const found = current.find((item: { slug: string }) => item.slug === field.slug);
		if (
			found &&
			(found.type !== field.type ||
				found.required !== !!field.required ||
				!isDeepStrictEqual(found.validation ?? null, field.validation ?? null))
		)
			throw new Error(`Existing field differs: ${field.slug}`);
	}
	await client.request("schema/collections/pages", "PUT", {
		label: model.label,
		labelSingular: model.labelSingular,
		description: model.description,
		urlPattern: model.urlPattern,
	});
	for (const [sortOrder, field] of model.fields.entries()) {
		const found = current.find((item: { slug: string }) => item.slug === field.slug);
		if (found) {
			await client.request(`schema/collections/pages/fields/${field.slug}`, "PUT", {
				label: field.label,
			});
		} else await client.request("schema/collections/pages/fields", "POST", { ...field, sortOrder });
	}
	for (const menuModel of seed.menus) {
		const menus = await client.request("menus");
		if (!menus.some((item: { name: string }) => item.name === menuModel.name))
			await client.request("menus", "POST", { name: menuModel.name, label: menuModel.label });
		const menu = await client.request(`menus/${menuModel.name}`);
		for (const [sortOrder, item] of menuModel.items.entries()) {
			const found = menu.items.find(
				(old: { customUrl?: string; url?: string }) =>
					(old.customUrl ?? old.url) === item.url ||
					(item.url === "/company/" && (old.customUrl ?? old.url) === "/about/"),
			);
			const body = { type: "custom", label: item.label, customUrl: item.url, sortOrder };
			if (found)
				await client.request(`menus/${menuModel.name}/items/${found.id}`, "PUT", {
					label: item.label,
					customUrl: item.url,
					sortOrder,
				});
			else
				await client.request(`menus/${menuModel.name}/items`, "POST", {
					...body,
					sortOrder: menu.items.length + sortOrder,
				});
		}
		const updated = await client.request(`menus/${menuModel.name}`);
		const planned = menuModel.items.map((item: { url: string }) =>
			updated.items.find(
				(old: { customUrl?: string; url?: string }) => (old.customUrl ?? old.url) === item.url,
			),
		);
		const extras = updated.items.filter(
			(item: { id: string }) => !planned.some((known: { id: string }) => known.id === item.id),
		);
		await client.request(`menus/${menuModel.name}/reorder`, "POST", {
			items: [...planned, ...extras].map((item, sortOrder) => ({
				id: item.id,
				parentId: item.parentId ?? null,
				sortOrder,
			})),
		});
	}
	await client.request("search/enable", "POST", {
		collection: "pages",
		enabled: true,
		tokenize: "trigram",
	});
	console.log("Pages schema, menus and Japanese search ready. Existing content preserved.");
} else {
	for (const fixture of fixtures) {
		const { items } = await client.request(`content/pages?search=${fixture.slug}&limit=100`);
		const found = items.find((item: { slug: string }) => item.slug === fixture.slug);
		if (command === "drafts") {
			if (found) {
				console.log(`Preserved existing page: ${fixture.slug}`);
				continue;
			}
			await client.request("content/pages", "POST", {
				slug: fixture.slug,
				status: "draft",
				data: fixture.data,
			});
			console.log(`Created draft: ${fixture.slug}`);
		} else {
			if (!found) throw new Error(`Missing draft: ${fixture.slug}`);
			const { item } = await client.request(`content/pages/${found.id}`);
			if (item.status === "published") {
				console.log(`Already published: ${fixture.slug}`);
				continue;
			}
			if (!isDeepStrictEqual(item.data, fixture.data))
				throw new Error(
					`Page content differs from reviewed seed; publish manually: ${fixture.slug}`,
				);
			await client.request(`content/pages/${found.id}/publish`, "POST", {});
			console.log(`Published PoC page: ${fixture.slug}`);
		}
	}
}
