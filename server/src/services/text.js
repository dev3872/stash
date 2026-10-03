/** Shared text helpers for extraction and conversion. */

export function countWords(text) {
  const matches = String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches ? matches.length : 0;
}

/** Collapses runs of spaces inside lines and limits blank lines, keeping paragraph breaks. */
export function tidyWhitespace(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastBreak = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. '));
  return lastBreak > max * 0.8 ? cut.slice(0, lastBreak + 1) : cut;
}
