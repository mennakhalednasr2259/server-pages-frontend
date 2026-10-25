import { createPages } from "~/data/templates";

const PREFIX = "server-pages-standalone:v1:client:";

function storage() {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch (error) { throw storageError("unavailable"); }
}

function freshPages(clientId) {
  return createPages(clientId === "client-northstar-002" ? "404" : "index").map((page) => ({ ...page, id: `${clientId}:${page.type}` }));
}

function mergeBuiltIns(clientId, pages) {
  const knownTypes = new Set(pages.map((page) => page.type));
  const initial = freshPages(clientId);
  return pages.concat(initial.filter((page) => !knownTypes.has(page.type)));
}

function normalize(pages) {
  if (!Array.isArray(pages)) return null;
  const seen = new Set();
  for (const page of pages) {
    if (!page || typeof page.id !== "string" || !page.id || typeof page.type !== "string" || typeof page.enabled !== "boolean" || typeof page.isIndex !== "boolean" || seen.has(page.id)) return null;
    seen.add(page.id);
  }
  return pages;
}

function storageError(reason) {
  const error = new Error(reason === "invalid-data" ? "Stored page configuration is invalid" : "Could not read page configuration");
  error.code = reason;
  return error;
}

function indexIssue(pages) {
  const indexes = pages.filter((page) => page.isIndex);
  if (!indexes.length) return "missing-index";
  if (indexes.length > 1) return "multiple-indexes";
  if (!indexes[0].enabled) return "disabled-index";
  return null;
}

function withPages(clientId, operation) {
  return demoPageRepository.list(clientId).then(async (current) => {
    const pages = JSON.parse(JSON.stringify(current));
    const result = operation(pages);
    if (result && result.ok === false) return result;
    const saved = await demoPageRepository.save(clientId, pages);
    return saved.ok ? { ok: true, pages, value: result } : saved;
  }).catch((error) => ({ ok: false, reason: error.code || "unavailable" }));
}

export const demoPageRepository = {
  mode: "demo",
  async list(clientId) {
    if (!clientId || typeof clientId !== "string") throw storageError("invalid-client");
    const store = storage();
    if (!store) return freshPages(clientId);
    let raw;
    try { raw = store.getItem(PREFIX + clientId); } catch (error) { throw storageError("unavailable"); }
    if (!raw) {
      const pages = freshPages(clientId);
      const saved = await this.save(clientId, pages);
      if (!saved.ok) throw storageError(saved.reason);
      return pages;
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch (error) { throw storageError("invalid-data"); }
    if (!parsed || parsed.clientId !== clientId || !Array.isArray(parsed.pages)) throw storageError("invalid-data");
    const pages = normalize(parsed.pages);
    if (!pages) throw storageError("invalid-data");
    const completePages = mergeBuiltIns(clientId, pages);
    if (completePages.length !== pages.length) {
      const saved = await this.save(clientId, completePages);
      if (!saved.ok) throw storageError(saved.reason);
    }
    return completePages;
  },
  async loadConfiguration(clientId) {
    const pages = await this.list(clientId);
    const issue = indexIssue(pages);
    return { clientId, pages, indexPageId: issue ? null : pages.find((page) => page.isIndex).id, indexIssue: issue };
  },
  async get(clientId, pageId) {
    const pages = await this.list(clientId);
    return pages.find((page) => page.id === pageId) || null;
  },
  async create(clientId, page) {
    return withPages(clientId, (pages) => {
      if (!page || typeof page.id !== "string" || pages.some((entry) => entry.id === page.id)) return { ok: false, reason: "duplicate-or-invalid-id" };
      pages.push(page);
      return page.id;
    });
  },
  async update(clientId, pageId, changes) {
    return withPages(clientId, (pages) => {
      const index = pages.findIndex((page) => page.id === pageId);
      if (index < 0) return { ok: false, reason: "not-found" };
      pages[index] = { ...pages[index], ...changes, id: pageId };
      return pageId;
    });
  },
  async delete(clientId, pageId) {
    return withPages(clientId, (pages) => {
      const index = pages.findIndex((page) => page.id === pageId);
      if (index < 0) return { ok: false, reason: "not-found" };
      if (pages[index].isIndex) return { ok: false, reason: "index-protected" };
      pages.splice(index, 1);
      return pageId;
    });
  },
  async setIndex(clientId, pageId) {
    return withPages(clientId, (pages) => {
      const selected = pages.find((page) => page.id === pageId);
      if (!selected) return { ok: false, reason: "not-found" };
      if (!selected.enabled) return { ok: false, reason: "disabled" };
      pages.forEach((page) => { page.isIndex = page.id === pageId; });
      return pageId;
    });
  },
  async save(clientId, pages) {
    if (!clientId || typeof clientId !== "string") return { ok: false, reason: "invalid-client" };
    const key = PREFIX + clientId;
    let previousValue = null;
    try {
      const store = storage();
      if (!store) return { ok: false, reason: "unavailable" };
      previousValue = store.getItem(key);
      const copy = JSON.parse(JSON.stringify(pages));
      if (!normalize(copy) || !copy.length || !copy.some((page) => page.enabled) || copy.some((page) => page.isIndex && !page.enabled) || copy.filter((page) => page.isIndex).length > 1) return { ok: false, reason: "invalid-data" };
      store.setItem(key, JSON.stringify({ clientId, pages: copy }));
      return { ok: true };
    } catch (error) {
      try { if (previousValue !== null && store.getItem(key) !== previousValue) store.setItem(key, previousValue); } catch (restoreError) {}
      return { ok: false, reason: error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED") ? "quota" : "unavailable" };
    }
  },
  async reset(clientId) {
    if (!clientId || typeof clientId !== "string") return false;
    try { const store = storage(); if (!store) return false; store.removeItem(PREFIX + clientId); return true; } catch (error) { return false; }
  },
};
