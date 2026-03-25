const { XMLParser } = require('fast-xml-parser');

const SEARCH_BASE = 'https://gateway.bibliocommons.com/v2/libraries/bpl/rss/search';

const FORMAT_MAP = {
  BK: 'Book',
  EBOOK: 'eBook',
  AB: 'Audiobook',
  EAUDIOBOOK: 'Audiobook',
  EB: 'eBook',
  DVD: 'DVD',
  MUSIC: 'Music',
  BOOK_CD: 'Book + CD',
};

const parser = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: '__cdata',
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item' || name === 'category',
});

function buildQuery({ title, author }) {
  const parts = [];
  if (title) parts.push(`title:(${title})`);
  if (author) parts.push(`contributor:(${author})`);
  return `(${parts.join(' AND ')})`;
}

function normalizeItem(item) {
  const title = item.title?.__cdata ?? item.title ?? '';
  const description = item.description?.__cdata ?? item.description ?? '';
  const author = item['dc:creator']?.__cdata ?? item['dc:creator'] ?? '';
  const link = item.link ?? '';
  const imageUrl = item.image_url ?? null;

  // category appears twice: first is format code, second is language
  const categories = [].concat(item.category ?? []);
  const rawFormat = (categories[0]?.__cdata ?? categories[0] ?? '').trim();
  const format = FORMAT_MAP[rawFormat] ?? rawFormat ?? 'Book';

  const pubDate = item.pubDate
    ? new Date(item.pubDate).getFullYear().toString()
    : null;

  return {
    title,
    authors: author ? [author] : [],
    description,
    publishDate: pubDate,
    coverImageUrl: imageUrl,
    libraryPageUrl: link,
    hostingLibrary: 'BPL',
    format,
  };
}

async function search({ title, author }) {
  const query = buildQuery({ title, author });
  const url = `${SEARCH_BASE}?${new URLSearchParams({
    query,
    origin: 'meta-library-search',
    searchType: 'bl',
  })}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'meta-library-search/1.0' },
  });

  if (!res.ok) throw new Error(`BPL returned HTTP ${res.status}`);

  const xml = await res.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];

  return items.map(normalizeItem);
}

module.exports = { search };
