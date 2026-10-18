/**
 * VIBE Registry: Directory of official AI harnesses, personas, skills, and CLI tools.
 * All repositories are configured to fetch the latest commits and releases in real time.
 */
export const VIBE_REGISTRY = {
  harnesses: [
    {
      name: "ruvnet/ruflo",
      repo: "ruvnet/ruflo",
      url: "https://github.com/ruvnet/ruflo",
      description: "Enterprise Multi-Agent Orchestration Platform & Swarm Framework",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
    {
      name: "NousResearch/hermes-agent",
      repo: "NousResearch/hermes-agent",
      url: "https://github.com/NousResearch/hermes-agent",
      description: "Autonomous AI agent framework powered by Nous Hermes models",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
  ],
  personas: [
    {
      name: "msitarzewski/agency-agents",
      repo: "msitarzewski/agency-agents",
      url: "https://github.com/msitarzewski/agency-agents",
      description: "Comprehensive agency AI personas and multidisciplinary specialists",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
  ],
  skills: [
    {
      name: "MengTo/skills",
      repo: "MengTo/skills",
      url: "https://github.com/MengTo/skills",
      description: "UI/UX design systems and modern web development skills",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
    {
      name: "mattpocock/skills",
      repo: "mattpocock/skills",
      url: "https://github.com/mattpocock/skills",
      description: "Advanced TypeScript patterns, testing, and craftsmanship skills",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
    {
      name: "mukul975/anthropic-cybersecurity-skills",
      repo: "mukul975/anthropic-cybersecurity-skills",
      url: "https://github.com/mukul975/anthropic-cybersecurity-skills",
      description: "Anthropic cybersecurity audit, penetration testing, and analysis skills",
      lazyLoadCatalog: true,
      lazyLoadIndexOnly: true,
    },
    {
      name: "blader/humanizer",
      repo: "blader/humanizer",
      url: "https://github.com/blader/humanizer",
      description: "Natural writing, anti-AI tone heuristics, and human copywriting guidelines",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
    {
      name: "Leonxlnx/taste-skill",
      repo: "Leonxlnx/taste-skill",
      url: "https://github.com/Leonxlnx/taste-skill",
      description: "Design taste refinement and aesthetic curation for AI models",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
    {
      name: "pbakaus/impeccable",
      repo: "pbakaus/impeccable",
      url: "https://github.com/pbakaus/impeccable",
      description: "Frontend design craftsmanship, design tokens, and anti-slop rules",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
    {
      name: "emilkowalski/skills",
      repo: "emilkowalski/skills",
      url: "https://github.com/emilkowalski/skills",
      description: "Micro-interactions, animation craft, GSAP timelines, and UI polish",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
  ],
  cliTools: [
    {
      name: "Graphify-Labs/graphify",
      repo: "Graphify-Labs/graphify",
      url: "https://github.com/Graphify-Labs/graphify",
      description: "Codebase architecture knowledge graph builder and visualizer",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
    {
      name: "projectdiscovery/nuclei",
      repo: "projectdiscovery/nuclei",
      url: "https://github.com/projectdiscovery/nuclei",
      description: "Fast, customizable vulnerability scanner for security workflows",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
    {
      name: "usestrix/strix",
      repo: "usestrix/strix",
      url: "https://github.com/usestrix/strix",
      description: "Autonomous AI vulnerability assessment and defensive web security testing",
      lazyLoadCatalog: false,
      lazyLoadIndexOnly: false,
    },
  ],
};

/**
 * Returns a flat array of all 13 registered repositories with category metadata.
 *
 * @returns {Array<object>}
 */
export function getAllRepositories() {
  return Object.entries(VIBE_REGISTRY).flatMap(([category, items]) =>
    items.map((item) => ({ ...item, category }))
  );
}

/**
 * Find repository entry by slug or URL.
 *
 * @param {string} identifier Repo slug (e.g. 'MengTo/skills') or full GitHub URL
 * @returns {object | null}
 */
export function getRepository(identifier) {
  const normalized = identifier
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/^(gh:|github:)/, '');

  return (
    getAllRepositories().find(
      (item) => item.repo === normalized || item.url === identifier
    ) || null
  );
}

export default VIBE_REGISTRY;
