export function normalizeSyncKey(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : "";
}

export function buildSyncKeySegment(value: string | null | undefined) {
  const normalized = normalizeSyncKey(value);
  if (!normalized) {
    return "shared";
  }

  const safe = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return safe.length > 0 ? safe.slice(0, 24) : "shared";
}
