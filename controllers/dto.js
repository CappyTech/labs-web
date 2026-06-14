'use strict';

/**
 * Shared DTO helpers for API controllers.
 *
 * - toDTO: maps a lean Mongoose doc to a safe response object (id not _id, no __v).
 * - formatMoney: formats integer pence as "£x.xx" — only call this at the response edge.
 * - err: sends a consistent error envelope { error: { code, message } }.
 */

function toDTO(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  obj.id = String(obj._id);
  delete obj._id;
  delete obj.__v;
  // Recursively clean nested objects that have _id (populated refs).
  for (const key of Object.keys(obj)) {
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key]._id) {
      obj[key] = toDTO(obj[key]);
    } else if (Array.isArray(obj[key])) {
      obj[key] = obj[key].map(item =>
        item && typeof item === 'object' && item._id ? toDTO(item) : item
      );
    }
  }
  return obj;
}

/** Format integer pence as "£x.xx". Only use at the response edge (controllers). */
function formatMoney(pence) {
  return '£' + (pence / 100).toFixed(2);
}

/** Send a consistent error response. */
function err(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

module.exports = { toDTO, formatMoney, err };
