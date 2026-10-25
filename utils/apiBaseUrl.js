export function normalizeApiBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return "";
    return parsed.toString().replace(/\/$/, "");
  } catch (error) { return ""; }
}
