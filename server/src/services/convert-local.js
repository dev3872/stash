/**
 * Deterministic, offline converter: turns extracted text into 4–8 ordered posts.
 *
 * It cannot paraphrase, so it simplifies by selection: it drops citations,
 * parentheticals and reference sections, then picks the shortest, most
 * on-topic sentences from each part of the source. The same input always
 * produces the same posts.
 */
import { badRequest } from '../lib/errors.js';
import { countWords } from './text.js';

const MIN_POSTS = 4;
const MAX_POSTS = 8;
const MIN_SENTENCES = MIN_POSTS * 2;

const STOPWORDS = new Set(`a about above after again against all also although am an and any are as at be because been
before being below between both but by can could did do does doing down during each either else even ever every few for
from further had has have having he her here hers herself him himself his how however i if in into is it its itself just
like made make makes many may me might more most much must my myself never no nor not now of off often on once one only or
other others our ours ourselves out over own per perhaps rather same see seen she should since so some such than that the
their theirs them themselves then there therefore these they this those through thus to too under until up upon us use used
uses using very via was we well were what when where whether which while who whom whose why will with within without would
yet you your yours yourself also first second third new two three many much called known include includes including
example examples instance different large small however another among around based become becomes became given
several various often usually generally typically within across part parts way ways thing things kind lot according
need needs needed nowadays today still really simply just even every whether rather quite able allows allow allowed
want wants take takes taken going good great best better important main mainly much several since toward towards`.split(/\s+/));

const END_SECTIONS = /^(references|bibliography|works cited|citations|notes|footnotes|see also|external links|further reading|sources|acknowledg(e)?ments?|appendix|about the author|related articles|share this|comments)\b/i;

const EXAMPLE_CUE = /\b(for example|for instance|e\.g\.|such as|imagine|think of|picture|like a|like an|similar to|just as|analog(y|ous)|consider|suppose|in other words|compare)\b/i;

