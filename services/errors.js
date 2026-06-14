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

module.exports = {
  ReconciliationError,
  FractionsDoNotSumError,
  UnknownProductError,
  UnknownMemberError,
};
