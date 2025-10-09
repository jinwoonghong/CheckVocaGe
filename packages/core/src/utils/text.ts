export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function toNormalizedWord(value: string): string {
  return normalizeWhitespace(value).toLocaleLowerCase();
}
