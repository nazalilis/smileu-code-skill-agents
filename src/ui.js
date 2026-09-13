/**
 * Terminal output helpers.
 *
 * Colour follows the common conventions: NO_COLOR or --no-color turns it off,
 * FORCE_COLOR turns it on, and otherwise it is used only when stdout is a TTY.
 * Results go to stdout; warnings and errors about the tool itself go to stderr,
 * so piping a command's output never mixes in diagnostics.
 */

const env = process.env;
const stdoutIsTTY = Boolean(process.stdout.isTTY);

export const colorEnabled =
  !(env.NO_COLOR !== undefined && env.NO_COLOR !== '') &&
  !process.argv.includes('--no-color') &&
  (env.FORCE_COLOR !== undefined
    ? env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== 'false'
    : stdoutIsTTY && env.TERM !== 'dumb');

const identity = (s) => String(s);
const plain = {
  cyan: identity,
  green: identity,
  yellow: identity,
  magenta: identity,
  blue: identity,
  red: identity,
  bold: identity,
  dim: identity
};

let colors = plain;
try {
  const picocolors = (await import('picocolors')).default;
  colors = typeof picocolors.createColors === 'function' ? picocolors.createColors(colorEnabled) : picocolors;
} catch {
  // Dependencies are not installed; plain output works everywhere.
}

export const pc = colors;

/**
 * Prints the logo. Skipped when output is piped or running in CI, where seven
 * lines of box-drawing characters only get in the way.
 */
export function printBanner() {
  if (!stdoutIsTTY || env.CI) return;
  console.log('\n' + pc.cyan(pc.bold('  ███████╗███╗   ███╗██╗██╗     ███████╗██╗   ██╗')));
  console.log(pc.cyan(pc.bold('  ██╔════╝████╗ ████║██║██║     ██╔════╝██║   ██║')));
  console.log(pc.cyan(pc.bold('  ███████╗██╔████╔██║██║██║     █████╗  ██║   ██║')));
  console.log(pc.cyan(pc.bold('  ╚════██║██║╚██╔╝██║██║██║     ██╔══╝  ██║   ██║')));
  console.log(pc.cyan(pc.bold('  ███████║██║ ╚═╝ ██║██║███████╗███████╗╚██████╔╝')));
  console.log(pc.cyan(pc.bold('  ╚══════╝╚═╝     ╚═╝╚═╝╚══════╝╚══════╝ ╚═════╝ ')));
  console.log(pc.dim('  Code Skill: AI coding skills and agent personas for your editor\n'));
}

export function logSuccess(msg) {
  console.log(`${pc.green('✔')} ${msg}`);
}

export function logInfo(msg) {
  console.log(`${pc.blue('ℹ')} ${msg}`);
}

/**
 * A result that needs the reader's attention (a scan finding, a skipped item).
 * Printed to stdout because it is part of the command's output.
 */
export function logNotice(msg) {
  console.log(`${pc.yellow('!')} ${msg}`);
}

/** A problem with the tool or its environment. Printed to stderr. */
export function logWarn(msg) {
  console.error(`${pc.yellow('warning:')} ${msg}`);
}

/** A failure the user has to act on. Printed to stderr. */
export function logError(msg) {
  console.error(`${pc.red('error:')} ${msg}`);
}

export function logHeading(title) {
  console.log(`\n${pc.bold(title)}`);
}

/** Prints an aligned `label: value` row. */
export function logRow(label, value, width = 15) {
  console.log(`  ${`${label}:`.padEnd(width)} ${value}`);
}

/** `plural(1, 'skill')` -> "1 skill", `plural(3, 'skill')` -> "3 skills". */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
