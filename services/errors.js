'use strict';

class ReconciliationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReconciliationError';
  }
}

class FractionsDoNotSumError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FractionsDoNotSumError';
  }
}

class UnknownProductError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnknownProductError';
  }
}

class UnknownMemberError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnknownMemberError';
  }
}

// Raised when a multi-member FIXED line's declared quantities don't sum to the
// line quantity (e.g. Jack 4 + Luke 2 on a line of 5 units).
class FixedQtyMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FixedQtyMismatchError';
  }
}

module.exports = {
  ReconciliationError,
  FractionsDoNotSumError,
  UnknownProductError,
  UnknownMemberError,
  FixedQtyMismatchError,
};
