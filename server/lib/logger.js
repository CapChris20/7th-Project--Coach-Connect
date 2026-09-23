/** Minimal server logger — screenNames to console for Cloud Run / local dev. */
const PREFIX = '[coach-connect]';

function cellFormattingArgs(args) {
  return args.map((a) => (a instanceof Error ? a.message : a));
}

module.exports = {
  debug: (...args) => console.log(PREFIX, ...cellFormattingArgs(args)),
  info: (...args) => console.log(PREFIX, ...cellFormattingArgs(args)),
  warn: (...args) => console.warn(PREFIX, ...cellFormattingArgs(args)),
  error: (...args) => console.error(PREFIX, ...cellFormattingArgs(args)),
};
