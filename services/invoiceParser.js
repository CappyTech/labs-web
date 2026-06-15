'use strict';

/**
 * invoiceParser — pure function, no I/O.
 *
 * Parses the tab-separated text you get when you copy-paste a milkman invoice
 * web page. Returns a structured object ready for review before creation.
 *
 * Expected format (tabs are the column separator):
 *
 *   Invoice #: 39875277
 *   Receipt date: 12/06/2026
 *   Paid
 *   Tuesday, 9 June 2026
 *   Item    Qty    Total
 *   3 Pints Whole Milk (Silver Top)    1    £2.90
 *   ...
 *   Weekly Delivery Fee    £0.00
 *   Total    £33.15
 *   Transaction ID: txn_xxx
 */

const MONTHS = {
  January:1, February:2, March:3, April:4, May:5, June:6,
  July:7, August:8, September:9, October:10, November:11, December:12,
};

const DAY_RE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d+)\s+(\w+)\s+(\d{4})/i;

/**
 * Parse a £ currency string to integer pence.
 * Handles: "£4.00", "-£4.00", "£0.00"
 */
function parsePence(str) {
  if (!str) return 0;
  const s = str.trim().replace(/,/g, '');
  const neg = s.includes('-');
  const abs = Math.round(parseFloat(s.replace(/[^0-9.]/g, '')) * 100);
  return neg ? -abs : abs;
}

/** Parse "DD/MM/YYYY" → Date */
function parseShortDate(str) {
  const [d, m, y] = str.trim().split('/');
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
}

/** Parse "Tuesday, 9 June 2026" → Date */
function parseVerboseDate(str) {
  const m = str.match(/(\d+)\s+(\w+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (!month) return null;
  return new Date(parseInt(m[3], 10), month - 1, parseInt(m[1], 10));
}

/** Strip leading "Adjustment " prefix for product name matching. */
function stripAdjPrefix(name) {
  return name.replace(/^Adjustment\s+/i, '').trim();
}

/**
 * @param {string} text   Raw copy-pasted invoice text.
 * @returns {{
 *   number:       string|null,
 *   receiptDate:  Date|null,
 *   transactionId:string|null,
 *   totalP:       number|null,
 *   deliveryDays: { date: Date, lineItems: { name: string, baseName: string, isAdjustment: boolean, qty: number, totalP: number }[] }[]
 * }}
 */
function parse(text) {
  const lines = text.split('\n').map(l => l.replace(/\r/g, '').trim()).filter(Boolean);

  const result = {
    number:        null,
    receiptDate:   null,
    transactionId: null,
    totalP:        null,
    deliveryDays:  [],
  };

  let currentDay = null;

  for (const line of lines) {
    if (line.startsWith('Invoice #:')) {
      result.number = line.slice('Invoice #:'.length).trim();
      continue;
    }
    if (line.startsWith('Receipt date:')) {
      result.receiptDate = parseShortDate(line.slice('Receipt date:'.length).trim());
      continue;
    }
    if (line.startsWith('Transaction ID:')) {
      result.transactionId = line.slice('Transaction ID:'.length).trim();
      continue;
    }
    // Skip status and column-header rows
    if (line === 'Paid' || /^Item\t/.test(line)) continue;

    // Delivery day header
    if (DAY_RE.test(line)) {
      currentDay = { date: parseVerboseDate(line), lineItems: [] };
      result.deliveryDays.push(currentDay);
      continue;
    }

    const parts = line.split('\t');

    // Grand total row: "Total\t£33.15"
    if (parts[0] === 'Total' && parts.length === 2) {
      result.totalP = parsePence(parts[1]);
      continue;
    }

    // Regular line item: "name\tqty\t£total"
    if (parts.length >= 3 && currentDay) {
      const name    = parts[0].trim();
      const qty     = parseFloat(parts[1]);
      const totalP  = parsePence(parts[parts.length - 1]);
      const isAdj   = /^Adjustment\s+/i.test(name);
      currentDay.lineItems.push({
        name,
        baseName:     stripAdjPrefix(name),
        isAdjustment: isAdj,
        qty,
        totalP,
      });
      continue;
    }

    // Fee row (no qty column): "Weekly Delivery Fee\t£0.00"
    if (parts.length === 2 && currentDay && /^-?£/.test(parts[1])) {
      const name   = parts[0].trim();
      const totalP = parsePence(parts[1]);
      if (totalP !== 0) {
        currentDay.lineItems.push({
          name,
          baseName:     name,
          isAdjustment: false,
          qty:          1,
          totalP,
        });
      }
    }
  }

  return result;
}

module.exports = { parse };
