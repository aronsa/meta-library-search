const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { search, getAvailability } = require('./bpl');

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
    assert.equal(r.hostingLibrary, 'BPL', `${label}: hostingLibrary must be BPL`);
    assert.ok(typeof r.format === 'string' && r.format.length > 0, `${label}: format must be non-empty string`);
  }
}

// --- title + author ---

describe('BPL title + author searches', () => {
  test('On the Road — Kerouac', async () => {
    const results = await search({ title: 'On the Road', author: 'Kerouac' });
    assertShape(results, 'On the Road / Kerouac');
    assert.ok(results.some(r => r.title.toLowerCase().includes('road')), 'Expected a result with "road" in title');
  });

  test('Beloved — Morrison', async () => {
    const results = await search({ title: 'Beloved', author: 'Morrison' });
    assertShape(results, 'Beloved / Morrison');
    assert.ok(results.some(r => r.title.toLowerCase().includes('beloved')));
  });

  test('Courage to Act — Bernanke', async () => {
    const results = await search({ title: 'Courage to Act', author: 'Bernanke' });
    assertShape(results, 'Courage to Act / Bernanke');
    assert.ok(results.some(r => r.title.toLowerCase().includes('courage')));
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

  test('Annihilation — VanderMeer', async () => {
    const results = await search({ title: 'Annihilation', author: 'VanderMeer' });
    assertShape(results, 'Annihilation / VanderMeer');
    assert.ok(results.some(r => r.title.toLowerCase().includes('annihilation')));
  });
});

// --- title only ---

describe('BPL title-only searches', () => {
  test('Moby Dick', async () => {
    const results = await search({ title: 'Moby Dick', author: '' });
    assertShape(results, 'Moby Dick');
    assert.ok(results.some(r => r.title.toLowerCase().includes('moby')));
  });

  test('The Great Gatsby', async () => {
    const results = await search({ title: 'The Great Gatsby', author: '' });
    assertShape(results, 'The Great Gatsby');
    assert.ok(results.some(r => r.title.toLowerCase().includes('gatsby')));
  });

  test('1984', async () => {
    const results = await search({ title: '1984', author: '' });
    assertShape(results, '1984');
    assert.ok(results.length > 0);
  });
});

// --- author only ---

describe('BPL author-only searches', () => {
  test('Toni Morrison', async () => {
    const results = await search({ title: '', author: 'Toni Morrison' });
    assertShape(results, 'author: Toni Morrison');
    assert.ok(results.some(r => r.authors.some(a => a.toLowerCase().includes('morrison'))));
  });

  test('Ursula Le Guin', async () => {
    const results = await search({ title: '', author: 'Le Guin' });
    assertShape(results, 'author: Le Guin');
    assert.ok(results.some(r => r.authors.some(a => a.toLowerCase().includes('guin'))));
  });

  test('Hemingway', async () => {
    const results = await search({ title: '', author: 'Hemingway' });
    assertShape(results, 'author: Hemingway');
    assert.ok(results.some(r => r.authors.some(a => a.toLowerCase().includes('hemingway'))));
  });
});

// --- availability ---

describe('BPL getAvailability', () => {
  test('returns a valid status for a known record', async () => {
    const results = await search({ title: 'Moby Dick', author: 'Melville' });
    const withId = results.find(r => r.recordId);
    assert.ok(withId, 'Expected at least one result with a recordId');
    const status = await getAvailability(withId.recordId);
    assert.ok(
      status === 'available' || status === 'unavailable' || status === null,
      `Expected valid status, got: ${status}`
    );
  });
});
