const express = require('express');
const path = require('path');
const { search: searchBPL, getAvailability: getBPLAvailability } = require('./adapters/bpl');
const { search: searchAthenaeum, getAvailability: getAthenaeumAvailability } = require('./adapters/athenaeum');

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

app.get('/api/availability', async (req, res) => {
  const { library, id } = req.query;
  if (!library || !id) {
    return res.status(400).json({ error: 'Requires library and id' });
  }

  try {
    let status = null;
    if (library === 'bpl') {
      status = await withTimeout(getBPLAvailability(id), 6000);
    } else if (library === 'athenaeum') {
      status = await withTimeout(getAthenaeumAvailability(id), 6000);
    }
    return res.json({ status });
  } catch (e) {
    return res.json({ status: null });
  }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
