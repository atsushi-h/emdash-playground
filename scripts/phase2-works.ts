/** Local PoC setup only. Uses EmDash's standard authenticated API, never direct SQL. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export class LocalEmDash {
	cookie = "";
	constructor(public origin = "http://127.0.0.1:4322") {
		const url = new URL(origin);
		if (url.origin !== origin || url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
			throw new Error("This fixture tool only accepts an explicit http://127.0.0.1:PORT origin.");
		}
	}
	async login() {
		const response = await fetch(`${this.origin}/_emdash/api/auth/dev-bypass`);
		if (!response.ok) throw new Error(`Development login failed: ${response.status}`);
		this.cookie = response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		if (!this.cookie) throw new Error("Development login returned no session.");
	}
	async request(path: string, method = "GET", body?: unknown) {
		const form = body instanceof FormData;
		const options: RequestInit = {
			method,
			headers: {
				Cookie: this.cookie,
				Origin: this.origin,
				"X-EmDash-Request": "1",
				...(body !== undefined && !form ? { "Content-Type": "application/json" } : {}),
			},
		};
		if (body !== undefined) {
			if (method === "GET" || method === "HEAD")
				throw new Error("Read requests cannot have a body.");
			options.body = form ? body : JSON.stringify(body);
		}
		const response = await fetch(`${this.origin}/_emdash/api/${path}`, options);
		const text = await response.text();
		if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
		return text ? JSON.parse(text).data : null;
	}
}

async function setupSchema(client: LocalEmDash) {
	const seed = JSON.parse(await readFile(resolve(projectRoot, "seed/seed.json"), "utf8"));
	const { fields, ...collection } = seed.collections.find(
		(item: { slug: string }) => item.slug === "works",
	);
	const { items } = await client.request("schema/collections");
	const existing = items.find((item: { slug: string }) => item.slug === "works");
	if (!existing) {
		const { items: pages } = await client.request("content/pages?search=works&limit=100");
		if (pages.some((page: { slug: string }) => page.slug === "works"))
			throw new Error("/works/ conflicts with an existing page.");
		await client.request("schema/collections", "POST", collection);
	} else if (
		existing.urlPattern !== collection.urlPattern ||
		JSON.stringify([...existing.supports].sort()) !==
			JSON.stringify([...collection.supports].sort())
	) {
		throw new Error(
			"Existing works collection differs from the reviewed model. No changes applied.",
		);
	}
	const current = (await client.request("schema/collections/works/fields")).items;
	for (const [sortOrder, field] of fields.entries()) {
		const found = current.find((item: { slug: string }) => item.slug === field.slug);
		if (found) {
			if (
				found.type !== field.type ||
				found.required !== !!field.required ||
				!isDeepStrictEqual(found.validation ?? null, field.validation ?? null) ||
				found.searchable !== !!field.searchable
			)
				throw new Error(`Existing field differs: ${field.slug}`);
			continue;
		}
		await client.request("schema/collections/works/fields", "POST", { ...field, sortOrder });
	}
	// Collection creation records supports but does not build the FTS index.
	// Trigram supports Japanese substring queries of at least three characters.
	await client.request("search/enable", "POST", {
		collection: "works",
		enabled: true,
		tokenize: "trigram",
	});
	const menu = await client.request("menus/primary");
	if (
		!menu.items.some(
			(item: { customUrl?: string; url?: string }) => (item.customUrl ?? item.url) === "/works/",
		)
	) {
		await client.request("menus/primary/items", "POST", {
			type: "custom",
			label: "製作実績",
			customUrl: "/works/",
			sortOrder: menu.items.length,
		});
	}
	console.log("works schema and navigation ready (existing content preserved).");
}

async function setupDemo(client: LocalEmDash) {
	const fixtures = JSON.parse(
		await readFile(resolve(projectRoot, "fixtures/works/content.json"), "utf8"),
	);
	const media = new Map<string, Promise<string>>();
	async function assets(value: unknown): Promise<unknown> {
		if (Array.isArray(value)) return Promise.all(value.map(assets));
		if (!value || typeof value !== "object") return value;
		if (
			"$asset" in value &&
			typeof value.$asset === "string" &&
			"alt" in value &&
			typeof value.alt === "string"
		) {
			const filename = value.$asset;
			if (!/^[a-z-]+\.png$/.test(filename)) throw new Error("Unexpected asset filename");
			if (!media.has(filename)) {
				const alt = value.alt;
				// Cache the pending upload too: the same asset can occur concurrently
				// in featured_image and gallery before the first request completes.
				media.set(
					filename,
					(async () => {
						const form = new FormData();
						const bytes = await readFile(resolve(projectRoot, "fixtures/works", filename));
						form.set("file", new File([bytes], filename, { type: "image/png" }));
						form.set("alt", alt);
						form.set(
							"caption",
							"ミナトテックPoC用の自作模式図。架空製作例であり実物写真ではありません。",
						);
						form.set("deduplicate", "true");
						const result = await client.request("media", "POST", form);
						return result.item.id;
					})(),
				);
			}
			return { id: await media.get(filename)!, alt: value.alt };
		}
		return Object.fromEntries(
			await Promise.all(
				Object.entries(value).map(async ([key, item]) => [key, await assets(item)]),
			),
		);
	}
	for (const fixture of fixtures) {
		const existing = await client.request(
			`content/works?search=${encodeURIComponent(fixture.slug)}&limit=100`,
		);
		if (existing.items.some((item: { slug: string }) => item.slug === fixture.slug)) {
			console.log(`Preserved existing entry: ${fixture.slug}`);
			continue;
		}
		const created = await client.request("content/works", "POST", {
			slug: fixture.slug,
			status: "draft",
			data: await assets(fixture.data),
		});
		if (fixture.status === "published")
			await client.request(`content/works/${created.item.id}/publish`, "POST", {});
		console.log(`Created ${fixture.status}: ${fixture.slug}`);
	}
}

async function pagination(client: LocalEmDash, cleanup: boolean) {
	const manifestPath = resolve(projectRoot, ".wrangler/phase2-pagination.json");
	if (cleanup) {
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		if (manifest.origin !== client.origin) throw new Error("Manifest belongs to another origin.");
		for (const id of manifest.ids) {
			const { item } = await client.request(`content/works/${id}`);
			if (!item.slug.startsWith(manifest.prefix)) throw new Error("Fixture identity mismatch");
			await client.request(`content/works/${id}`, "DELETE");
		}
		console.log(
			`Moved ${manifest.ids.length} pagination fixtures to recoverable trash. Media retained.`,
		);
		return;
	}
	try {
		await readFile(manifestPath);
		throw new Error(
			"Pagination manifest already exists; review its entries before creating another batch.",
		);
	} catch (error) {
		if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
	}
	const { item: sample } = await client.request("content/works/positioning-jig");
	const manifest = {
		origin: client.origin,
		prefix: `phase2-page-${Date.now()}-`,
		ids: [] as string[],
	};
	await mkdir(resolve(projectRoot, ".wrangler"), { recursive: true });
	for (let i = 1; i <= 13; i++) {
		const created = await client.request("content/works", "POST", {
			slug: `${manifest.prefix}${i}`,
			status: "draft",
			data: {
				title: `ページ送り検証用 ${i}`,
				summary: "一時的な架空の検証データです。",
				featured_image: sample.data.featured_image,
			},
		});
		manifest.ids.push(created.item.id);
		await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
		await client.request(`content/works/${created.item.id}/publish`, "POST", {});
	}
	console.log("Created 13 pagination fixtures; run cleanup-pagination after verification.");
}

if (import.meta.main) {
	const [command, origin] = process.argv.slice(2);
	if (!["schema", "demo", "pagination", "cleanup-pagination"].includes(command)) {
		throw new Error(
			"Usage: bun scripts/phase2-works.ts schema|demo|pagination|cleanup-pagination [http://127.0.0.1:4322]",
		);
	}
	const client = new LocalEmDash(origin);
	await client.login();
	if (command === "schema") await setupSchema(client);
	else if (command === "demo") await setupDemo(client);
	else await pagination(client, command === "cleanup-pagination");
}