const ABBREVIATIONS = ['e.g.', 'i.e.', 'etc.', 'vs.', 'cf.', 'approx.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'St.', 'Jr.', 'Sr.', 'Fig.', 'fig.', 'No.', 'U.S.', 'U.K.', 'Inc.', 'Ltd.', 'al.'];
const DOT = '․'; // one-dot leader, stands in for protected periods

function protectAbbreviations(text) {
  let out = text;
  for (const abbr of ABBREVIATIONS) out = out.split(abbr).join(abbr.replace(/\./g, DOT));
  // Initials ("J. R. R. Tolkien") and decimals ("3.14").
  return out.replace(/\b([A-Z])\.(?=\s?[A-Z])/g, `$1${DOT}`).replace(/(\d)\.(\d)/g, `$1${DOT}$2`);
}

const restoreDots = (text) => text.split(DOT).join('.');

/** Removes citations, URLs and parentheticals: the parts that make text harder to read. */
export function simplifyText(text) {
  return text
    .replace(/\[(\d+[a-z]?|\d+[–-]\d+|citation needed|clarification needed|note \d+|[a-z])\]/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/\(([^()]*\b(19|20)\d{2}[a-z]?\b[^()]*)\)/g, '') // (Smith et al., 2003)
    .replace(/\s*\([^()]{0,120}\)/g, '') // other parentheticals
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

function isHeading(paragraph) {
  const words = countWords(paragraph);
  return words > 0 && words <= 9 && paragraph.length <= 80 && !/[.!?,;:]$/.test(paragraph) && /^[\p{Lu}\d]/u.test(paragraph);
}

function letterRatio(text) {
  const letters = (text.match(/\p{L}/gu) || []).length;
  return letters / Math.max(text.length, 1);
}

function isUsableSentence(sentence) {
  const words = countWords(sentence);
  if (words < 7 || words > 45) return false;
  if (sentence.length < 40 || sentence.length > 320) return false;
  if (letterRatio(sentence) < 0.7) return false;
  if (!/^[\p{Lu}"“'‘\d]/u.test(sentence)) return false;
  if (!/[.!?]["”’')]?$/.test(sentence)) return false;
  if (/\b(click|subscribe|cookie|sign up|log in|all rights reserved|copyright|newsletter|advertisement)\b/i.test(sentence)) return false;
  if (/^(figure|fig|table|chapter|section|page)\b/i.test(sentence)) return false;
  return true;
}

/** Splits text into sentences, remembering the most recent heading for each one. */
export function splitSentences(text) {
  const paragraphs = simplifyText(text).split(/\n{2,}|\n(?=[\p{Lu}])/u).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const sentences = [];
  const seen = new Set();
  let heading = null;
  let section = null;

  for (const paragraph of paragraphs) {
    if (isHeading(paragraph)) {
      if (END_SECTIONS.test(paragraph)) break; // stop at references, "see also", etc.
      heading = paragraph;
      section = paragraph;
      continue;
    }
    const parts = protectAbbreviations(paragraph).split(/(?<=[.!?]["”’')]?)\s+(?=["“'‘(]?[\p{Lu}\d])/u);
    for (const raw of parts) {
      const sentence = restoreDots(raw).trim();
      const key = sentence.toLowerCase();
      if (!isUsableSentence(sentence) || seen.has(key)) continue;
      seen.add(key);
      // Only the first sentence of a section carries its heading.
      sentences.push({ text: sentence, heading, section, index: sentences.length });
      heading = null;
    }
  }
  return sentences;
}

function tokens(text) {
  return (text.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) || [])
    .map((t) => t.replace(/['’]s$/, ''))
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t) && !/ly$/.test(t));
}

const stem = (word) => word.replace(/(ies|es|s)$/, '');

// Sentences that lean on the previous one ("This means…") read poorly on their own.
const DANGLING_START = /^(this|these|that|those|it|its|they|their|such|he|she|here|there|thus|hence|however|but|and|so|also|then|the (battery|result|same|latter|former)\b)/i;

function readabilityPenalty(sentence) {
  const words = sentence.text.split(/\s+/);
  const avgLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  const long = Math.max(0, words.length - 24) * 0.08;
  const commas = (sentence.text.match(/[,;]/g) || []).length * 0.15;
  const dangling = DANGLING_START.test(sentence.text) ? 1 : 0;
  return long + commas + dangling + Math.max(0, avgLen - 5.2) * 0.5;
}

function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** Title candidates for a group, best first: section heading, repeated phrase, keywords. */
function titleCandidates(group, docFreq, groupCount, topicStems) {
  const candidates = [];
  const heading = group.find((s) => s.heading)?.heading;
  if (heading && !/^(contents|introduction|overview|abstract|summary|background)$/i.test(heading) && heading.length <= 70) {
    candidates.push(capitalize(heading));
  }

  const counts = new Map();
  const bigrams = new Map();
  for (const sentence of group) {
    const words = tokens(sentence.text);
    for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
    for (let i = 0; i < words.length - 1; i += 1) {
      const pair = `${words[i]} ${words[i + 1]}`;
      bigrams.set(pair, (bigrams.get(pair) || 0) + 1);
    }
  }

  const score = (word) => {
    const idf = Math.log(1 + groupCount / (docFreq.get(word) || 1));
    return (counts.get(word) || 0) * idf;
  };

  [...bigrams.entries()]
    .filter(([pair, n]) => n >= 2 && !pair.split(' ').every((w) => topicStems.has(stem(w))))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .forEach(([pair]) => candidates.push(capitalize(pair)));

  const ranked = [];
  for (const word of [...counts.keys()]
    .filter((w) => !topicStems.has(stem(w)))
    .sort((a, b) => score(b) - score(a) || a.localeCompare(b))) {
    if (!ranked.some((p) => stem(p) === stem(word))) ranked.push(word);
    if (ranked.length === 4) break;
  }
  if (ranked.length >= 2 && (counts.get(ranked[1]) || 0) >= 2) candidates.push(capitalize(`${ranked[0]} and ${ranked[1]}`));
  // A lone keyword only makes a title when the part keeps coming back to it.
  ranked.filter((word) => (counts.get(word) || 0) >= 2).forEach((word) => candidates.push(capitalize(word)));
  return candidates;
}

const GENERIC_HEADING = /^(contents|introduction|overview|abstract|summary|background|general|description|basics)$/i;

/**
 * Picks a readable title no earlier post has used. In order: the opening part
 * of a source with no heading becomes "Topic: the basics", a section's own heading,
 * "Heading, part 2" when a long section was split, then a repeated phrase,
 * and only then keywords that occur more than once.
 */
function buildTitle(group, docFreq, groupCount, topicStems, index, topicName, used, sectionParts) {
  const first = group[0];
  const own = [];
  if (index === 0 && !first.section && topicName.length <= 50) own.push(`${topicName}: the basics`);
  if (first.section) {
    const section = capitalize(first.section).slice(0, 70);
    const part = (sectionParts.get(first.section) || 0) + 1;
    sectionParts.set(first.section, part);
    if (GENERIC_HEADING.test(first.section)) own.push(part === 1 ? 'The big picture' : `The big picture, part ${part}`);
    else own.push(part === 1 ? section : `${section}, part ${part}`);
  }
  const candidates = [...own, ...titleCandidates(group, docFreq, groupCount, topicStems)];
  const title = candidates.map((t) => t.slice(0, 80)).find((t) => !used.has(t.toLowerCase())) || `${topicName}: part ${index + 1}`;
  used.add(title.toLowerCase());
  return title;
}

/**
 * Groups sentences into 4–8 contiguous parts, following the source's own
 * sections (headings) where it has them, so each post covers one idea.
 */
export function groupSentences(sentences) {
  const target = Math.max(MIN_POSTS, Math.min(MAX_POSTS, Math.floor(sentences.length / 3)));

  let groups = [];
  for (const sentence of sentences) {
    if (!groups.length || sentence.heading) groups.push([]);
    groups[groups.length - 1].push(sentence);
  }

  // Fold tiny sections into a neighbour.
  for (let i = 0; i < groups.length && groups.length > 1; ) {
    if (groups[i].length >= 2) {
      i += 1;
    } else if (i === 0) {
      groups.splice(0, 2, [...groups[0], ...groups[1]]);
    } else {
      groups.splice(i - 1, 2, [...groups[i - 1], ...groups[i]]);
    }
  }

  // Too many sections: merge the smallest adjacent pair.
  while (groups.length > MAX_POSTS) {
    let best = 0;
    for (let i = 1; i < groups.length - 1; i += 1) {
      if (groups[i].length + groups[i + 1].length < groups[best].length + groups[best + 1].length) best = i;
    }
    groups.splice(best, 2, [...groups[best], ...groups[best + 1]]);
  }

  // Too few (or very long) sections: split the largest one in half.
  while (groups.length < target) {
    let largest = 0;
    groups.forEach((g, i) => {
      if (g.length > groups[largest].length) largest = i;
    });
    const group = groups[largest];
    if (group.length < 4) break;
    const mid = Math.ceil(group.length / 2);
    groups.splice(largest, 1, group.slice(0, mid), group.slice(mid));
  }

  // Sections too uneven to reach the minimum: fall back to equal contiguous slices.
  if (groups.length < MIN_POSTS) {
    groups = [];
    for (let i = 0; i < target; i += 1) {
      groups.push(sentences.slice(Math.floor((i * sentences.length) / target), Math.floor(((i + 1) * sentences.length) / target)));
    }
  }
  return groups;
}

export function convertLocally(text, topicName) {
  const sentences = splitSentences(text);
  if (sentences.length < MIN_SENTENCES) {
    throw badRequest(
      `There isn't enough clear, readable text in this source to build a lesson (found ${sentences.length} usable sentences, need at least ${MIN_SENTENCES}). Try a longer article or a different PDF.`
    );
  }

  const groups = groupSentences(sentences);

  const topicStems = new Set(tokens(topicName).map(stem));
  const docFreq = new Map();
  for (const group of groups) {
    for (const word of new Set(group.flatMap((s) => tokens(s.text)))) docFreq.set(word, (docFreq.get(word) || 0) + 1);
  }

  // Sentences that use the document's recurring vocabulary are more on-topic.
  const globalCounts = new Map();
  for (const s of sentences) for (const w of tokens(s.text)) globalCounts.set(w, (globalCounts.get(w) || 0) + 1);
  const relevance = (s) => {
    const words = tokens(s.text);
    if (!words.length) return 0;
    const hits = words.reduce((sum, w) => sum + Math.min(globalCounts.get(w) || 0, 6) + (topicStems.has(stem(w)) ? 3 : 0), 0);
    return hits / words.length;
  };

  const usedTitles = new Set();
  const sectionParts = new Map();
  return groups.map((group, i) => {
    let pool = group;
    let example = null;
    const exampleSentence = group.find((s) => EXAMPLE_CUE.test(s.text));
    if (exampleSentence && group.length - 1 >= 2) {
      example = exampleSentence.text;
      pool = group.filter((s) => s !== exampleSentence);
    }

    const bodyCount = Math.min(3, pool.length);
    const body = [...pool]
      .sort((a, b) => relevance(b) - readabilityPenalty(b) - (relevance(a) - readabilityPenalty(a)) || a.index - b.index)
      .slice(0, bodyCount)
      .sort((a, b) => a.index - b.index)
      .map((s) => s.text)
      .join(' ');

    return {
      title: buildTitle(group, docFreq, groups.length, topicStems, i, topicName, usedTitles, sectionParts).slice(0, 80),
      body,
      example,
    };
  });
}
