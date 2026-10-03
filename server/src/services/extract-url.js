import * as cheerio from 'cheerio';
import { fetchHtml } from './safe-fetch.js';
import { badRequest } from '../lib/errors.js';
import { countWords, tidyWhitespace, truncate } from './text.js';

const NOISE = [
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'object', 'embed', 'form', 'button',
  'input', 'select', 'nav', 'footer', 'aside', 'header nav', 'table', 'figure', 'sup', 'math',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]', '[role="complementary"]', '[aria-hidden="true"]',
  '.mw-editsection', '.reference', '.references', '.reflist', '.navbox', '.infobox', '.sidebar', '.toc', '#toc',
  '.hatnote', '.metadata', '.noprint', '.cookie', '.cookies', '.advert', '.ads', '.ad', '.share', '.social',
  '.newsletter', '.related', '.comments', '#comments', '.breadcrumb', '.breadcrumbs',
].join(',');

const BLOCKS = 'h1, h2, h3, h4, p, li, blockquote, dd, pre';

function pickRoot($) {
  const candidates = ['article', 'main', '[role="main"]', '#content', '.post-content', '.entry-content', '.article-body', 'body'];
  for (const selector of candidates) {
    const el = $(selector).first();
    if (el.length && countWords(el.text()) >= 150) return el;
  }
  return $('body').first();
}

export function extractReadableText(html) {
  const $ = cheerio.load(html);
  const title = (
    $('meta[property="og:title"]').attr('content') ||
    $('title').first().text() ||
    $('h1').first().text() ||
    ''
  ).replace(/\s+/g, ' ').trim();

  $(NOISE).remove();
  const root = pickRoot($);

  const parts = [];
  root.find(BLOCKS).each((_, el) => {
    const node = $(el);
    // Skip containers whose text we'd otherwise read twice.
    if ((el.tagName === 'li' || el.tagName === 'blockquote' || el.tagName === 'dd') && node.find('p, li').length) return;
    const text = node.text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (/^h[1-4]$/.test(el.tagName)) parts.push(`\n${text}\n`);
    else parts.push(text);
  });

  let text = tidyWhitespace(parts.join('\n\n'));
  if (countWords(text) < 80) text = tidyWhitespace(root.text());
  return { title, text };
}

export async function extractFromUrl(url, limits) {
  const { html, finalUrl } = await fetchHtml(url, { timeoutMs: limits.fetchTimeoutMs, maxBytes: limits.htmlBytes });
  const { title, text } = extractReadableText(html);
  const words = countWords(text);
  if (words < limits.minWords) {
    throw badRequest(
      `That page has almost no readable text (about ${words} words). It may need JavaScript or a login to show its content. Try a different link or upload a PDF.`
    );
  }
  return { title: title.slice(0, 300), text: truncate(text, limits.extractChars), finalUrl };
}
