'use strict';

const mongoose = require('mongoose');

// A Cairn beta sign-up. The Google Group is the real Play tester list; this
// record only exists to send the welcome email, enforce the cap and let the
// person leave. Kept deliberately small: no name, no IP, no device details.
const betaTesterSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    platform: { type: String, required: true, enum: ['android', 'ios'] },
    // invited: sent the join + opt-in links. waitlist: cap reached, or the
    // platform has no build yet (iOS until TestFlight opens).
    status:   { type: String, required: true, enum: ['invited', 'waitlist'] },
    // Secret for the one-click "leave the beta" link in every email.
    token:    { type: String, required: true, unique: true },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

module.exports = mongoose.model('BetaTester', betaTesterSchema);
