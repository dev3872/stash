/**
 * Wikipedia + Wikimedia Commons helpers.
 *
 * - findArticle(name): resolves a topic name to one encyclopedia article
 *   (exact title or redirect first, then search), skipping disambiguation pages.
 * - articleText(article): the article as plain text with headings, minus
 *   reference-style sections, ready for the converters.
 * - articleMedia(title): freely licensed images, animations and videos used
 *   on the article, with captions and attribution.
 *
 * Only the stable Action API (w/api.php) is used. Every call has a timeout and
 * a size cap. Wikimedia asks API clients to send a descriptive User-Agent.
 */
import { badRequest } from '../lib/errors.js';
import { tidyWhitespace } from './text.js';

export const WIKI_LANG = 'en';
const API = `https://${WIKI_LANG}.wikipedia.org/w/api.php`;
// Wikimedia asks API clients to identify themselves with a way to reach the operator.
const userAgent = () => `StashLearningApp/1.0 (educational lessons; ${process.env.WIKIMEDIA_CONTACT?.trim() || 'contact not set'})`;
const MAX_JSON_BYTES = 4 * 1024 * 1024;

export async function wikiApi(params, { timeoutMs = 8000 } = {}) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({ format: 'json', formatversion: '2', ...params })) {
    url.searchParams.set(key, String(value));
  }
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': userAgent(), 'Api-User-Agent': userAgent(), Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const error = new Error(`Wikipedia request failed: ${err?.name || err}`);
    error.wikiUnavailable = true;
    throw error;
  }
  if (!res.ok) {
    const error = new Error(`Wikipedia responded ${res.status}`);
    error.wikiUnavailable = true;
    throw error;
  }
  const text = await res.text();
  if (text.length > MAX_JSON_BYTES) throw new Error('Wikipedia response too large');
  const data = JSON.parse(text);
  if (data.error) throw new Error(`Wikipedia API error: ${data.error.code}`);
  return data;
}

// ---------- article lookup ----------

const isDisambiguation = (page) => Boolean(page?.pageprops && 'disambiguation' in page.pageprops);
const isUsable = (page) => page && !page.missing && !page.invalid && page.ns === 0 && !isDisambiguation(page);

