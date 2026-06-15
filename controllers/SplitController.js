'use strict';

const InvoiceService = require('../services/InvoiceService');
const { toDTO, formatMoney, err } = require('./dto');
const { ReconciliationError, UnknownProductError, FractionsDoNotSumError, UnknownMemberError } = require('../services/errors');

/**
 * POST /invoices/:id/split
 *
 * Triggers the SplitEngine for an invoice and persists the Settlement.
 * Communal events must already be stored on the invoice's deliveryDays before calling.
 * Returns the per-member breakdown with money formatted at the edge.
 * Returns 201 on first computation, 200 on re-computation.
 */
async function split(req, res, next) {
  try {
    const { settlement, created } = await InvoiceService.computeSettlement(req.params.id);

    // Shape response: balances with formatted money, no raw _id/pence bleed.
    const dto = {
      id:          String(settlement._id),
      cadence:     settlement.cadence,
      windowStart: settlement.windowStart,
      windowEnd:   settlement.windowEnd,
      invoiceIds:  settlement.invoiceIds.map(String),
      balances:    settlement.balances.map(b => ({
        memberId: String(b.member._id || b.member),
        owed:     formatMoney(b.owedP),
        owedP:    b.owedP,
      })),
    };

    res.status(created ? 201 : 200).json(dto);
  } catch (e) {
    if (e instanceof ReconciliationError) {
      return err(res, 500, 'RECONCILIATION_ERROR', e.message);
    }
    if (e instanceof UnknownProductError) {
      return err(res, 400, 'UNKNOWN_PRODUCT', e.message);
    }
    if (e instanceof FractionsDoNotSumError) {
      return err(res, 400, 'FRACTIONS_ERROR', e.message);
    }
    if (e instanceof UnknownMemberError) {
      return err(res, 400, 'UNKNOWN_MEMBER', e.message);
    }
    next(e);
  }
}

module.exports = { split };
