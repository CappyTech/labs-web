'use strict';

/** @type {{ callsign: string, name: string, desc: string, url: string }[]} */
const MODULES = [
  { callsign: 'DOCS',  name: 'Paperless',  desc: 'Document archive and OCR pipeline.',    url: 'https://paperless.cappylabs.uk' },
  { callsign: 'OPS',   name: 'Portainer',  desc: 'Container management for the stack.',    url: 'https://portainer.cappylabs.uk' },
  { callsign: 'STAT',  name: 'Status',     desc: 'Uptime and health for everything here.', url: 'https://status.cappylabs.uk' },
  { callsign: 'NOTES', name: 'Notebook',   desc: 'Scratch notes and project logs.',        url: 'https://notes.cappylabs.uk' },
];

/**
 * Return all active modules.
 * @returns {typeof MODULES}
 */
function getModules() {
  return MODULES;
}

module.exports = { getModules };
