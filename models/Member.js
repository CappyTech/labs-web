'use strict';

const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    // isBuyer: exactly one member is the account holder who pays the milkman.
    isBuyer: { type: Boolean, default: false },
    active:  { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

module.exports = mongoose.model('Member', memberSchema);
