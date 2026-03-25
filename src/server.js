const express = require('express');
const path = require('path');
const { search: searchBPL } = require('./adapters/bpl');
const { search: searchAthenaeum } = require('./adapters/athenaeum');

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

  const [bplResult, athResult] = await Promise.allSettled([
    withTimeout(searchBPL(query), 8000),
    withTimeout(searchAthenaeum(query), 8000),
  ]);

  const results = [
    ...(bplResult.status === 'fulfilled' ? bplResult.value : []),
    ...(athResult.status === 'fulfilled' ? athResult.value : []),
  ];

  res.json({
    results,
    errors: {
      bpl: bplResult.status === 'rejected' ? bplResult.reason.message : null,
      athenaeum: athResult.status === 'rejected' ? athResult.reason.message : null,
    },
  });
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
