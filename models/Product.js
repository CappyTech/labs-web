'use strict';

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    // Price per individual unit — stored as integer pence (suffix …P).
    priceP:         { type: Number, required: true, min: 0 },
    // Pints per bottle for liquid products (e.g. 3 or 6 for milk). null otherwise.
    pintsPerBottle: { type: Number, default: null },
    category:       { type: String, trim: true, default: '' },
    active:         { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

module.exports = mongoose.model('Product', productSchema);
