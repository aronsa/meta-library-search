# Meta Library Search

A meta-search app that queries Boston Public Library (BPL) and Boston Athenaeum simultaneously and returns unified book results.

## Commands

```bash
npm install       # install dependencies
npm start         # start server on http://localhost:3000
npm run dev       # start with auto-reload (watches src/server.js)
npm test          # run integration tests (hits live library APIs)
```

## Architecture

- **Backend**: Express server (`src/server.js`) exposes `GET /api/search?title=...&author=...`
- **Adapters**: Each library has an adapter in `src/adapters/` that normalizes results to a common schema
  - `bpl.js` — queries BiblioCommons RSS feed, parses XML
  - `athenaeum.js` — queries the VuFind catalog ("Athena") RSS search feed (`/Search/Results?...&view=rss`), parses XML. The catalog sits behind an AWS WAF that challenges all HTML/AJAX endpoints; only the RSS view is reachable server-side, so per-record availability/cover enrichment (`getEntity`) fails soft and returns null.
- **Frontend**: Vanilla JS/HTML/CSS in `public/`

## Result Schema

All adapters normalize to:
```js
{
  title, authors, description, publishDate,
  coverImageUrl, libraryPageUrl,
  hostingLibrary: 'BPL' | 'Athenaeum',
  format: 'Book' | 'eBook' | 'Audiobook' | ...
}
```

## Key Behaviors

- Searches run in parallel with `Promise.allSettled()` and an 8-second timeout per library
- One library failing does not block results from the other
- Tests are integration tests that hit live endpoints — no mocking
- Node.js v24 (see `.nvmrc`)
