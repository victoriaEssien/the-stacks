/** Stable id generator with a fallback for non-secure contexts. */
export const createId = (prefix = ''): string => {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${uuid}` : uuid;
};

export const nowIso = (): string => new Date().toISOString();
