export function isValidImageSource(value) {
  if (!value) return true;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch (error) { return false; }
}

export function isValidActionUrl(value) {
  if (!value) return true;
  if (/^(mailto:|tel:)[^\s]+$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch (error) { return false; }
}

export function isValidHexColor(value) {
  return /^#[\da-f]{6}$/i.test(value || "");
}
