'use strict';

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const db = require('./services/db');

const app = express();
const { version } = require('./package.json');

// Trust the edge proxy (Caddy) so req.hostname/req.protocol reflect the
// original request — needed for host-aware routing (e.g. the Cairn domain).
app.set('trust proxy', true);

// Baseline security headers for every response. HSTS is left to the edge (Caddy).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

app.use((req, res, next) => { res.locals.appVersion = version; next(); });

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Layouts
app.use(expressLayouts);
app.set('layout', 'layout');

// Static files served under /resources/
app.use('/resources', express.static(path.join(__dirname, 'resources')));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Routes ────────────────────────────────────────────────────────────
app.use('/', require('./routes/index'));
app.use('/', require('./routes/legal'));
app.use('/milkman', require('./routes/milkman'));
app.use('/api/v1', require('./routes/api'));

// ── 404 ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 Not Found',
    description: 'Page not found.',
    status: 404,
    error: { name: 'NotFoundError', message: `No route matched ${req.method} ${req.url}`, stack: null },
  });
});

// ── Error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).render('error', {
    title: `Error ${status}`,
    description: err.message,
    status,
    error: err,
  });
});

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

db.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`labs-web listening on port ${PORT}`);
    });
    // Run after server is up — don't block startup.
    require('./services/ProductService').checkDuplicates().catch(console.error);
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
