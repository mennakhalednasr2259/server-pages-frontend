const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const babel = require("@babel/core");

const root = path.resolve(__dirname, "..");

function loadSource(source, filename, mocks = {}) {
  const compiled = babel.transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
  }).code;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const localRequire = loaded.require.bind(loaded);
  loaded.require = (request) => Object.prototype.hasOwnProperty.call(mocks, request) ? mocks[request] : localRequire(request);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

function loadProjectModule(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
  return loadSource(fs.readFileSync(filename, "utf8"), filename, mocks);
}

const templates = loadProjectModule("data/templates.js");
const repositoryModule = loadProjectModule("services/demoPageRepository.js", {
  "~/data/templates": templates,
});
const apiBaseUrlModule = loadProjectModule("utils/apiBaseUrl.js");
const apiConfigurationModule = loadProjectModule("services/apiConfigurationRepository.js");
const apiPageRepositoryModule = loadProjectModule("services/apiPageRepository.js");
const pageRepositoryModule = loadProjectModule("services/pageRepository.js", {
  "~/services/demoPageRepository": repositoryModule,
  "~/services/apiPageRepository": apiPageRepositoryModule,
});
const validationModule = loadProjectModule("utils/pageValidation.js");
const adminSource = fs.readFileSync(path.join(root, "pages/admin/index.vue"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const adminModule = loadSource(adminSource, path.join(root, "pages/admin/index.vue"), {
  "~/components/VisitorPage.vue": {},
  "~/components/PageEditorForm.vue": {},
  "~/data/templates": templates,
  "~/services/pageRepository": pageRepositoryModule,
  "~/utils/pageValidation": validationModule,
});
const adminPage = adminModule.default;
const editorFormSource = fs.readFileSync(path.join(root, "components/PageEditorForm.vue"), "utf8");
const editorFormScript = editorFormSource.match(/<script>([\s\S]*?)<\/script>/)[1];
const editorFormModule = loadSource(editorFormScript, path.join(root, "components/PageEditorForm.vue"));
const editorForm = editorFormModule.default;
const rootPageSource = fs.readFileSync(path.join(root, "pages/index.vue"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const rootPage = loadSource(rootPageSource, path.join(root, "pages/index.vue"), {
  "~/components/VisitorPage.vue": {},
  "~/data/templates": templates,
  "~/services/pageRepository": pageRepositoryModule,
});

function setStorage(initial = new Map()) {
  const values = initial;
  global.window = {
    localStorage: {
      get length() { return values.size; },
      key(index) { return Array.from(values.keys())[index] || null; },
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); },
    },
  };
  return values;
}

test("PageEditorForm emits copied page data instead of mutating its prop", () => {
  const original = { title: "Welcome", design: { background: "#ffffff" } };
  const emitted = [];
  const context = { draft: original, $emit: (...args) => emitted.push(args) };
  editorForm.methods.updateField.call(context, "title", "Updated");
  editorForm.methods.updateDesign.call(context, "background", "#000000");
  assert.equal(original.title, "Welcome");
  assert.equal(original.design.background, "#ffffff");
  assert.equal(emitted[0][0], "update:draft");
  assert.equal(emitted[0][1].title, "Updated");
  assert.equal(emitted[1][1].design.background, "#000000");
});

test("Nuxt runtime config applies one validated API URL to browser and server Axios", () => {
  const previous = process.env.NUXT_PUBLIC_API_BASE_URL;
  process.env.NUXT_PUBLIC_API_BASE_URL = "https://shared-api.example.com/v1/";
  try {
    const config = loadProjectModule("nuxt.config.js", {
      "./utils/apiBaseUrl": apiBaseUrlModule,
      "./data/templates": templates,
    }).default;
    assert.equal(config.publicRuntimeConfig.apiBaseUrl, "https://shared-api.example.com/v1");
    assert.equal(config.publicRuntimeConfig.axios.browserBaseURL, config.publicRuntimeConfig.apiBaseUrl);
    assert.equal(config.privateRuntimeConfig.axios.baseURL, config.publicRuntimeConfig.apiBaseUrl);
    assert.equal(config.axios.baseURL, "");
    assert.equal(config.axios.browserBaseURL, "");
    assert.equal(config.target, "static");
    assert.equal(config.generate.fallback, "200.html");
    assert.deepEqual(config.generate.routes, templates.PAGE_TEMPLATES.map((page) => `/server-pages-preview/${encodeURIComponent(page.type)}`));
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
    assert.equal(vercelConfig.buildCommand, "npm run generate");
    assert.equal(vercelConfig.outputDirectory, "dist");
    assert.deepEqual(vercelConfig.redirects, [{ source: "/", destination: "/admin", permanent: false, preserveQueryParams: true }]);
    assert.deepEqual(vercelConfig.rewrites, [{ source: "/server-pages-preview/:type*", destination: "/200.html" }]);
  } finally {
    if (previous === undefined) delete process.env.NUXT_PUBLIC_API_BASE_URL;
    else process.env.NUXT_PUBLIC_API_BASE_URL = previous;
  }
});
test("obsolete per-client API URL keys are removed without touching page data", () => {
  const values = setStorage(new Map([
    ["server-pages-standalone:v1:client-api:client-a", "{\"baseUrl\":\"https://old.example\"}"],
    ["server-pages-standalone:v1:client:client-a", "{\"pages\":[]}"],
  ]));
  assert.equal(apiConfigurationModule.removeLegacyClientApiSettings(), true);
  assert.equal(values.has("server-pages-standalone:v1:client-api:client-a"), false);
  assert.equal(values.has("server-pages-standalone:v1:client:client-a"), true);
});

test("shared API URL validation rejects invalid URLs", () => {
  const { normalizeApiBaseUrl } = apiBaseUrlModule;
  for (const invalid of ["", "javascript:alert(1)", "https://user:secret@example.com", "https://api.example.com?token=x", "https://api.example.com/#fragment", "https://bad url"]) {
    assert.equal(normalizeApiBaseUrl(invalid), "");
  }
});

test("API page adapter refuses operations until request and response contracts are supplied", async () => {
  let requested = false;
  const adapter = apiPageRepositoryModule.createApiPageRepository({ request() { requested = true; } }, {});
  await assert.rejects(adapter.get({ clientId: "client-a", pageId: "page-1" }), (error) => error.code === "api-contract-not-configured");
  assert.equal(requested, false);
});

test("API adapter uses only the configured request and response contract", async () => {
  let requestConfig = null;
  const adapter = apiPageRepositoryModule.createApiPageRepository({
    async request(config) {
      requestConfig = config;
      return { data: { result: { id: "authoritative-id" } } };
    },
  }, {
    get: {
      buildRequest(args) { return { method: "GET", url: "route-provided-by-contract", params: args }; },
      mapResponse(data) { return data.result; },
    },
  });
  const page = await adapter.get("client-a", "authoritative-id");
  assert.equal(requestConfig.method, "GET");
  assert.equal(requestConfig.params.clientId, "client-a");
  assert.equal(page.id, "authoritative-id");
});

test("page repository factory keeps Demo as default and exposes contract-driven API save", async () => {
  assert.equal(pageRepositoryModule.pageRepository.mode, "demo");
  assert.equal(pageRepositoryModule.createPageRepository().mode, "demo");

  let requestConfig = null;
  const apiRepository = pageRepositoryModule.createPageRepository({
    mode: "api",
    axios: {
      async request(config) {
        requestConfig = config;
        return { data: { saved: true } };
      },
    },
    contract: {
      save: {
        buildRequest(args) {
          return { method: "CONTRACT_METHOD", url: "contract-defined-save-route", data: args };
        },
        mapResponse(data) { return data; },
      },
    },
  });

  assert.equal(apiRepository.mode, "api");
  assert.deepEqual(await apiRepository.save("client-a", [{ id: "page-a" }]), { saved: true });
  assert.equal(requestConfig.method, "CONTRACT_METHOD");
  assert.equal(requestConfig.url, "contract-defined-save-route");
  assert.equal(requestConfig.data.clientId, "client-a");
  assert.throws(
    () => pageRepositoryModule.createPageRepository({ mode: "unknown" }),
    (error) => error.code === "unsupported-page-repository-mode",
  );
});
test("each customer keeps an isolated page collection; reset removes only that customer's key", async () => {
  const values = setStorage();
  const { demoPageRepository } = repositoryModule;
  const first = await demoPageRepository.list("client-acme-001");
  const second = await demoPageRepository.list("client-northstar-002");
  first[0].titleAr = "عنوان خاص بالعميل الأول";
  assert.deepEqual(await demoPageRepository.save("client-acme-001", first), { ok: true });

  assert.equal((await demoPageRepository.list("client-acme-001"))[0].titleAr, "عنوان خاص بالعميل الأول");
  assert.notEqual((await demoPageRepository.list("client-northstar-002"))[0].titleAr, "عنوان خاص بالعميل الأول");
  assert.equal(await demoPageRepository.reset("client-acme-001"), true);
  assert.equal(values.has("server-pages-standalone:v1:client:client-acme-001"), false);
  assert.equal(values.has("server-pages-standalone:v1:client:client-northstar-002"), true);
  assert.equal(second.length, 7);
});

test("a failed quota write reports failure and preserves the customer's previous value", async () => {
  const values = setStorage();
  const { demoPageRepository } = repositoryModule;
  const original = await demoPageRepository.list("client-acme-001");
  const key = "server-pages-standalone:v1:client:client-acme-001";
  const previousValue = values.get(key);
  const changed = JSON.parse(JSON.stringify(original));
  changed[0].messageAr = "تغيير لا يجب حفظه";
  global.window.localStorage.setItem = () => {
    const error = new Error("Quota exceeded");
    error.name = "QuotaExceededError";
    throw error;
  };

  assert.deepEqual(await demoPageRepository.save("client-acme-001", changed), { ok: false, reason: "quota" });
  assert.equal(values.get(key), previousValue);
});

test("an unreadable customer record is not deleted or overwritten during load", async () => {
  const key = "server-pages-standalone:v1:client:client-acme-001";
  const values = setStorage(new Map([[key, "{invalid-json"]]));
  const { demoPageRepository } = repositoryModule;

  await assert.rejects(demoPageRepository.list("client-acme-001"), (error) => error.code === "invalid-data");
  assert.equal(values.get(key), "{invalid-json");
});

test("Add page opens a create draft, survives editor route reload, and persists only the new page", async () => {
  setStorage();
  const clientId = "client-acme-001";
  const route = { query: { screen: "dashboard", clientId } };
  const calls = [];
  const context = Object.assign(adminPage.data.call({ $route: route }), {
    clientId,
    pages: await pageRepositoryModule.pageRepository.list(clientId),
    $route: route,
  }, adminPage.methods);
  Object.defineProperty(context, "activeScreen", {
    get() { return this.$route.query.screen === "editor" ? "editor" : "dashboard"; },
  });
  Object.defineProperty(context, "hasUnsavedChanges", {
    get() { return adminPage.computed.hasUnsavedChanges.call(this); },
  });
  context.$router = {
    async push(target) {
      calls.push({ type: "push", target });
      context.$route = { query: target.query };
    },
    async replace(target) {
      calls.push({ type: "replace", target });
      context.$route = { query: target.query };
    },
  };

  const before = JSON.stringify(context.pages);
  await context.newPage();
  const pageId = context.draft.id;
  assert.equal(context.isCreatingPage, true);
  assert.equal(context.draft.clientId, clientId);
  assert.equal(context.$route.query.screen, "editor");
  assert.equal(context.$route.query.newPage, "1");
  assert.equal(context.$route.query.pageId, pageId);
  assert.ok(adminPage.computed.editorPageOptions.call(context).some((page) => page.id === pageId));
  assert.equal(JSON.stringify(context.pages), before);
  assert.equal(calls[0].type, "push");

  await context.loadPages();
  assert.equal(context.isCreatingPage, true);
  assert.equal(context.draft.id, pageId);
  assert.equal(context.selectedPageId, pageId);

  context.draft.titleAr = "صفحة جديدة محفوظة";
  context.draft.title = "New saved page";
  const originalIndex = context.pages.find((page) => page.isIndex).id;
  await context.savePage();

  const saved = await pageRepositoryModule.pageRepository.get(clientId, pageId);
  assert.equal(saved.titleAr, "صفحة جديدة محفوظة");
  assert.equal(saved.title, "New saved page");
  assert.equal(saved.clientId, clientId);
  assert.equal((await pageRepositoryModule.pageRepository.get("client-northstar-002", pageId)), null);
  assert.equal(context.pages.find((page) => page.isIndex).id, originalIndex);
  assert.equal(context.isCreatingPage, false);
  assert.equal(context.$route.query.pageId, pageId);
  assert.ok(adminPage.computed.editorPageOptions.call(context).some((page) => page.id === pageId));
  assert.equal(Object.prototype.hasOwnProperty.call(context.$route.query, "newPage"), false);
  assert.equal(calls.at(-1).type, "replace");
});
test("admin handlers add, edit, index, disable, translate, delete, and reload custom pages", async () => {
  setStorage();
  const clientId = "client-acme-001";
  const context = Object.assign(adminPage.data(), {
    clientId,
    pages: await pageRepositoryModule.pageRepository.list(clientId),
  }, adminPage.methods);
  Object.defineProperty(context, "client", {
    get() { return templates.DEMO_CLIENTS.find((client) => client.id === this.clientId); },
  });

  context.newPage();
  const customId = context.draft.id;
  assert.ok(customId.startsWith("custom-" + clientId + "-"));
  assert.equal(context.draft.clientId, clientId);
  context.draft.design.background = "#123456";
  context.draft.design.text = "#654321";
  context.draft.design.logoUrl = "data:image/png;base64,AAAA";
  context.draft.design.imageUrl = "data:image/webp;base64,BBBB";
  context.draft.messageAr = "رسالة عربية محفوظة";
  await context.savePage();
  assert.ok(context.pages.some((page) => page.id === customId));

  context.editPage(context.pages.find((page) => page.id === customId));
  context.draft.titleAr = "صفحة مخصصة معدلة";
  await context.savePage();
  assert.equal(context.pages.find((page) => page.id === customId).titleAr, "صفحة مخصصة معدلة");

  await context.setIndex(customId);
  assert.equal(context.pages.filter((page) => page.isIndex).length, 1);
  context.locale = "en";
  assert.equal(context.label(context.pages.find((page) => page.id === customId)), "Custom page");
  assert.ok(context.pages.some((page) => page.id === customId));

  await context.togglePage(context.pages.find((page) => page.id === customId), false);
  assert.equal(context.pages.find((page) => page.id === customId).enabled, false);
  assert.equal(context.pages.filter((page) => page.isIndex).length, 0);
  const activeAlternative = context.pages.find((page) => page.enabled);
  await context.setIndex(activeAlternative.id);
  assert.equal(context.pages.find((page) => page.isIndex).id, activeAlternative.id);

  const remaining = context.pages.find((page) => page.enabled);
  context.pages.forEach((page) => { page.enabled = page.id === remaining.id; });
  await pageRepositoryModule.pageRepository.save(clientId, context.pages);
  const savedState = JSON.stringify(context.pages);
  await context.togglePage(remaining, false);
  assert.equal(JSON.stringify(context.pages), savedState);
  assert.equal(context.noticeType, "error");

  const reloadedCustom = (await pageRepositoryModule.pageRepository.list(clientId)).find((page) => page.id === customId);
  assert.equal(reloadedCustom.enabled, false);
  assert.equal(reloadedCustom.messageAr, "رسالة عربية محفوظة");
  assert.equal(reloadedCustom.design.background, "#123456");
  assert.equal(reloadedCustom.design.text, "#654321");
  assert.equal(reloadedCustom.design.logoUrl, "data:image/png;base64,AAAA");
  assert.equal(reloadedCustom.design.imageUrl, "data:image/webp;base64,BBBB");

  context.deleteTarget = context.pages.find((page) => page.id === customId);
  await context.deletePage();
  assert.ok(!context.pages.some((page) => page.id === customId));
  const reloaded = await pageRepositoryModule.pageRepository.list(clientId);
  assert.ok(!reloaded.some((page) => page.id === customId));

  context.clientId = "client-northstar-002";
  await context.loadPages();
  assert.ok(context.pages.every((page) => page.id.startsWith("client-northstar-002:")));
  const previewUrl = context.visitorRoute(context.pages.find((page) => page.type === "404"));
  assert.match(previewUrl, /clientId=client-northstar-002/);
  assert.match(previewUrl, /domain=northstar\.ae/);

  const beforeFailedCommit = JSON.stringify(context.pages);
  global.window.localStorage.setItem = () => {
    const error = new Error("Quota exceeded");
    error.name = "QuotaExceededError";
    throw error;
  };
  const rejected = await context.commit(context.pages.map((page) => ({ ...page, titleAr: "لم يحفظ" })));
  assert.equal(rejected, false);
  assert.equal(JSON.stringify(context.pages), beforeFailedCommit);
  assert.match(context.notice, /Browser storage is full/);
});

test("standalone preview uses the URL client, documented default, and never substitutes another template", async () => {
  const loadedClients = [];
  const defaultPages = templates.createPages().map((page) => ({ ...page, id: `${templates.DEFAULT_CLIENT_ID}:${page.type}` }));
  const northstarPages = templates.createPages("404").map((page) => ({ ...page, id: `client-northstar-002:${page.type}` }));
  northstarPages.find((page) => page.type === "404").titleAr = "إعداد خاص بنورث ستار";
  const previewSource = fs.readFileSync(path.join(root, "pages/server-pages-preview/_type.vue"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
  const previewModule = loadSource(previewSource, path.join(root, "pages/server-pages-preview/_type.vue"), {
    "~/components/VisitorPage.vue": {},
    "~/data/templates": templates,
    "~/services/pageRepository": {
      pageRepository: {
        async list(clientId) {
          loadedClients.push(clientId);
          if (clientId === templates.DEFAULT_CLIENT_ID) return defaultPages;
          if (clientId === "client-northstar-002") return northstarPages;
          return [];
        },
        async get(clientId, pageId) {
          loadedClients.push(clientId);
          const pages = clientId === templates.DEFAULT_CLIENT_ID ? defaultPages : (clientId === "client-northstar-002" ? northstarPages : []);
          return pages.find((page) => page.id === pageId) || null;
        },
      },
    },
  });
  const loadFor = async (clientId, routeType, pageId) => {
    const context = {
      page: null, loading: true, locale: "ar", domain: "acme-studio.com",
      $route: { params: { type: routeType }, query: { ...(clientId ? { clientId, domain: "wrong-domain.example" } : {}), ...(pageId ? { pageId } : {}) } },
    };
    await previewModule.default.methods.loadPage.call(context);
    return context;
  };

  const explicit = await loadFor("client-northstar-002", "404", "client-northstar-002:404");
  assert.deepEqual(loadedClients, ["client-northstar-002"]);
  assert.equal(explicit.page.titleAr, "إعداد خاص بنورث ستار");
  assert.equal(explicit.domain, "northstar.ae");
  assert.equal(explicit.loading, false);

  const defaultPreview = await loadFor("", "404");
  assert.equal(loadedClients[1], templates.DEFAULT_CLIENT_ID);
  assert.equal(defaultPreview.page.type, "404");
  assert.equal(defaultPreview.domain, "acme-studio.com");

  const wrongPageId = await loadFor("client-northstar-002", "404", "client-acme-001:404");
  assert.equal(wrongPageId.page, null);

  const unconfigured = await loadFor(templates.DEFAULT_CLIENT_ID, "custom-missing");
  assert.equal(unconfigured.page, null);
  const unknownClient = await loadFor("unknown-customer", "404");
  assert.equal(unknownClient.page, null);
  assert.equal(loadedClients.length, 4);
});

test("light/dark preference updates Vuetify and persists without touching customer page data", () => {
  const values = setStorage();
  const previousDocument = global.document;
  const attrs = {};
  global.document = { documentElement: { setAttribute(name, value) { attrs[name] = value; } } };
  const context = Object.assign({ darkMode: false, $vuetify: { theme: { dark: false } } }, adminPage.methods);
  const customerDesign = { background: "#f7f9f8", text: "#1d312e", button: "#315c56" };
  const originalDesign = JSON.stringify(customerDesign);

  context.toggleTheme();
  assert.equal(context.darkMode, true);
  assert.equal(context.$vuetify.theme.dark, true);
  assert.equal(attrs["data-color-scheme"], "dark");
  assert.equal(values.get("server-pages-standalone:theme:v1"), "dark");
  context.toggleTheme();
  assert.equal(context.darkMode, false);
  assert.equal(values.get("server-pages-standalone:theme:v1"), "light");
  assert.equal(JSON.stringify(customerDesign), originalDesign);

  if (previousDocument === undefined) delete global.document;
  else global.document = previousDocument;
});

test("workspace navigation keeps the selected customer and opens the requested page editor", async () => {
  const page = { id: "client-acme-001:404", type: "404", title: "Not found" };
  const calls = [];
  const context = {
    $route: { query: { clientId: "client-acme-001", lang: "en" } },
    $router: { async push(route) { calls.push(route); } },
    clientId: "client-acme-001",
    client: { domain: "acme-studio.com" }, locale: "en",
    draft: page,
    selectedPageId: page.id,
    selectedPage: page,
    hasUnsavedChanges: false,
    mobileMenuOpen: true,
  };
  Object.assign(context, adminPage.methods);

  assert.deepEqual(context.adminRoute("editor", page), {
    path: "/admin",
    query: { clientId: "client-acme-001", lang: "en", screen: "editor", pageId: page.id },
  });
  await context.goEditor(page);
  assert.equal(calls[0].query.screen, "editor");
  assert.equal(calls[0].query.pageId, page.id);
  assert.equal(calls[0].query.clientId, "client-acme-001");
  assert.equal(context.mobileMenuOpen, false);
  assert.equal(context.draft.id, page.id);

  for (const type of ["index", "404", "403", "500", "maintenance", "suspended", "custom-contact"]) {
    const item = { id: `client-acme-001:${type}`, type };
    await context.goEditor(item);
    assert.equal(calls.at(-1).query.pageId, item.id);
    assert.match(context.visitorRoute(item), new RegExp(`pageId=${encodeURIComponent(item.id)}`));
  }
});

test("admin navigation supports Nuxt 2 router.push returning undefined", async () => {
  const calls = [];
  const firstPage = { id: "client-acme-001:index", type: "index" };
  const secondPage = { id: "client-acme-001:404", type: "404" };
  const context = {
    $route: { query: { clientId: "client-acme-001", screen: "dashboard" } },
    $router: { push(route) { calls.push(route); } },
    clients: templates.DEMO_CLIENTS,
    clientId: "client-acme-001",
    pages: [firstPage, secondPage],
    selectedPage: firstPage,
    selectedPageId: firstPage.id,
    draft: firstPage,
    hasUnsavedChanges: false,
    mobileMenuOpen: false,
    isCreatingPage: false,
    activeScreen: "dashboard",
    locale: "en",
  };
  Object.assign(context, adminPage.methods);

  await context.navigate("dashboard");
  await context.goEditor(firstPage);
  await context.changeEditorPage(secondPage.id);
  await context.changeClient("client-northstar-002");
  context.clientId = "client-acme-001";
  await context.newPage();

  assert.equal(calls.length, 5);
  assert.equal(calls[0].query.screen, "dashboard");
  assert.equal(calls[1].query.pageId, firstPage.id);
  assert.equal(calls[2].query.pageId, secondPage.id);
  assert.equal(calls[3].query.clientId, "client-northstar-002");
  assert.equal(calls[4].query.newPage, "1");
});

test("editor page selector preserves the current draft until discard is confirmed and then selects the exact page", async () => {
  const previousWindow = global.window;
  const choices = [false, true];
  const prompts = [];
  global.window = { confirm(message) { prompts.push(message); return choices.shift(); } };
  const current = { id: "client-acme-001:index", type: "index", title: "Home", isIndex: true };
  const target = { id: "client-acme-001:404", type: "404", title: "Not found", isIndex: false };
  const calls = [];
  const context = {
    $route: { query: { clientId: "client-acme-001", lang: "en", screen: "editor", pageId: current.id } },
    $router: { async push(route) { calls.push(route); } },
    clientId: "client-acme-001", locale: "en", pages: [current, target], selectedPageId: current.id,
    draft: { ...current, title: "Unsaved home title" }, hasUnsavedChanges: true,
  };
  Object.assign(context, adminPage.methods);

  await context.changeEditorPage(target.id);
  assert.equal(context.selectedPageId, current.id);
  assert.equal(context.draft.title, "Unsaved home title");
  assert.equal(calls.length, 0);

  await context.changeEditorPage(target.id);
  assert.equal(context.selectedPageId, target.id);
  assert.equal(context.draft.id, target.id);
  assert.equal(context.draft.title, target.title);
  assert.deepEqual(calls[0].query, { clientId: "client-acme-001", lang: "en", screen: "editor", pageId: target.id });
  assert.equal(context.pages.find((page) => page.isIndex).id, current.id);
  assert.equal(prompts.length, 2);

  if (previousWindow === undefined) delete global.window;
  else global.window = previousWindow;
});

test("opening the editor without a valid pageId leaves selection empty and offers every customer page", async () => {
  setStorage();
  const context = Object.assign(adminPage.data.call({ $route: { query: { screen: "editor", clientId: "client-acme-001" } } }), {
    clientId: "client-acme-001", activeScreen: "editor",
    $route: { query: { screen: "editor", clientId: "client-acme-001", pageId: "missing-page" } },
  }, adminPage.methods);
  await context.loadPages();
  assert.equal(context.selectedPageId, null);
  assert.equal(context.draft, null);
  const options = adminPage.computed.editorPageOptions.call(context);
  assert.equal(options.length, 7);
  assert.ok(options.find((page) => page.isIndex));
  assert.ok(options.some((page) => page.typeLabel === "404"));
});

test("switching editor page and saving updates only that page without changing INDEX", async () => {
  setStorage();
  const clientId = "client-acme-001";
  const context = Object.assign(adminPage.data.call({ $route: { query: { screen: "editor", clientId } } }), {
    clientId,
    $route: { query: { screen: "editor", clientId } },
    $router: { async push() {} },
  }, adminPage.methods);
  Object.defineProperty(context, "activeScreen", { get() { return "editor"; } });
  Object.defineProperty(context, "hasUnsavedChanges", { get() { return adminPage.computed.hasUnsavedChanges.call(this); } });
  const index = (await pageRepositoryModule.pageRepository.list(clientId)).find((page) => page.isIndex);
  const notFound = (await pageRepositoryModule.pageRepository.list(clientId)).find((page) => page.type === "404");
  context.$route.query.pageId = index.id;
  context.selectedPageId = index.id;
  await context.loadPages();
  context.draft.messageAr = "تعديل غير محفوظ للصفحة الرئيسية";
  global.window.confirm = () => true;
  await context.changeEditorPage(notFound.id);
  context.draft.messageAr = "رسالة مخصصة لصفحة 404";
  await context.savePage();

  const saved = await pageRepositoryModule.pageRepository.list(clientId);
  assert.equal(saved.find((page) => page.type === "404").messageAr, "رسالة مخصصة لصفحة 404");
  assert.equal(saved.find((page) => page.type === "index").messageAr, index.messageAr);
  assert.equal(saved.filter((page) => page.isIndex).length, 1);
  assert.equal(saved.find((page) => page.isIndex).id, index.id);
});

test("workspace merges Overview and Server Pages into one Dashboard and keeps Editor and Visitor Preview separate", () => {
  const adminTemplate = fs.readFileSync(path.join(root, "pages/admin/index.vue"), "utf8");
  const visitorTemplate = fs.readFileSync(path.join(root, "pages/server-pages-preview/_type.vue"), "utf8");
  assert.match(adminTemplate, /activeScreen === 'dashboard'/);
  assert.equal(adminPage.computed.activeScreen.call({ $route: { query: { screen: "overview" } } }), "dashboard");
  assert.equal(adminPage.computed.activeScreen.call({ $route: { query: { screen: "pages" } } }), "dashboard");
  assert.equal(adminPage.computed.activeScreen.call({ $route: { query: { screen: "editor" } } }), "editor");
  assert.match(adminTemplate, /activeScreen === 'dashboard' && viewMode === 'grid'/);
  assert.match(adminTemplate, /activeScreen === 'dashboard' && viewMode === 'list'/);
  assert.match(adminTemplate, /activeScreen === 'editor'/);
  assert.match(adminTemplate, /<VisitorPage :page="page"/);
  assert.doesNotMatch(adminTemplate, /t\('عرض كزائر', 'Visitor view'\)/);
  assert.match(adminTemplate, /@click\.stop="openVisitor\(page\)"/);
  assert.match(adminTemplate, /@click="openVisitor\(draft\)"/);
  assert.match(adminTemplate, /editorPageOptions/);
  assert.match(adminTemplate, /@change="changeEditorPage"/);
  assert.match(adminTemplate, /pageId/);
  assert.doesNotMatch(adminTemplate, /:href="adminRoute/);
  assert.match(adminTemplate, /<nuxt-link[^>]*:to="adminRoute/);
  assert.doesNotMatch(adminTemplate, /<v-switch/);
  assert.match(adminTemplate, /class="page-toggle"/);
  assert.match(adminTemplate, /role="switch"/);
  const workspaceStyles = fs.readFileSync(path.join(root, "assets/css/app.scss"), "utf8");
  assert.match(workspaceStyles, /\.page-toggle__track/);
  assert.match(workspaceStyles, /\.page-toggle__thumb/);
  assert.doesNotMatch(adminTemplate, /t\('نظرة عامة', 'Overview'\)/);
  assert.match(adminTemplate, /inactiveCount\(\)/);
  assert.match(adminTemplate, /<PageEditorForm/);
  const editorFormTemplate = editorFormSource.match(/<template>([\s\S]*?)<\/template>/)[1];
  assert.match(editorFormTemplate, /:value="settingsTab"/);
  assert.match(editorFormTemplate, /@change="\$emit\(['"]settings-tab-change/);
  assert.match(adminTemplate, /toggleLanguage\(\)/);
  assert.match(visitorTemplate, /v-btn value="desktop"/);
  assert.match(visitorTemplate, /v-btn value="mobile"/);
  assert.match(visitorTemplate, /<VisitorPage :page="page"/);
  assert.match(visitorTemplate, /pageId/);
  assert.match(visitorTemplate, /dashboardRoute/);
});


test("repository CRUD operations preserve client boundaries and reject unsafe INDEX choices", async () => {
  setStorage();
  const repository = pageRepositoryModule.pageRepository;
  const clientId = "client-acme-001";
  const pages = await repository.list(clientId);
  const created = { ...JSON.parse(JSON.stringify(pages.find((page) => page.type === "coming-soon"))), id: "custom-new-coming-soon", type: "custom-coming-soon", code: "CUSTOM" };
  assert.equal((await repository.create(clientId, created)).ok, true);
  assert.equal((await repository.create(clientId, created)).reason, "duplicate-or-invalid-id");
  assert.equal((await repository.get(clientId, created.id)).titleAr, created.titleAr);
  assert.equal((await repository.update(clientId, created.id, { titleAr: "قريبًا جدًا" })).ok, true);
  assert.equal((await repository.get(clientId, created.id)).titleAr, "قريبًا جدًا");
  assert.equal((await repository.setIndex(clientId, created.id)).ok, true);
  assert.equal((await repository.get("client-northstar-002", created.id)), null);
  assert.equal((await repository.delete(clientId, created.id)).ok, false);
  assert.equal((await repository.setIndex(clientId, "missing-page")).reason, "not-found");
  assert.equal((await repository.delete(clientId, created.id)).reason, "index-protected");
  assert.equal((await repository.setIndex(clientId, pages.find((page) => page.type === "index").id)).ok, true);
  assert.equal((await repository.delete(clientId, created.id)).ok, true);
});

test("configuration loading reports missing or disabled INDEX without selecting an active fallback", async () => {
  const values = setStorage();
  const repository = pageRepositoryModule.pageRepository;
  const clientId = "client-acme-001";
  const pages = await repository.list(clientId);
  pages.forEach((page) => { page.isIndex = false; });
  pages.find((page) => page.type === "404").enabled = true;
  await repository.save(clientId, pages);
  const missing = await repository.loadConfiguration(clientId);
  assert.equal(missing.indexPageId, null);
  assert.equal(missing.indexIssue, "missing-index");
  assert.equal(missing.pages.find((page) => page.type === "404").enabled, true);
  const disabledIndex = JSON.parse(JSON.stringify(missing.pages));
  disabledIndex[0].isIndex = true;
  disabledIndex[0].enabled = false;
  values.set("server-pages-standalone:v1:client:" + clientId, JSON.stringify({ clientId, pages: disabledIndex }));
  const invalid = await repository.loadConfiguration(clientId);
  assert.equal(invalid.indexPageId, null);
  assert.equal(invalid.indexIssue, "disabled-index");
});

test("new Coming Soon template is available and appended to existing valid customer records", async () => {
  const values = setStorage();
  const repository = repositoryModule.demoPageRepository;
  const clientId = "client-acme-001";
  const pages = await repository.list(clientId);
  const comingSoon = pages.find((page) => page.type === "coming-soon");
  assert.ok(comingSoon);
  const oldRecord = pages.filter((page) => page.type !== "coming-soon");
  oldRecord.find((page) => page.type === "404").titleAr = "نص محفوظ قديم";
  values.set("server-pages-standalone:v1:client:" + clientId, JSON.stringify({ clientId, pages: oldRecord }));
  const migrated = await repository.list(clientId);
  assert.equal(migrated.find((page) => page.type === "404").titleAr, "نص محفوظ قديم");
  assert.ok(migrated.some((page) => page.type === "coming-soon"));
});

test("invalid API base URLs normalize to an empty value", () => {
  const api = loadProjectModule("utils/apiBaseUrl.js");
  for (const value of ["javascript:alert(1)", "https://user:secret@example.com", "not-a-url", "https://api.example.com?token=x"]) {
    assert.equal(api.normalizeApiBaseUrl(value), "");
  }
  assert.equal(api.normalizeApiBaseUrl("https://api.example.com/v1/"), "https://api.example.com/v1");
});


test("root route redirects to admin while INDEX stays available in visitor preview", async () => {
  setStorage();
  const adminPath = path.join(root, "pages/admin/index.vue");
  assert.equal(fs.existsSync(adminPath), true);
  let redirectedTo = null;
  const redirectResult = rootPage.default.middleware({ redirect(location) { redirectedTo = location; return location; } });
  assert.equal(redirectedTo, "/admin");
  assert.equal(redirectResult, "/admin");

  const clientId = "client-acme-001";
  const pages = await pageRepositoryModule.pageRepository.list(clientId);
  const index = pages.find((page) => page.isIndex);
  index.titleAr = "صفحة INDEX للمعاينة";
  await pageRepositoryModule.pageRepository.save(clientId, pages);
  const previewSource = fs.readFileSync(path.join(root, "pages/server-pages-preview/_type.vue"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
  const previewModule = loadSource(previewSource, path.join(root, "pages/server-pages-preview/_type.vue"), {
    "~/components/VisitorPage.vue": {},
    "~/data/templates": templates,
    "~/services/pageRepository": pageRepositoryModule,
  });
  const context = {
    page: null,
    loading: true,
    locale: "ar",
    domain: "acme-studio.com",
    clientId,
    $route: { params: { type: "index" }, query: { clientId, pageId: index.id } },
  };
  await previewModule.default.methods.loadPage.call(context);
  assert.equal(context.page.titleAr, "صفحة INDEX للمعاينة");
  assert.equal(context.page.id, index.id);
});

test("failed image reading reports an error and does not replace the draft image", () => {
  const previousReader = global.FileReader;
  class FailedReader { readAsDataURL() { this.onerror(); } }
  global.FileReader = FailedReader;
  const context = Object.assign({ draft: { design: { imageUrl: "previous-image" } }, notice: "", locale: "en" }, adminPage.methods);
  context.notify = (message, type) => { context.notice = message; context.noticeType = type; };
  context.readImage({ type: "image/png", size: 10 });
  assert.equal(context.draft.design.imageUrl, "previous-image");
  assert.equal(context.noticeType, "error");
  global.FileReader = previousReader;
});


test("storage access failures are returned or surfaced without replacing page records", async () => {
  const values = setStorage();
  const repository = repositoryModule.demoPageRepository;
  const pages = await repository.list("client-acme-001");
  const previous = values.get("server-pages-standalone:v1:client:client-acme-001");
  global.window.localStorage.getItem = () => { throw new Error("Storage denied"); };
  global.window.localStorage.removeItem = () => { throw new Error("Storage denied"); };
  await assert.rejects(repository.list("client-acme-001"), (error) => error.code === "unavailable");
  assert.deepEqual(await repository.save("client-acme-001", pages), { ok: false, reason: "unavailable" });
  assert.equal(await repository.reset("client-acme-001"), false);
  assert.equal(values.get("server-pages-standalone:v1:client:client-acme-001"), previous);
});
