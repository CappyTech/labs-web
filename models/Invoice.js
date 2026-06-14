'use strict';

const mongoose = require('mongoose');

// qty and totalP may be negative (adjustments/credits) — do not add min:0.
const lineItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty:     { type: Number, required: true },
    totalP:  { type: Number, required: true },
  },
  { _id: false }
);

const communalEventSchema = new mongoose.Schema(
  {
    product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Number of discrete units (e.g. pints) used communally.
    units:        { type: Number, required: true, min: 1 },
    // Members sharing this communal cost (may or may not include the buyer).
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
  },
  { _id: false }
);

const deliveryDaySchema = new mongoose.Schema(
  {
    date:           { type: Date, required: true },
    lineItems:      { type: [lineItemSchema], default: [] },
    communalEvents: { type: [communalEventSchema], default: [] },
  },
  { _id: false }
);

// Member-specific backdated credits or manual adjustments. amountP is negative for credits.
const adjustmentSchema = new mongoose.Schema(
  {
    member:      { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    amountP:     { type: Number, required: true },
    description: { type: String, trim: true },
    date:        { type: Date, required: true },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    // External invoice reference from the milkman (e.g. '39875277').
    number:        { type: String, required: true, trim: true },
    receiptDate:   { type: Date, required: true },
    transactionId: { type: String, trim: true },
    // Grand total as stated on the invoice — integer pence.
    totalP:        { type: Number, required: true, min: 0 },
    deliveryDays:  { type: [deliveryDaySchema], default: [] },
    adjustments:   { type: [adjustmentSchema], default: [] },
    status:        { type: String, enum: ['pending', 'computed', 'settled'], default: 'pending' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
