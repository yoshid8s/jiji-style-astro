const namedEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (code.startsWith('#')) {
        const isHex = code[1]?.toLowerCase() === 'x';
        const value = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);

        if (Number.isFinite(value) && value >= 0 && value <= 0x10ffff) {
          return String.fromCodePoint(value);
        }

        return entity;
      }

      return namedEntities[code.toLowerCase()] ?? entity;
    },
  );
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}
