const { XMLParser } = require('fast-xml-parser');

// The Athenaeum migrated its catalog from the legacy VWebV OPAC to VuFind.
// VuFind exposes search results as an RSS feed (`view=rss`), which — unlike the
// JSON REST API — needs no privileged API permission. We query that feed and
// normalize it to the shared result schema, mirroring the BPL RSS adapter.
// Since October 2026 the whole catalog, feed included, is behind AWS WAF, so
// automated requests get a captcha/block page; see the check in search().
const BASE_URL = 'https://catalog.bostonathenaeum.org';
const SEARCH_URL = `${BASE_URL}/Search/Results`;

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === 'item',
});

// Map a (title, author) pair onto VuFind search parameters. With a single field
// VuFind uses the simple `lookfor`/`type` form; with both it uses the grouped
// advanced syntax (lookfor0[]/type0[]/bool0[]) so the terms are ANDed together.
// With `rss: false` it returns the human-facing results page instead of the feed.
function buildSearchUrl({ title, author }, { rss = true } = {}) {
  const fields = [];
  if (title) fields.push(['Title', title]);
  if (author) fields.push(['Author', author]);

  const params = new URLSearchParams({
    sort: 'relevance',
    limit: '20',
    lng: 'en',
  });
  if (rss) params.set('view', 'rss');

  if (fields.length === 1) {
    params.set('lookfor', fields[0][1]);
    params.set('type', fields[0][0]);
  } else if (fields.length === 2) {
    params.set('join', 'AND');
    for (const [type, term] of fields) {
      params.append('lookfor0[]', term);
      params.append('type0[]', type);
    }
    params.append('bool0[]', 'AND');
  }

  return `${SEARCH_URL}?${params}`;
}

function normalizeItem(item) {
  const title = (item.title ?? '').toString().trim();

  const link = (item.link ?? '').toString();
  // Record links look like https://catalog.bostonathenaeum.org/Record/ba518028
  const recordId = link ? link.split('/').pop() || null : null;

  // dc:creator carries the authoritative author heading; fall back to <author>.
  const rawCreators = item['dc:creator'] ?? item.author ?? [];
  const authors = [].concat(rawCreators)
    .map((c) => c.toString().trim())
    .filter(Boolean);

  // dc:format can repeat: a leading genre/content-type facet (e.g. "Manuscript",
  // "Conference Proceeding") followed by the actual physical-format facet we
  // want (e.g. "Book", "Map"). fast-xml-parser only returns an array when the
  // tag repeats, so normalize to an array first and take the last entry —
  // naively `.toString()`-ing a repeated tag would join it into "Manuscript,Book".
  const rawFormats = [].concat(item['dc:format'] ?? []);
  const format = (rawFormats[rawFormats.length - 1] ?? '').toString().trim() || 'Book';

  const rawDate = item['dc:date'];
  const publishDate =
    rawDate !== undefined && rawDate !== null && rawDate !== ''
      ? rawDate.toString().trim()
      : null;

  return {
    title,
    authors,
    description: '',
    publishDate,
    coverImageUrl: null,
    libraryPageUrl: link,
    hostingLibrary: 'Athenaeum',
    format,
    recordId,
  };
}

function parseResults(xml) {
  const parsed = parser.parse(xml);
  const items = [].concat(parsed?.rss?.channel?.item ?? []);
  return items.map(normalizeItem).filter((r) => r.title);
}

async function search({ title, author }) {
  const url = buildSearchUrl({ title, author });

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'meta-library-search/1.0',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  });

  // The catalog sits behind AWS WAF, which answers automated clients with a
  // captcha/block page instead of the feed. Only a human in a browser can pass it.
  if (res.headers.get('x-amzn-waf-action')) {
    throw new Error('catalog is blocking automated searches');
  }
  if (!res.ok) throw new Error(`Athenaeum returned HTTP ${res.status}`);

  const xml = await res.text();
  return parseResults(xml);
}

// Per-record enrichment (availability counts, cover art) is no longer available
// to anonymous clients: VuFind's record pages, cover proxy and AJAX status
// endpoints all sit behind the catalog's bot-challenge, and its JSON REST API
// rejects unprivileged callers. We return the empty shape so the UI degrades
// gracefully (no availability badge, "No cover" placeholder).
async function getEntity(_recordId) {
  return {
    availability: null,
    availableCopies: null,
    totalCopies: null,
    coverImageUrl: null,
  };
}

// The same search on the catalog's own site, for users to open in their browser
// when our server-side search is unavailable.
function catalogSearchUrl(query) {
  return buildSearchUrl(query, { rss: false });
}

module.exports = { search, getEntity, catalogSearchUrl };
