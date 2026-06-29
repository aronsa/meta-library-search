const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { search } = require('./athenaeum');

// Helper: assert every result has the full normalized shape
function assertShape(results, label) {
  assert.ok(results.length > 0, `${label}: expected at least one result`);
  for (const r of results) {
    assert.ok(typeof r.title === 'string' && r.title.length > 0, `${label}: title must be non-empty string`);
    assert.ok(Array.isArray(r.authors), `${label}: authors must be array`);
    assert.ok(typeof r.description === 'string', `${label}: description must be string`);
    assert.ok('publishDate' in r, `${label}: missing publishDate`);
    assert.ok('coverImageUrl' in r, `${label}: missing coverImageUrl`);
    assert.ok(typeof r.libraryPageUrl === 'string' && r.libraryPageUrl.startsWith('http'), `${label}: libraryPageUrl must be a URL`);
    assert.equal(r.hostingLibrary, 'Athenaeum', `${label}: hostingLibrary must be Athenaeum`);
    assert.ok(typeof r.format === 'string' && r.format.length > 0, `${label}: format must be non-empty string`);
  }
}

// --- title + author ---

describe('Athenaeum title + author searches', () => {
  test('On the Road — Kerouac (multi-result)', async () => {
    const results = await search({ title: 'On the Road', author: 'Kerouac' });
    assertShape(results, 'On the Road / Kerouac');
    assert.ok(results.some(r => r.title.toLowerCase().includes('road')));
  });

  test('Beloved — Morrison', async () => {
    const results = await search({ title: 'Beloved', author: 'Morrison' });
    assertShape(results, 'Beloved / Morrison');
    assert.ok(results.some(r => r.title.toLowerCase().includes('beloved')));
  });

  test('Courage to Act — Bernanke (single result)', async () => {
    // This query returns exactly 1 result; VuFind still renders a normal feed.
    const results = await search({ title: 'Courage to Act', author: 'Bernanke' });
    assertShape(results, 'Courage to Act / Bernanke');
    assert.ok(results[0].title.toLowerCase().includes('courage'));
    // VuFind record links look like .../Record/ba518028
    assert.ok(results[0].libraryPageUrl.includes('/Record/'));
  });

  test('Middlemarch — Eliot', async () => {
    const results = await search({ title: 'Middlemarch', author: 'Eliot' });
    assertShape(results, 'Middlemarch / Eliot');
    assert.ok(results.some(r => r.title.toLowerCase().includes('middlemarch')));
  });

  test('The Remains of the Day — Ishiguro', async () => {
    const results = await search({ title: 'Remains of the Day', author: 'Ishiguro' });
    assertShape(results, 'Remains of the Day / Ishiguro');
    assert.ok(results.some(r => r.title.toLowerCase().includes('remains')));
  });

  test('Moby-Dick — Melville', async () => {
    const results = await search({ title: 'Moby Dick', author: 'Melville' });
    assertShape(results, 'Moby Dick / Melville');
    assert.ok(results.some(r => r.title.toLowerCase().includes('moby')));
  });
});

// --- title only ---

describe('Athenaeum title-only searches', () => {
  test('The Great Gatsby', async () => {
    const results = await search({ title: 'The Great Gatsby', author: '' });
    assertShape(results, 'The Great Gatsby');
    assert.ok(results.some(r => r.title.toLowerCase().includes('gatsby')));
  });

  test('Middlemarch', async () => {
    const results = await search({ title: 'Middlemarch', author: '' });
    assertShape(results, 'Middlemarch title-only');
    assert.ok(results.some(r => r.title.toLowerCase().includes('middlemarch')));
  });

  test('Annihilation', async () => {
    const results = await search({ title: 'Annihilation', author: '' });
    assertShape(results, 'Annihilation title-only');
    assert.ok(results.length > 0);
  });
});

// --- author only ---

describe('Athenaeum author-only searches', () => {
  test('Toni Morrison', async () => {
    const results = await search({ title: '', author: 'Morrison' });
    assertShape(results, 'author: Morrison');
    assert.ok(results.some(r => r.authors.some(a => a.toLowerCase().includes('morrison'))));
  });

  test('Hemingway', async () => {
    const results = await search({ title: '', author: 'Hemingway' });
    assertShape(results, 'author: Hemingway');
    assert.ok(results.some(r => r.authors.some(a => a.toLowerCase().includes('hemingway'))));
  });

  test('Ursula Le Guin', async () => {
    const results = await search({ title: '', author: 'Le Guin' });
    assertShape(results, 'author: Le Guin');
    assert.ok(results.some(r => r.authors.some(a => a.toLowerCase().includes('guin'))));
  });
});
