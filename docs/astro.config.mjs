import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "https://chatt-state.github.io",
  base: "/teamdynamix-mcp-server",
  integrations: [tailwind(), mdx()],
  markdown: {
    shikiConfig: {
      themes: {
        dark: "github-dark",
        light: "github-light",
      },
    },
  },
});
