const LEGACY_CLIENT_API_PREFIX = "server-pages-standalone:v1:client-api:";

export function removeLegacyClientApiSettings() {
  if (typeof window === "undefined") return false;
  try {
    const storage = window.localStorage;
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.indexOf(LEGACY_CLIENT_API_PREFIX) === 0) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
    return true;
  } catch (error) {
    return false;
  }
}
