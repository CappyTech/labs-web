'use strict';

const InvoiceService = require('../services/InvoiceService');
const { toDTO, formatMoney, err } = require('./dto');
const { ReconciliationError, UnknownProductError } = require('../services/errors');

/**
 * POST /invoices/:id/split
 *
 * Triggers the SplitEngine for an invoice and persists the Settlement.
 * Communal events must already be stored on the invoice's deliveryDays before calling.
 * Returns the per-member breakdown with money formatted at the edge.
 */
async function split(req, res, next) {
  try {
    const settlement = await InvoiceService.computeSettlement(req.params.id);

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

    res.status(201).json(dto);
  } catch (e) {
    if (e instanceof ReconciliationError) {
      // Reconciliation failures are invariant violations — surface loudly as 500.
      return err(res, 500, 'RECONCILIATION_ERROR', e.message);
    }
    if (e instanceof UnknownProductError) {
      return err(res, 400, 'UNKNOWN_PRODUCT', e.message);
    }
    next(e);
  }
}

module.exports = { split };
