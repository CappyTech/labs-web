'use strict';

/** @type {{ callsign: string, name: string, desc: string, url: string }[]} */
const MODULES = [
  { callsign: 'RNDUP',  name: 'RoundUp',  desc: 'Document archive and OCR pipeline.',           url: 'https://cappylabs.uk/milkman' },
  { callsign: 'GROCY',  name: 'Grocy',    desc: 'Kitchen stock, shopping lists and meal plans.', url: 'https://food.cappylabs.uk' },
  { callsign: 'CAIRN',  name: 'Cairn',    desc: 'Private, self-hosted, end-to-end encrypted location sharing.', url: 'https://cairn.cappylabs.uk' },
];

/**
 * Return all active modules.
 * @returns {typeof MODULES}
 */
function getModules() {
  return MODULES;
}

module.exports = { getModules };
