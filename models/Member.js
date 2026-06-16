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

// Enforce single account holder at the model level.
memberSchema.pre('save', async function () {
  if (this.isModified('isBuyer') && this.isBuyer) {
    await this.constructor.updateMany({ _id: { $ne: this._id } }, { isBuyer: false });
  }
});

memberSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  const incoming = update?.isBuyer ?? update?.$set?.isBuyer;
  if (incoming === true) {
    const doc = await this.model.findOne(this.getQuery(), '_id').lean();
    await this.model.updateMany({ _id: { $ne: doc?._id } }, { isBuyer: false });
  }
});

module.exports = mongoose.model('Member', memberSchema);
