// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://madilusantivana.farm",
  integrations: [
    svelte(),
    sitemap({
      filter: (page) => !/\/404\/?$/.test(page),
      i18n: { defaultLocale: "en", locales: { en: "en-IN", kn: "kn-IN" } },
    }),
  ],
  // Fixed so the site and its verifier cannot drift onto another project's port.
  server: { port: 4323 },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "kn"],
    routing: { prefixDefaultLocale: false },
  },
});
