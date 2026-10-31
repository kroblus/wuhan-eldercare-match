// Stable synthetic content signature shared by seeded confirmations and atomic receipts.
export function canonical(value: unknown): string {
  return value && typeof value === 'object'
    ? Array.isArray(value)
      ? '[' + value.map(canonical).join(',') + ']'
      : '{' +
        Object.keys(value)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k]))
          .join(',') +
        '}'
    : JSON.stringify(value);
}
