import dns from 'node:dns/promises';
import net from 'node:net';
import { badRequest } from '../lib/errors.js';

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const PRIVATE_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([base, bits]) => [ipv4ToInt(base), bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0]);

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, mask]) => (n & mask) === (base & mask));
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw badRequest("Links to local or private addresses aren't allowed.");
  }
  let addresses;
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((entry) => entry.address);
    } catch {
      throw badRequest(`Couldn't find a website at ${host}. Check the link for typos.`);
    }
  }
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw badRequest("Links to local or private addresses aren't allowed.");
  }
}

async function readCapped(res, maxBytes) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // Keep what we have; the start of a page is where the article lives.
      chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Fetches an HTML page with a total time budget, a size cap, manual redirect
 * handling, and a check that every hop resolves to a public address.
 */
export async function fetchHtml(rawUrl, { timeoutMs, maxBytes }) {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = new URL(rawUrl);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (current.protocol !== 'http:' && current.protocol !== 'https:') {
        throw badRequest('Only http and https links are supported.');
      }
      await assertPublicHost(current.hostname);

      const res = await fetch(current, {
        redirect: 'manual',
        signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StashReader/1.0; educational summaries)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'Accept-Language': 'en;q=0.9,*;q=0.5',
        },
      });

      if (REDIRECT_CODES.has(res.status)) {
        const location = res.headers.get('location');
        await res.body?.cancel().catch(() => {});
        if (!location) throw badRequest('The page redirected without saying where to.');
        current = new URL(location, current);
        continue;
      }

      if (res.status !== 200) {
        await res.body?.cancel().catch(() => {});
        throw badRequest(`The page responded with HTTP ${res.status}, so it couldn't be read. Check the link and try again.`);
      }

      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) {
        await res.body?.cancel().catch(() => {});
        const shown = type.split(';')[0] || 'an unknown type';
        const hint = type.includes('pdf') ? ' To use a PDF, download it and upload the file instead.' : '';
        throw badRequest(`That link returns ${shown}, not a web page.${hint}`);
      }

      const html = await readCapped(res, maxBytes);
      return { html, finalUrl: current.href };
    }
    throw badRequest('The page redirected too many times.');
  } catch (err) {
    if (err?.expose) throw err;
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw badRequest('The page took too long to respond. Try again or use a different link.');
    }
    throw badRequest(`Couldn't load that page (${err?.cause?.code || err?.message || 'network error'}).`);
  }
}
