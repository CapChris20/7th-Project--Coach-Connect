/** Minimal server logger — routes to console for Cloud Run / local dev. */
const PREFIX = '[coach-connect]';

function formatArgs(args) {
  return args.map((a) => (a instanceof Error ? a.message : a));
}

module.exports = {
  debug: (...args) => console.log(PREFIX, ...formatArgs(args)),
  info: (...args) => console.log(PREFIX, ...formatArgs(args)),
  warn: (...args) => console.warn(PREFIX, ...formatArgs(args)),
  error: (...args) => console.error(PREFIX, ...formatArgs(args)),
};
