import type { SiteChrome } from "./utils/site-chrome";

declare global {
	namespace App {
		interface Locals {
			corporateChrome?: SiteChrome;
		}
	}
}
