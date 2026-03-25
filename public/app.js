const form = document.getElementById('search-form');
const titleInput = document.getElementById('title-input');
const authorInput = document.getElementById('author-input');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('status');
const bannersEl = document.getElementById('error-banners');
const resultsEl = document.getElementById('results');

function setLoading(loading) {
  searchBtn.disabled = loading;
  statusEl.textContent = loading ? 'Searching BPL and Boston Athenaeum…' : '';
}

function showBanners(errors) {
  bannersEl.innerHTML = '';
  const labels = { bpl: 'Boston Public Library', athenaeum: 'Boston Athenaeum' };
  for (const [key, msg] of Object.entries(errors)) {
    if (!msg) continue;
    const div = document.createElement('div');
    div.className = 'error-banner';
    div.textContent = `${labels[key]} results unavailable (${msg})`;
    bannersEl.appendChild(div);
  }
}

function formatBadgeClass(format) {
  const f = format.toLowerCase();
  if (f.includes('ebook') || f.includes('e-book')) return 'badge-format-ebook';
  if (f.includes('audio')) return 'badge-format-audio';
  if (f === 'book') return 'badge-format-book';
  return 'badge-format-other';
}

function libraryBadgeClass(hostingLibrary) {
  return hostingLibrary === 'BPL' ? 'badge-library-bpl' : 'badge-library-ath';
}

function renderCard(result) {
  const card = document.createElement('div');
  card.className = 'result-card';

  // Cover
  const coverEl = document.createElement('div');
  coverEl.className = 'result-cover';
  if (result.coverImageUrl) {
    const img = document.createElement('img');
    img.src = result.coverImageUrl;
    img.alt = result.title;
    img.onerror = () => {
      img.replaceWith(noCover());
    };
    coverEl.appendChild(img);
  } else {
    coverEl.appendChild(noCover());
  }

  // Body
  const body = document.createElement('div');
  body.className = 'result-body';

  const titleEl = document.createElement('div');
  titleEl.className = 'result-title';
  const link = document.createElement('a');
  link.href = result.libraryPageUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = result.title;
  titleEl.appendChild(link);

  const authorEl = document.createElement('div');
  authorEl.className = 'result-author';
  authorEl.textContent = result.authors.join(', ');

  const meta = document.createElement('div');
  meta.className = 'result-meta';

  const libBadge = document.createElement('span');
  libBadge.className = `badge ${libraryBadgeClass(result.hostingLibrary)}`;
  libBadge.textContent = result.hostingLibrary;

  const fmtBadge = document.createElement('span');
  fmtBadge.className = `badge ${formatBadgeClass(result.format)}`;
  fmtBadge.textContent = result.format;

  meta.appendChild(libBadge);
  meta.appendChild(fmtBadge);

  if (result.publishDate) {
    const year = document.createElement('span');
    year.className = 'result-year';
    year.textContent = result.publishDate;
    meta.appendChild(year);
  }

  body.appendChild(titleEl);
  body.appendChild(authorEl);

  if (result.description) {
    const desc = document.createElement('div');
    desc.className = 'result-description';
    desc.textContent = result.description;
    body.appendChild(desc);
  }

  body.appendChild(meta);
  card.appendChild(coverEl);
  card.appendChild(body);
  return card;
}

function noCover() {
  const div = document.createElement('div');
  div.className = 'no-cover';
  div.textContent = 'No cover';
  return div;
}

function renderResults(data) {
  resultsEl.innerHTML = '';

  if (data.results.length === 0) {
    statusEl.textContent = 'No results found.';
    return;
  }

  statusEl.textContent = `${data.results.length} result${data.results.length !== 1 ? 's' : ''} found`;

  for (const result of data.results) {
    const card = renderCard(result);
    if (card) resultsEl.appendChild(card);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  if (!title && !author) return;

  setLoading(true);
  resultsEl.innerHTML = '';
  bannersEl.innerHTML = '';

  try {
    const params = new URLSearchParams({ title, author });
    const res = await fetch(`/api/search?${params}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    showBanners(data.errors);
    renderResults(data);
  } catch (err) {
    statusEl.textContent = 'Search failed — please try again.';
    console.error(err);
  } finally {
    setLoading(false);
  }
});
