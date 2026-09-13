import { logError, logHeading, logInfo, logRow } from '../ui.js';

export const MOTION_PRESETS = {
  enter: {
    name: 'Entering element (decelerate into view)',
    rule: 'Use ease-out so elements decelerate as they arrive.',
    css: 'transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out;',
    tailwind: 'transition-all duration-200 ease-out',
    framerMotion: '{ transition: { type: "spring", stiffness: 350, damping: 30 } }'
  },
  exit: {
    name: 'Exiting element (accelerate out of view)',
    rule: 'Use ease-in so elements accelerate as they leave.',
    css: 'transition: transform 150ms cubic-bezier(0.7, 0, 0.84, 0), opacity 150ms ease-in;',
    tailwind: 'transition-all duration-150 ease-in',
    framerMotion: '{ transition: { duration: 0.15, ease: [0.7, 0, 0.84, 0] } }'
  },
  hover: {
    name: 'Button hover and press feedback',
    rule: 'Respond within 120ms so the interface never feels laggy.',
    css: 'transition: transform 100ms cubic-bezier(0.2, 0, 0, 1), background-color 100ms linear;',
    tailwind: 'transition-transform duration-100 ease-out active:scale-95',
    framerMotion: '{ whileHover: { scale: 1.02 }, whileTap: { scale: 0.96 } }'
  },
  modal: {
    name: 'Modal or dialog reveal',
    rule: 'Scale up from 0.96 to 1 around the centre with a short, firm spring.',
    css: 'transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out;',
    tailwind: 'transition-all duration-200 ease-out scale-100 opacity-100',
    framerMotion: '{ initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 } }'
  }
};

/**
 * Prints one motion preset, or all of them. Returns false for an unknown
 * preset name so the CLI can exit with a usage error.
 */
export function showMotionPresets(type = 'all') {
  const key = String(type).toLowerCase();
  const names = Object.keys(MOTION_PRESETS);

  if (key !== 'all' && !MOTION_PRESETS[key]) {
    logError(`Unknown preset "${type}". Use one of: ${names.join(', ')}, or leave it out to print all.`);
    return false;
  }

  logHeading('Motion presets');
  logInfo('Enter with ease-out, exit with ease-in, and keep feedback under 120ms (after emilkowalski/skills).');

  for (const name of key === 'all' ? names : [key]) {
    const preset = MOTION_PRESETS[name];
    console.log(`\n${preset.name} [${name}]`);
    logRow('Rule', preset.rule);
    logRow('CSS', preset.css);
    logRow('Tailwind', preset.tailwind);
    logRow('Framer Motion', preset.framerMotion);
  }

  console.log('\nCopy the CSS, Tailwind or Framer Motion line into your component.');
  return true;
}
