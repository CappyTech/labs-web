'use strict';

/** @type {{ callsign: string, name: string, desc: string, url: string }[]} */
const MODULES = [
  { callsign: 'RNDUP',  name: 'RoundUp',  desc: 'Document archive and OCR pipeline.',    url: 'https://cappylabs.uk/milkman' },
];

/**
 * Return all active modules.
 * @returns {typeof MODULES}
 */
function getModules() {
  return MODULES;
}

module.exports = { getModules };
