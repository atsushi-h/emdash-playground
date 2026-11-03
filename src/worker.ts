import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";
import { authenticate } from "@emdash-cms/cloudflare/auth";
import { env } from "cloudflare:workers";

export { PluginBridge };

export default {
	...handler,
	async fetch(request, bindings, ctx) {
		if (import.meta.env.DEV) return handler.fetch!(request, bindings, ctx);
		const { CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUDIENCE, CF_ALLOWED_EMAIL, EMDASH_SITE_URL } = env;
		const headers = { "Cache-Control": "private, no-store", "Content-Type": "text/plain" };
		// Deny all deployed traffic until the complete production configuration exists.
		if (!CF_ACCESS_TEAM_DOMAIN || !CF_ACCESS_AUDIENCE || !CF_ALLOWED_EMAIL || !EMDASH_SITE_URL)
			return new Response("Private site is not configured", { status: 503, headers });
		const url = new URL(request.url);
		if (url.origin !== EMDASH_SITE_URL)
			return new Response("Unknown site origin", { status: 403, headers });
		if (
			!request.headers.has("Cf-Access-Jwt-Assertion") &&
			!/(?:^|;\s*)CF_Authorization=/.test(request.headers.get("Cookie") ?? "")
		) {
			const login = new URL(
				`https://${CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/login/${url.hostname}`,
			);
			login.searchParams.set("kid", CF_ACCESS_AUDIENCE);
			login.searchParams.set("redirect_url", url.href);
			return new Response(null, { status: 302, headers: { ...headers, Location: login.href } });
		}
		try {
			const identity = await authenticate(request, {
				teamDomain: CF_ACCESS_TEAM_DOMAIN,
				audience: CF_ACCESS_AUDIENCE,
			});
			if (identity.email.toLowerCase() !== CF_ALLOWED_EMAIL.toLowerCase())
				return new Response("Forbidden", { status: 403, headers });
		} catch {
			return new Response("Invalid Access credentials", { status: 403, headers });
		}
		const response = await handler.fetch!(request, bindings, ctx);
		const privateResponse = new Response(response.body, response);
		privateResponse.headers.set("Cache-Control", "private, no-store");
		return privateResponse;
	},
	scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
