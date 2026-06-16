'use strict';

/**
 * One-time script: deduplicate products that share the same name + priceP.
 *
 * For each duplicate group:
 *   1. Keeps the oldest product (lowest ObjectId).
 *   2. Rewrites all Invoice line-item and communal-event references to the canonical ID.
 *   3. Rewrites all AllocationRule references to the canonical ID.
 *   4. Deletes the duplicate Product documents.
 *
 * Run with:  node scripts/dedup-products.js
 */

const db             = require('../services/db');
const Product        = require('../models/Product');
const Invoice        = require('../models/Invoice');
const AllocationRule = require('../models/AllocationRule');

async function run() {
  await db.connect();

  const products = await Product.find().lean();

  const groups = new Map();
  for (const p of products) {
    const key = `${p.name.toLowerCase().trim()}|${p.priceP}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const dupeGroups = [...groups.values()].filter(g => g.length > 1);

  if (dupeGroups.length === 0) {
    console.log('No duplicate products found — nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${dupeGroups.length} duplicate group(s). Deduplicating...\n`);

  for (const group of dupeGroups) {
    // Sort ascending by _id string — lowest ObjectId is oldest.
    group.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));
    const [canonical, ...dupes] = group;
    const dupeIds = dupes.map(p => p._id);

    console.log(`"${canonical.name}" £${(canonical.priceP / 100).toFixed(2)}`);
    console.log(`  keep    ${canonical._id}`);
    console.log(`  remove  ${dupeIds.join(', ')}`);

    // Rewrite invoice line items.
    const lineResult = await Invoice.updateMany(
      { 'deliveryDays.lineItems.product': { $in: dupeIds } },
      { $set: { 'deliveryDays.$[].lineItems.$[item].product': canonical._id } },
      { arrayFilters: [{ 'item.product': { $in: dupeIds } }] }
    );
    if (lineResult.modifiedCount) {
      console.log(`  patched ${lineResult.modifiedCount} invoice(s) — line items`);
    }

    // Rewrite invoice communal events.
    const communalResult = await Invoice.updateMany(
      { 'deliveryDays.communalEvents.product': { $in: dupeIds } },
      { $set: { 'deliveryDays.$[].communalEvents.$[evt].product': canonical._id } },
      { arrayFilters: [{ 'evt.product': { $in: dupeIds } }] }
    );
    if (communalResult.modifiedCount) {
      console.log(`  patched ${communalResult.modifiedCount} invoice(s) — communal events`);
    }

    // Rewrite allocation rules.
    const ruleResult = await AllocationRule.updateMany(
      { product: { $in: dupeIds } },
      { $set: { product: canonical._id } }
    );
    if (ruleResult.modifiedCount) {
      console.log(`  patched ${ruleResult.modifiedCount} allocation rule(s)`);
    }

    // Delete the duplicate products.
    await Product.deleteMany({ _id: { $in: dupeIds } });
    console.log(`  deleted ${dupeIds.length} duplicate(s)\n`);
  }

  console.log('Done.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
