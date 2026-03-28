const form = document.getElementById('search-form');
const titleInput = document.getElementById('title-input');
const authorInput = document.getElementById('author-input');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('status');
const bannersEl = document.getElementById('error-banners');
const resultsEl = document.getElementById('results');
const booksOnlyFilter = document.getElementById('books-only-filter');

function setLoading(loading) {
  searchBtn.disabled = loading;
  statusEl.textContent = loading ? 'Searching BPL and the Athenaeum…' : '';
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

function isBook(result) {
  return result.format.toLowerCase() === 'book';
}

function enrichCard(card, result) {
  if (!result.recordId) return;

  const library = result.hostingLibrary === 'BPL' ? 'bpl' : 'athenaeum';

  fetch(`/api/entity?library=${library}&id=${encodeURIComponent(result.recordId)}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;

      // Update availability badge
      const availEl = card.querySelector('.availability-badge');
      if (availEl) {
        if (data.availability === null || data.availability === undefined) {
          availEl.remove();
        } else {
          const isAvail = data.availability === 'available';
          let label = isAvail ? 'Available' : 'Checked out';
          if (data.totalCopies !== null && data.totalCopies !== undefined) {
            label += ` · ${data.availableCopies} / ${data.totalCopies} cop${data.totalCopies === 1 ? 'y' : 'ies'}`;
          }
          availEl.textContent = label;
          availEl.className = `availability-badge ${isAvail ? 'avail-yes' : 'avail-no'}`;
        }
      }

      // Update cover image if we didn't already have one
      if (data.coverImageUrl && !result.coverImageUrl) {
        const coverEl = card.querySelector('.result-cover');
        const noCoverEl = coverEl?.querySelector('.no-cover');
        if (noCoverEl) {
          const img = document.createElement('img');
          img.src = data.coverImageUrl;
          img.alt = result.title;
          img.onerror = () => img.replaceWith(noCover());
          noCoverEl.replaceWith(img);
        }
      }
    })
    .catch(() => {
      const availEl = card.querySelector('.availability-badge');
      if (availEl) availEl.remove();
    });
}

function renderCard(result) {
  const card = document.createElement('a');
  card.className = 'result-card';
  card.href = result.libraryPageUrl;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

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
  titleEl.textContent = result.title;

  const authorEl = document.createElement('div');
  authorEl.className = 'result-author';
  authorEl.textContent = result.authors.join(', ');

  const meta = document.createElement('div');
  meta.className = 'result-meta';

  const libBadge = document.createElement('span');
  libBadge.className = `badge ${libraryBadgeClass(result.hostingLibrary)}`;
  libBadge.textContent = result.hostingLibrary === 'BPL' ? 'BPL' : 'Athenaeum';

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

  // Availability placeholder (lazy-loaded)
  if (result.recordId) {
    const availEl = document.createElement('span');
    availEl.className = 'availability-badge avail-loading';
    availEl.textContent = 'checking…';
    meta.appendChild(availEl);
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

  const booksOnly = booksOnlyFilter.checked;
  const filtered = booksOnly ? data.results.filter(isBook) : data.results;

  if (filtered.length === 0) {
    statusEl.textContent = booksOnly
      ? 'No books found. Try unchecking "Books only".'
      : 'No results found.';
    return;
  }

  statusEl.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''} found`;

  for (const result of filtered) {
    const card = renderCard(result);
    if (card) {
      resultsEl.appendChild(card);
      // Lazy-load availability after card is in DOM
      requestAnimationFrame(() => enrichCard(card, result));
    }
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
    window._lastSearchData = data;
    showBanners(data.errors);
    renderResults(data);
  } catch (err) {
    statusEl.textContent = 'Search failed — please try again.';
    console.error(err);
  } finally {
    setLoading(false);
  }
});

// Re-filter in place when checkbox changes (without re-fetching)
booksOnlyFilter.addEventListener('change', () => {
  const cards = resultsEl.querySelectorAll('.result-card');
  // If we have loaded results, trigger a fresh render from last data
  // We track last data on the form submit handler
  if (window._lastSearchData) {
    renderResults(window._lastSearchData);
  }
});
