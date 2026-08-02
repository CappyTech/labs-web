'use strict';

/** @type {{ callsign: string, name: string, desc: string, url: string }[]} */
const MODULES = [
  { callsign: 'RNDUP',  name: 'RoundUp',  desc: 'Document archive and OCR pipeline.',           url: 'https://cappylabs.uk/milkman' },
  { callsign: 'GROCY',  name: 'Grocy',    desc: 'Kitchen stock, shopping lists and meal plans.', url: 'https://food.cappylabs.uk' },
];

/**
 * Return all active modules.
 * @returns {typeof MODULES}
 */
function getModules() {
  return MODULES;
}

module.exports = { getModules };