function toArticle(page) {
  return {
    title: page.title,
    pageId: page.pageid,
    url: page.fullurl || `https://${WIKI_LANG}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    leadImage: page.pageimage ? `File:${page.pageimage}` : null,
  };
}

/** Resolves a topic name to an article, or null when nothing suitable exists. */
export async function findArticle(name) {
  const props = { prop: 'pageprops|info|pageimages', inprop: 'url', piprop: 'name', redirects: '1' };

  // 1. Exact title (Wikipedia upper-cases the first letter and follows redirects).
  const exact = await wikiApi({ action: 'query', titles: name, ...props });
  const direct = exact.query?.pages?.[0];
  if (isUsable(direct)) return toArticle(direct);

  // 2. Full-text search; take the best-ranked page that isn't a disambiguation page.
  const search = await wikiApi({
    action: 'query',
    generator: 'search',
    gsrsearch: name,
    gsrlimit: 6,
    gsrnamespace: 0,
    ...props,
  });
  const pages = (search.query?.pages || []).filter(isUsable).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  return pages.length ? toArticle(pages[0]) : null;
}

// ---------- article text ----------

const SKIP_SECTIONS = /^(see also|references|notes|footnotes|citations|sources|bibliography|further reading|external links|works cited|gallery|explanatory notes|general (and cited )?references|primary sources|secondary sources|literature)$/i;

/** Turns a TextExtracts plain-text extract ("== Heading ==" markers) into converter-ready text. */
export function cleanExtract(extract) {
  const out = [];
  let skipping = false;
  let skipLevel = 0;
  for (const rawLine of String(extract || '').split('\n')) {
    const heading = rawLine.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      if (skipping && level > skipLevel) continue; // a subsection of a skipped section
      skipping = SKIP_SECTIONS.test(title);
      skipLevel = level;
      if (!skipping && title) out.push('', title, '');
      continue;
    }
    if (skipping) continue;
    out.push(rawLine);
  }
  return tidyWhitespace(out.join('\n'));
}

export async function articleText(article) {
  const data = await wikiApi(
    { action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'wiki', titles: article.title, redirects: '1' },
    { timeoutMs: 10000 }
  );
  const page = data.query?.pages?.[0];
  return cleanExtract(page?.extract || '');
}

/** Topic name → { article, text }. Throws a 400 the learner can act on. */
export async function lessonSourceForTopic(name) {
  try {
    const article = await findArticle(name);
    if (!article) {
      throw badRequest(`We couldn’t find a Wikipedia article for “${name}”. Try a more common name for the topic, or upload a PDF or paste a link.`);
    }
    return { article, text: await articleText(article) };
  } catch (err) {
    if (err.expose) throw err;
    console.warn(`[wikipedia] ${err.message}`);
    throw badRequest('Wikipedia isn’t reachable right now. Try again in a minute, or upload a PDF or paste a link.');
  }
}

// ---------- media ----------

const SKIP_FILE = /(icon|logo|symbol|flag[ _]of|commons-logo|wiki(pedia|data|source|quote|books|versity|news|species|voyage)|edit-|ambox|question[ _]book|padlock|disambig|portal|stub|crystal[ _]|nuvola|folder|speaker|sound|audio|loudspeaker|signature|coat[ _]of[ _]arms|seal[ _]of|map[ _]marker|red[ _]pog|blank|placeholder|arrow|star[ _]full|star[ _]empty|lock-|increase|decrease|steady)/i;

const IMAGE_MIME = /^image\/(jpeg|png|gif|webp|svg\+xml|tiff)$/;
const VIDEO_MIME = /^video\/webm$/; // WebM plays in current Chrome, Firefox, Edge and Safari

/** Strips tags and entities from Commons' HTML metadata. */
export function plainText(html, max = 300) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function fileLabel(title) {
  return title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
}

/** Converts an imageinfo entry into the media object stored on a post, or null if unsuitable. */
export function toMedia(page, { lead = false } = {}) {
  const info = page?.imageinfo?.[0];
  if (!info || SKIP_FILE.test(page.title)) return null;
  const mime = info.mime || '';
  const isVideo = VIDEO_MIME.test(mime);
  if (!isVideo && !IMAGE_MIME.test(mime)) return null;
  const width = info.thumbwidth || info.width || 0;
  const height = info.thumbheight || info.height || 0;
  if (!isVideo && (info.width < 220 || info.height < 160)) return null;
  if (width && height && (width / height > 3.2 || height / width > 2.6)) return null;

  const meta = info.extmetadata || {};
  const license = plainText(meta.LicenseShortName?.value, 60) || null;
  // Only freely licensed or public-domain files.
  if (!license || !/(cc|creative commons|public domain|pd|gfdl|free art|attribution)/i.test(license)) return null;

  const caption = plainText(meta.ImageDescription?.value, 220) || fileLabel(page.title);
  const credit = plainText(meta.Artist?.value, 90) || plainText(meta.Credit?.value, 90) || null;

  return {
    kind: isVideo ? 'video' : mime === 'image/gif' ? 'animation' : 'image',
    url: isVideo ? info.url : info.thumburl || info.url,
    poster: isVideo ? info.thumburl || null : null,
    mime: isVideo ? mime : 'image',
    width: Math.round(width) || null,
    height: Math.round(height) || null,
    caption,
    credit,
    license,
    pageUrl: info.descriptionurl || null,
    fileTitle: page.title,
    lead,
  };
}

/** All usable media on an article, lead image first. */
export async function articleMedia(article) {
  const data = await wikiApi({
    action: 'query',
    generator: 'images',
    titles: article.title,
    gimlimit: 40,
    redirects: '1',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: 960,
    iiextmetadatafilter: 'ImageDescription|Artist|Credit|LicenseShortName',
    iiextmetadatalanguage: WIKI_LANG,
  });
  const media = [];
  for (const page of data.query?.pages || []) {
    const item = toMedia(page, { lead: page.title === article.leadImage });
    if (item) media.push(item);
  }
  media.sort((a, b) => Number(b.lead) - Number(a.lead) || a.fileTitle.localeCompare(b.fileTitle));
  return media.slice(0, 30);
}
