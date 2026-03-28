const cheerio = require('cheerio');

const BASE_URL = 'https://catalog.bostonathenaeum.org/vwebv';
const SEED_URL = `${BASE_URL}/search`;

async function seedSession() {
  const res = await fetch(SEED_URL, {
    headers: { 'User-Agent': 'meta-library-search/1.0' },
  });
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error('Athenaeum: no session cookie received');
  // Extract just the JSESSIONID=value portion
  return cookie.split(';')[0];
}

function buildSearchUrl({ title, author }) {
  const params = new URLSearchParams({
    searchArg1: title,
    argType1: 'phrase',
    searchCode1: 'TKEY',
    combine2: 'and',
    searchArg2: author,
    argType2: 'phrase',
    searchCode2: 'NKEY',
    combine3: 'and',
    searchArg3: '',
    argType3: 'any',
    searchCode3: 'GKEY',
    recCount: '50',
    searchType: '2',
    'page.search.search.button': 'Search',
  });
  return `${SEED_URL}?${params}`;
}

function parseResults(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('#resultList > div.oddRow, #resultList > div.evenRow').each((_, el) => {
    const titleEl = $(el).find('.line1Link a');
    const title = titleEl.text().trim();
    if (!title) return;

    const relativeHref = titleEl.attr('href') ?? '';
    const bibIdMatch = relativeHref.match(/bibId=(\d+)/);
    const bibId = bibIdMatch?.[1];
    const libraryPageUrl = bibId
      ? `${BASE_URL}/holdingsInfo?bibId=${bibId}`
      : `${BASE_URL}/${relativeHref}`;

    const author = $(el).find('.line2Link').text().replace(/\u00a0/g, '').trim();
    const pubDate = $(el).find('.line3Link').text().replace(/\u00a0/g, '').trim();
    const format = $(el).find('.resultListIcon img').attr('title') ?? 'Book';

    results.push({
      title,
      authors: author ? [author] : [],
      description: '',
      publishDate: pubDate || null,
      coverImageUrl: null,
      libraryPageUrl,
      hostingLibrary: 'Athenaeum',
      format,
      recordId: bibId || null,
    });
  });

  return results;
}

async function search({ title, author }) {
  const cookie = await seedSession();
  const searchUrl = buildSearchUrl({ title, author });

  const res = await fetch(searchUrl, {
    headers: {
      'Cookie': cookie,
      'User-Agent': 'meta-library-search/1.0',
    },
  });

  if (!res.ok) throw new Error(`Athenaeum returned HTTP ${res.status}`);

  const html = await res.text();

  // Single-result: OPAC renders holdings page inline (URL stays at /search)
  // Detect by presence of the holdings page marker in the body onLoad attribute
  if (html.includes("setFocus('page.holdingsInfo')")) {
    const $ = cheerio.load(html);
    const bibIdMatch = html.match(/bibId=(\d+)/);
    const bibId = bibIdMatch?.[1];
    const title = $('.bibTitle p').first().text().replace(/\s*\/\s*$/, '').trim();
    const authorsRaw = [];
    $('.fieldLabelSpan').each((_, el) => {
      const label = $(el).text().trim();
      if (label === 'Main Author:' || label === 'Author:') {
        const val = $(el).siblings('.subfieldData').text().trim()
          .replace(/,?\s*author\.?$/, '').trim();
        if (val) authorsRaw.push(val);
      }
    });
    return [{
      title: title || 'Unknown title',
      authors: authorsRaw,
      description: '',
      publishDate: null,
      coverImageUrl: null,
      libraryPageUrl: bibId ? `${BASE_URL}/holdingsInfo?bibId=${bibId}` : res.url,
      hostingLibrary: 'Athenaeum',
      format: 'Book',
      recordId: bibId || null,
    }];
  }

  return parseResults(html);
}

async function getEntity(bibId) {
  const url = `${BASE_URL}/holdingsInfo?bibId=${encodeURIComponent(bibId)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'meta-library-search/1.0' } });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);

  // Extract ISBN from the holdings page and build an Open Library cover URL
  const isbnMatch = html.match(/ISBN[:\s]*([\d-]{10,17})/i);
  const isbn = isbnMatch ? isbnMatch[1].replace(/-/g, '') : null;
  const coverImageUrl = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : null;

  let availableCount = 0;
  let totalCount = 0;

  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const statusText = $(cells.last()).text().toLowerCase().trim();
    if (!statusText) return;
    if (statusText.includes('available') || statusText.includes('in library') || statusText.includes('on shelf')) {
      availableCount++;
      totalCount++;
    } else if (
      statusText.includes('checked') ||
      statusText.includes('due') ||
      statusText.includes('loan') ||
      statusText.includes('transit') ||
      statusText.includes('hold')
    ) {
      totalCount++;
    }
  });

  const availability = totalCount === 0 ? null : (availableCount > 0 ? 'available' : 'unavailable');
  const availableCopies = totalCount > 0 ? availableCount : null;
  const totalCopies = totalCount > 0 ? totalCount : null;
  return { availability, availableCopies, totalCopies, coverImageUrl };
}

module.exports = { search, getEntity };
