'use strict';

const mongoose = require('mongoose');

// A composite/bundle product is made of one or more component products (e.g.
// "2 Pints Whole Milk & 6 Eggs" = 2× Whole Milk + 6× Eggs). At split time the
// line price is divided across components in proportion to their priceP, and
// allocation rules / communal events attach to the component products — never
// to the bundle. priceP is a reference weight, not required to equal the
// bundle's price (the actual line total is split proportionally).
const componentSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty:     { type: Number, required: true, min: 0, default: 1 },
    priceP:  { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    // Price per individual unit — stored as integer pence (suffix …P).
    priceP:         { type: Number, required: true, min: 0 },
    // Pints per bottle for liquid products (e.g. 3 or 6 for milk). null otherwise.
    pintsPerBottle: { type: Number, default: null },
    category:       { type: String, trim: true, default: '' },
    active:         { type: Boolean, default: true },
    // Non-empty → this product is a bundle expanded into these components at split time.
    components:     { type: [componentSchema], default: [] },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

module.exports = mongoose.model('Product', productSchema);
