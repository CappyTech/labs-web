'use strict';

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const db = require('./services/db');

const app = express();

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
app.use('/milkman', require('./routes/milkman'));
app.use('/api/v1', require('./routes/api'));

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

db.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`labs-web listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
