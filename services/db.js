'use strict';

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

async function connect() {
  await mongoose.connect(MONGO_URI);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

module.exports = { connect };
