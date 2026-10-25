import { demoPageRepository } from "~/services/demoPageRepository";
import { createApiPageRepository } from "~/services/apiPageRepository";

export function createBackendPageRepository(axios, contract) {
  return createApiPageRepository(axios, contract);
}

export function createPageRepository(options = {}) {
  const mode = options.mode || "demo";
  if (mode === "demo") return demoPageRepository;
  if (mode === "api") return createBackendPageRepository(options.axios, options.contract);
  const error = new Error("Unsupported page repository mode: " + mode);
  error.code = "unsupported-page-repository-mode";
  throw error;
}

// Keep the application in Demo mode until the backend contract is approved and wired.
export const pageRepository = createPageRepository();
