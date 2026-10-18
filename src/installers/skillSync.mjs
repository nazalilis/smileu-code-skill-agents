import {
  syncSkills,
  syncPersonas,
  syncAllSkillsAndPersonas,
  installSkills,
  installPersonas,
} from './skillAndPersonaSync.mjs';

export {
  syncSkills,
  syncPersonas,
  syncAllSkillsAndPersonas as syncAll,
  installSkills,
  installPersonas,
};

export default {
  syncSkills,
  syncPersonas,
  syncAll: syncAllSkillsAndPersonas,
  installSkills,
  installPersonas,
};
