const { XMLParser } = require('fast-xml-parser');

// The Athenaeum migrated its catalog from the legacy VWebV OPAC to VuFind.
// VuFind exposes search results as an RSS feed (`view=rss`), which — unlike the
// HTML UI and the JSON REST API — is reachable without solving the catalog's
// bot-challenge or holding a privileged API permission. We query that feed and
// normalize it to the shared result schema, mirroring the BPL RSS adapter.
const BASE_URL = 'https://catalog.bostonathenaeum.org';
const SEARCH_URL = `${BASE_URL}/Search/Results`;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === 'item',
});

// Map a (title, author) pair onto VuFind search parameters. With a single field
// VuFind uses the simple `lookfor`/`type` form; with both it uses the grouped
// advanced syntax (lookfor0[]/type0[]/bool0[]) so the terms are ANDed together.
function buildSearchUrl({ title, author }) {
  const fields = [];
  if (title) fields.push(['Title', title]);
  if (author) fields.push(['Author', author]);

  const params = new URLSearchParams({
    view: 'rss',
    sort: 'relevance',
    limit: '20',
    lng: 'en',
  });

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

  const format = (item['dc:format'] ?? '').toString().trim() || 'Book';

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
      'User-Agent': USER_AGENT,
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  });

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

module.exports = { search, getEntity };
