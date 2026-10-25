function missingOperation(name) {
  const error = new Error("The backend API contract is not configured for " + name);
  error.code = "api-contract-not-configured";
  return error;
}

/*
 * Every operation needs a confirmed request builder and response mapper.
 * No endpoint, HTTP method, or response shape is assumed in this adapter.
 */
export function createApiPageRepository(axios, contract) {
  async function run(operation, args) {
    const definition = contract && contract[operation];
    if (!axios || typeof axios.request !== "function" || !definition ||
      typeof definition.buildRequest !== "function" || typeof definition.mapResponse !== "function") {
      throw missingOperation(operation);
    }
    const request = definition.buildRequest(args);
    if (!request || typeof request.method !== "string" || typeof request.url !== "string") {
      throw missingOperation(operation);
    }
    const response = await axios.request(request);
    return definition.mapResponse(response.data, args);
  }

  return {
    mode: "api",
    list(clientId) { return run("list", { clientId }); },
    loadConfiguration(clientId) { return run("loadConfiguration", { clientId }); },
    get(clientId, pageId) { return run("get", { clientId, pageId }); },
    create(clientId, page) { return run("create", { clientId, page }); },
    save(clientId, pages) { return run("save", { clientId, pages }); },
    update(clientId, pageId, changes) { return run("update", { clientId, pageId, changes }); },
    delete(clientId, pageId) { return run("delete", { clientId, pageId }); },
    setIndex(clientId, pageId) { return run("setIndex", { clientId, pageId }); },
    reset(clientId) { return run("reset", { clientId }); },
  };
}
