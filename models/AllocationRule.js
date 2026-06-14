'use strict';

const mongoose = require('mongoose');

// One flat record per (product, member) pair.
// For FRACTION products there will be one row per member with their fraction.
// For WHOLE/FIXED there will be one row for the owning member.
const allocationRuleSchema = new mongoose.Schema(
  {
    product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    member:   { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    // WHOLE    — member takes 100 % of the line.
    // FRACTION — member takes `fraction` of the line; all rules for one product must sum to 1.
    // FIXED    — member takes the line outright (e.g. a bundle).
    type:     { type: String, required: true, enum: ['WHOLE', 'FRACTION', 'FIXED'] },
    // Required when type === 'FRACTION'. Must be 0 < fraction <= 1.
    fraction: { type: Number, default: null },
    // Required when type === 'FIXED'. Explicit quantity taken.
    fixedQty: { type: Number, default: null },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

// Enforce uniqueness per (product, member) pair.
allocationRuleSchema.index({ product: 1, member: 1 }, { unique: true });

module.exports = mongoose.model('AllocationRule', allocationRuleSchema);
