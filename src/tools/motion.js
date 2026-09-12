import { logSuccess, logInfo } from '../ui.js';

export const MOTION_PRESETS = {
  enter: {
    name: 'Entering Element (Decelerate into view)',
    rule: 'Always use ease-out so elements decelerate as they arrive.',
    css: 'transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out;',
    tailwind: 'transition-all duration-200 ease-out',
    framerMotion: '{ transition: { type: "spring", stiffness: 350, damping: 30 } }'
  },
  exit: {
    name: 'Exiting Element (Accelerate out of view)',
    rule: 'Always use ease-in so elements accelerate as they leave.',
    css: 'transition: transform 150ms cubic-bezier(0.7, 0, 0.84, 0), opacity 150ms ease-in;',
    tailwind: 'transition-all duration-150 ease-in',
    framerMotion: '{ transition: { duration: 0.15, ease: [0.7, 0, 0.84, 0] } }'
  },
  hover: {
    name: 'Button & Micro-Interaction Feedback',
    rule: 'Instant response, maximum 120ms to prevent perceptible lag.',
    css: 'transition: transform 100ms cubic-bezier(0.2, 0, 0, 1), background-color 100ms linear;',
    tailwind: 'transition-transform duration-100 ease-out active:scale-95',
    framerMotion: '{ whileHover: { scale: 1.02 }, whileTap: { scale: 0.96 } }'
  },
  modal: {
    name: 'Modal / Dialog Reveal',
    rule: 'Transform origin centered, slight scale-up from 0.96 to 1 with snappy spring.',
    css: 'transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out;',
    tailwind: 'transition-all duration-200 ease-out scale-100 opacity-100',
    framerMotion: '{ initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 } }'
  }
};

export function showMotionPresets(type = 'all') {
  console.log('\n======================================================');
  console.log('   SMILEU UI MOTION PHYSICS GENERATOR');
  console.log('   Inspired by emilkowalski/skills & animations.dev');
  console.log('======================================================\n');
  logInfo('Physical Laws for Delightful, Anti-Slop Interfaces\n');

  const targets = type === 'all' ? Object.keys(MOTION_PRESETS) : [type];

  targets.forEach(key => {
    const p = MOTION_PRESETS[key];
    if (!p) return;
    console.log(`🔷 Preset: ${p.name}`);
    console.log(`   Rule        : ${p.rule}`);
    console.log(`   CSS         : ${p.css}`);
    console.log(`   Tailwind    : ${p.tailwind}`);
    console.log(`   Framer Motion: ${p.framerMotion}\n`);
  });

  logSuccess('Use these presets to replace cartoonish bouncy animations with physics-based craft.');
}
