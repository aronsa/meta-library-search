const express = require('express');
const path = require('path');
const { search: searchBPL, getEntity: getBPLEntity } = require('./adapters/bpl');
const { search: searchAthenaeum, getEntity: getAthenaeumEntity } = require('./adapters/athenaeum');

const app = express();
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

app.use(express.static(path.join(__dirname, '..', 'public')));

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);

app.get('/api/search', async (req, res) => {
  const { title = '', author = '' } = req.query;
  if (!title.trim() && !author.trim()) {
    return res.status(400).json({ error: 'Provide at least a title or author' });
  }

  const query = { title: title.trim(), author: author.trim() };

  const [athResult, bplResult] = await Promise.allSettled([
    withTimeout(searchAthenaeum(query), 8000),
    withTimeout(searchBPL(query), 8000),
  ]);

  // Athenaeum results first, then BPL
  const results = [
    ...(athResult.status === 'fulfilled' ? athResult.value : []),
    ...(bplResult.status === 'fulfilled' ? bplResult.value : []),
  ];

  res.json({
    results,
    errors: {
      athenaeum: athResult.status === 'rejected' ? athResult.reason.message : null,
      bpl: bplResult.status === 'rejected' ? bplResult.reason.message : null,
    },
  });
});

app.get('/api/entity', async (req, res) => {
  const { library, id } = req.query;
  if (!library || !id) {
    return res.status(400).json({ error: 'Requires library and id' });
  }

  try {
    let entity = null;
    if (library === 'bpl') {
      entity = await withTimeout(getBPLEntity(id), 6000);
    } else if (library === 'athenaeum') {
      entity = await withTimeout(getAthenaeumEntity(id), 6000);
    }
    return res.json(entity || { availability: null, coverImageUrl: null });
  } catch (e) {
    return res.json({ availability: null, coverImageUrl: null });
  }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
