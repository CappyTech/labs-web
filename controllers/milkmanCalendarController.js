'use strict';

const Invoice       = require('../models/Invoice');
const { formatMoney } = require('./dto');

/** Consistent local-date key regardless of UTC offset. */
function dk(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * GET /milkman/calendar
 *
 * State rules per calendar date D:
 *   settled      — every invoice touching D is settled
 *   computed     — at least one invoice touching D is computed (not settled)
 *   adjusted     — invoice is pending AND a later invoice has items on date D (adjustments captured)
 *   confirmable  — invoice is pending AND a newer invoice exists but hasn't touched D (safe to split)
 *   awaiting     — invoice is pending AND D belongs to the most recent invoice (too soon)
 */
async function calendar(req, res, next) {
  try {
    const allInvoices = await Invoice.find()
      .populate('deliveryDays.lineItems.product', 'name')
      .sort({ receiptDate: 1, _id: 1 })
      .lean();

    if (allInvoices.length === 0) {
      return res.render('milkman/calendar', {
        title:       'Delivery Calendar',
        description: 'No invoices yet.',
        months:      [],
        dayDetails:  [],
      });
    }

    const latestReceiptDate = allInvoices[allInvoices.length - 1].receiptDate;

    // ── Build dateMap: key → { date, entries[] } ──────────────────────────
    const dateMap = new Map();

    for (const invoice of allInvoices) {
      for (const day of invoice.deliveryDays) {
        const key = dk(day.date);
        if (!dateMap.has(key)) dateMap.set(key, { date: day.date, key, entries: [] });

        const hasPositive = day.lineItems.some(i => i.totalP > 0);
        const hasNegative = day.lineItems.some(i => i.totalP < 0);

        dateMap.get(key).entries.push({
          invoiceId:          String(invoice._id),
          invoiceNumber:      invoice.number,
          invoiceStatus:      invoice.status,
          invoiceReceiptDate: invoice.receiptDate,
          hasPositive,
          hasNegative,
          lineItems: day.lineItems.map(item => ({
            productName: item.product?.name || String(item.product),
            qty:         item.qty,
            totalP:      item.totalP,
            total:       formatMoney(Math.abs(item.totalP)),
            isCredit:    item.totalP < 0,
          })),
        });
      }
    }

    // ── Determine state per date ───────────────────────────────────────────
    const stateMap = new Map();

    for (const [key, { entries }] of dateMap) {
      const statuses = entries.map(e => e.invoiceStatus);
      const hasAdjustment = entries.some(e => e.hasNegative);

      let state;
      if (statuses.every(s => s === 'settled')) {
        state = 'settled';
      } else if (statuses.some(s => s === 'computed')) {
        state = 'computed';
      } else {
        // All pending — check position relative to latest invoice.
        const maxEntryDate = entries.reduce(
          (max, e) => e.invoiceReceiptDate > max ? e.invoiceReceiptDate : max,
          new Date(0)
        );
        const hasNewerInvoice = latestReceiptDate > maxEntryDate;

        if (hasAdjustment)        state = 'adjusted';
        else if (hasNewerInvoice) state = 'confirmable';
        else                      state = 'awaiting';
      }

      stateMap.set(key, state);
    }

    // ── Day details list (newest first) ────────────────────────────────────
    const STATE_LABEL = {
      settled:     'Settled',
      computed:    'Split computed',
      adjusted:    'Adjusted',
      confirmable: 'Ready to split',
      awaiting:    'Awaiting next invoice',
    };

    const dayDetails = [...dateMap.values()]
      .map(d => ({
        key:           d.key,
        date:          d.date,
        dateFormatted: d.date.toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        }),
        state:      stateMap.get(d.key),
        stateLabel: STATE_LABEL[stateMap.get(d.key)] || stateMap.get(d.key),
        entries:    d.entries.sort((a, b) => a.invoiceReceiptDate - b.invoiceReceiptDate),
      }))
      .sort((a, b) => b.date - a.date);

    // ── Build month grids ──────────────────────────────────────────────────
    const allDates = [...dateMap.values()].map(d => d.date);
    const minDate  = allDates.reduce((m, d) => d < m ? d : m, allDates[0]);
    const maxDate  = allDates.reduce((m, d) => d > m ? d : m, allDates[0]);

    const months = [];
    let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1);

    while (cur < end) {
      const year        = cur.getFullYear();
      const month       = cur.getMonth();
      const label       = cur.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0

      const weeks = [];
      let week = Array(firstDow).fill(null);

      for (let d = 1; d <= daysInMonth; d++) {
        const key = dk(new Date(year, month, d));
        week.push({ day: d, key, state: stateMap.get(key) || null });
        if (week.length === 7) { weeks.push(week); week = []; }
      }
      if (week.length) {
        while (week.length < 7) week.push(null);
        weeks.push(week);
      }

      months.push({ year, month, label, weeks });
      cur = new Date(year, month + 1, 1);
    }

    months.reverse(); // newest month first

    res.render('milkman/calendar', {
      title:       'Delivery Calendar',
      description: 'Deliveries, adjustments, and invoice status at a glance.',
      months,
      dayDetails,
    });
  } catch (err) { next(err); }
}

module.exports = { calendar };
