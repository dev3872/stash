import { getDocumentProxy } from 'unpdf';
import { badRequest } from '../lib/errors.js';
import { countWords, tidyWhitespace, truncate } from './text.js';

const ENCRYPTED_MESSAGE =
  'This PDF is encrypted or password-protected, so its text can’t be read. Save an unprotected copy and upload that instead.';

function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function pageText(content) {
  let out = '';
  for (const item of content.items) {
    if (typeof item.str !== 'string') continue;
    out += item.str;
    out += item.hasEOL ? '\n' : item.str.endsWith(' ') ? '' : ' ';
  }
  return out;
}

/**
 * Rebuilds paragraphs from PDF lines: joins wrapped lines and words hyphenated
 * across lines, and keeps short title-like lines on their own so the converter
 * can use them as section headings.
 */
function reflow(text) {
  const lines = text.split('\n').map((line) => line.trim());
  let out = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      out += '\n\n';
      continue;
    }
    const next = lines[i + 1] || '';
    const words = countWords(line);
    const headingLike = words > 0 && words <= 8 && line.length <= 70
      && !/[.!?,;:]$/.test(line) && /^[\p{Lu}\d]/u.test(line) && /^[\p{Lu}]/u.test(next);
    if (headingLike) {
      out += `\n\n${line}\n\n`;
    } else if (/\p{L}-$/u.test(line) && /^\p{Ll}/u.test(next)) {
      out += line.slice(0, -1);
    } else {
      out += line + (/[.!?:]["”’)]?$/.test(line) ? '\n' : ' ');
    }
  }
  return tidyWhitespace(out);
}

async function readPdf(buffer, limits) {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer), { isEvalSupported: false, stopAtErrors: false });
  } catch (err) {
    if (err?.name === 'PasswordException') throw badRequest(ENCRYPTED_MESSAGE);
    throw badRequest('This PDF couldn’t be opened. It may be damaged or not really a PDF.');
  }

  try {
    let title = '';
    try {
      const meta = await pdf.getMetadata();
      title = String(meta?.info?.Title || '').trim();
    } catch {
      // Metadata is optional.
    }

    const pages = Math.min(pdf.numPages, limits.pdfMaxPages);
    const chunks = [];
    let length = 0;
    for (let i = 1; i <= pages && length < limits.extractChars; i += 1) {
      const page = await pdf.getPage(i);
      const text = pageText(await page.getTextContent());
      page.cleanup();
      chunks.push(text);
      length += text.length;
    }
    return { title, text: reflow(chunks.join('\n\n')) };
  } finally {
    await Promise.resolve(pdf.loadingTask?.destroy?.() ?? pdf.cleanup?.()).catch(() => {});
  }
}

export async function extractFromPdf(buffer, limits) {
  const head = buffer.subarray(0, 1024).toString('latin1');
  if (!head.includes('%PDF-')) throw badRequest('That file isn’t a valid PDF.');

  // PDFs with an /Encrypt dictionary in the trailer are encrypted, even if they open without a password.
  if (/\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(buffer.toString('latin1'))) {
    throw badRequest(ENCRYPTED_MESSAGE);
  }

  const { title, text } = await withTimeout(readPdf(buffer, limits), limits.pdfTimeoutMs, () =>
    badRequest('This PDF took too long to read. Try a smaller file.')
  );

  const words = countWords(text);
  if (words === 0) {
    throw badRequest('This PDF has no selectable text. It may be a scanned image. Try a PDF with real text.');
  }
  if (words < limits.minWords) {
    throw badRequest(`This PDF has too little text to teach from (about ${words} words). Try a longer document.`);
  }
  return { title: title.slice(0, 300), text: truncate(text, limits.extractChars) };
}
