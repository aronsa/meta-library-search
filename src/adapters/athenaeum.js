const { XMLParser } = require('fast-xml-parser');

// The Athenaeum catalog ("Athena") migrated from the old VWebV OPAC to VuFind.
// VuFind sits behind an AWS WAF that issues a JavaScript "challenge" to every
// HTML/AJAX request, which a server-side client cannot solve. The one endpoint
// the WAF leaves open is the RSS view of a search result set
// (`/Search/Results?...&view=rss`), so the adapter drives search through that
// machine-readable feed instead of scraping HTML.
const BASE_URL = 'https://catalog.bostonathenaeum.org';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item',
});

// Build a VuFind search-results RSS URL.
// - title + author  -> advanced search (two AND-joined field groups)
// - title only      -> simple Title search
// - author only     -> simple Author search
function buildSearchUrl({ title, author }) {
  const params = new URLSearchParams();

  if (title && author) {
    params.append('join', 'AND');
    params.append('lookfor0[]', title);
    params.append('type0[]', 'Title');
    params.append('lookfor0[]', author);
    params.append('type0[]', 'Author');
  } else if (title) {
    params.append('lookfor', title);
    params.append('type', 'Title');
  } else {
    params.append('lookfor', author);
    params.append('type', 'Author');
  }

  // The RSS view defaults to `sort=last_indexed desc`; force relevance so the
  // most pertinent records surface first.
  params.append('sort', 'relevance');
  params.append('limit', '50');
  params.append('view', 'rss');

  return `${BASE_URL}/Search/Results?${params}`;
}

// VuFind authors arrive as "Surname, First, 1900-1980." — trim a trailing period.
function cleanAuthor(value) {
  return String(value ?? '').replace(/\.\s*$/, '').trim();
}

function recordIdFromLink(link) {
  const match = String(link ?? '').match(/\/Record\/([^/?#]+)/);
  return match ? match[1] : null;
}

function normalizeItem(item) {
  const title = String(item.title ?? '').trim();
  const link = item.link ?? '';
  const author = cleanAuthor(item['dc:creator'] ?? item.author ?? '');
  const pubDate = item['dc:date'] ? String(item['dc:date']).trim() : null;
  const format = String(item['dc:format'] ?? '').trim() || 'Book';

  return {
    title,
    authors: author ? [author] : [],
    description: '',
    publishDate: pubDate,
    coverImageUrl: null,
    libraryPageUrl: link || BASE_URL,
    hostingLibrary: 'Athenaeum',
    format,
    recordId: recordIdFromLink(link),
  };
}

async function search({ title, author }) {
  const url = buildSearchUrl({ title, author });

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'meta-library-search/1.0',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  });

  if (!res.ok) throw new Error(`Athenaeum returned HTTP ${res.status}`);

  const xml = await res.text();

  // If the WAF ever starts challenging the RSS view too, we get an HTML
  // challenge page instead of a feed — surface that as a clear failure.
  if (res.headers.get('x-amzn-waf-action') || !xml.includes('<rss')) {
    throw new Error('Athenaeum: blocked by catalog WAF challenge');
  }

  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];

  return items
    .map(normalizeItem)
    .filter((r) => r.title.length > 0);
}

// Per-record availability and cover data live on the VuFind record/AJAX
// endpoints, all of which sit behind the WAF challenge and are therefore
// unreachable from a server-side client. We still attempt the record page so
// the enrichment works automatically if the catalog is ever opened up, but we
// detect the challenge and fail soft (the UI simply omits the availability
// badge and cover when this returns null).
async function getEntity(recordId) {
  const url = `${BASE_URL}/Record/${encodeURIComponent(recordId)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'meta-library-search/1.0' } });
  if (!res.ok || res.headers.get('x-amzn-waf-action')) return null;

  const html = await res.text();
  if (html.includes('awsWafCookieDomainList') || !html.includes('</html>')) return null;

  const cheerio = require('cheerio');
  const $ = cheerio.load(html);

  const isbnMatch = html.match(/\b(97[89][\d-]{10,16}|\d{9}[\dXx])\b/);
  const isbn = isbnMatch ? isbnMatch[0].replace(/-/g, '') : null;
  const coverImageUrl = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : null;

  let availableCount = 0;
  let totalCount = 0;
  $('table tr').each((_, row) => {
    const statusText = $(row).find('td').last().text().toLowerCase().trim();
    if (!statusText) return;
    if (statusText.includes('available') || statusText.includes('on shelf') || statusText.includes('in library')) {
      availableCount++;
      totalCount++;
    } else if (/checked|due|loan|transit|hold/.test(statusText)) {
      totalCount++;
    }
  });

  const availability = totalCount === 0 ? null : (availableCount > 0 ? 'available' : 'unavailable');
  return {
    availability,
    availableCopies: totalCount > 0 ? availableCount : null,
    totalCopies: totalCount > 0 ? totalCount : null,
    coverImageUrl,
  };
}

module.exports = { search, getEntity };
