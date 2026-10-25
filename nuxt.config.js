import { normalizeApiBaseUrl } from "./utils/apiBaseUrl";
import { PAGE_TEMPLATES } from "./data/templates";
const apiBaseUrl = normalizeApiBaseUrl(process.env.NUXT_PUBLIC_API_BASE_URL || "");

export default {
  ssr: true,
  target: "static",
  generate: {
    routes: PAGE_TEMPLATES.map((page) => `/server-pages-preview/${encodeURIComponent(page.type)}`),
    fallback: "200.html",
  },
  head: {
    title: "Server Pages",
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "Customer server page management and previews" },
    ],
    script: [{ src: "/runtime-config.js" }, { src: "/theme-init.js" }],
  },
  css: ["vuetify/dist/vuetify.min.css", "@mdi/font/css/materialdesignicons.min.css", "~/assets/css/app.scss"],
  buildModules: ["@nuxtjs/vuetify"],
  modules: ["@nuxtjs/axios"],
  plugins: ["~/plugins/legacy-client-api-settings.client.js"],
  axios: { baseURL: "", browserBaseURL: "" },
  publicRuntimeConfig: { apiBaseUrl, axios: { browserBaseURL: apiBaseUrl } },
  privateRuntimeConfig: { axios: { baseURL: apiBaseUrl } },
  vuetify: {
    defaultAssets: { font: false, icons: "mdi" },
    theme: {
      dark: false,
      themes: {
        light: {
          primary: "#36796f", secondary: "#405b55", accent: "#479085",
          background: "#f3f6f4", surface: "#ffffff",
          error: "#c7475d", info: "#528d95", success: "#16856f",
          warning: "#a66a17",
        },
        dark: {
          primary: "#8dc8b8", secondary: "#bbcbc2", accent: "#a4d4c8",
          background: "#111a17", surface: "#19231f",
          error: "#f18b98", info: "#82a9ed", success: "#64c8a8",
          warning: "#e3b96d",
        },
      },
    },
  },
  build: { cache: false, transpile: ["vuetify/lib"] },
};
