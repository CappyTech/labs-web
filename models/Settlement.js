'use strict';

const mongoose = require('mongoose');

// Per-member owed amount for a settlement window. owedP is integer pence.
const balanceSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    owedP:  { type: Number, required: true },
  },
  { _id: false }
);

const settlementSchema = new mongoose.Schema(
  {
    cadence:     { type: String, required: true, enum: ['weekly', 'monthly', 'ad-hoc'] },
    windowStart: { type: Date, required: true },
    windowEnd:   { type: Date, required: true },
    invoiceIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }],
    balances:    { type: [balanceSchema], default: [] },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

module.exports = mongoose.model('Settlement', settlementSchema);
