/**
 * Semantic version parsing and bumping.
 *
 * Kept dependency-free and side-effect-free so both the release script and the
 * test suite can exercise every branch without touching the filesystem or git.
 */

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

export const RELEASE_TYPES = Object.freeze([
  'patch',
  'minor',
  'major',
  'prepatch',
  'preminor',
  'premajor',
  'prerelease'
]);

/**
 * Parses a semantic version string into its parts.
 * Throws on anything that is not a valid `major.minor.patch[-prerelease][+build]`.
 */
export function parseVersion(version) {
  if (typeof version !== 'string') {
    throw new TypeError(`Version must be a string, received ${typeof version}.`);
  }

  const match = SEMVER.exec(version.trim());
  if (!match) {
    throw new Error(`Invalid semantic version: "${version}".`);
  }

  const [, major, minor, patch, prerelease, build] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ? prerelease.split('.') : [],
    build: build || null
  };
}

/**
 * Formats parsed version parts back into a version string.
 */
export function formatVersion({ major, minor, patch, prerelease = [] }) {
  const core = `${major}.${minor}.${patch}`;
  return prerelease.length ? `${core}-${prerelease.join('.')}` : core;
}

/**
 * Bumps `current` by `type`, mirroring the semantics of `npm version`.
 *
 * - patch/minor/major on a prerelease drop the prerelease tag instead of
 *   incrementing twice (1.2.0-beta.1 + patch -> 1.2.0).
 * - prerelease increments the trailing numeric identifier, or starts at 0 when
 *   the current version is stable.
 * - `preid` names the prerelease channel (beta, rc, next). Default: "beta".
 */
export function bumpVersion(current, type, preid = 'beta') {
  const parsed = parseVersion(current);
  const isPrerelease = parsed.prerelease.length > 0;

  if (!RELEASE_TYPES.includes(type)) {
    // An explicit target version is a valid "type" too; validate and return it.
    return formatVersion(parseVersion(type.replace(/^v/, '')));
  }

  if (!/^[0-9A-Za-z-]+$/.test(preid)) {
    throw new Error(`Invalid prerelease identifier: "${preid}".`);
  }

  switch (type) {
    case 'major':
      return isPrerelease && parsed.minor === 0 && parsed.patch === 0
        ? formatVersion({ ...parsed, prerelease: [] })
        : `${parsed.major + 1}.0.0`;

    case 'minor':
      return isPrerelease && parsed.patch === 0
        ? formatVersion({ ...parsed, prerelease: [] })
        : `${parsed.major}.${parsed.minor + 1}.0`;

    case 'patch':
      return isPrerelease
        ? formatVersion({ ...parsed, prerelease: [] })
        : `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;

    case 'premajor':
      return `${parsed.major + 1}.0.0-${preid}.0`;

    case 'preminor':
      return `${parsed.major}.${parsed.minor + 1}.0-${preid}.0`;

    case 'prepatch':
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-${preid}.0`;

    case 'prerelease': {
      if (!isPrerelease) {
        return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-${preid}.0`;
      }

      const [channel, ...rest] = parsed.prerelease;
      if (channel !== preid) {
        return formatVersion({ ...parsed, prerelease: [preid, 0] });
      }

      const lastNumericIdx = rest.reduce(
        (acc, part, idx) => (/^\d+$/.test(part) ? idx : acc),
        -1
      );
      if (lastNumericIdx === -1) {
        return formatVersion({ ...parsed, prerelease: [...parsed.prerelease, 0] });
      }

      const next = [...rest];
      next[lastNumericIdx] = String(Number(next[lastNumericIdx]) + 1);
      return formatVersion({ ...parsed, prerelease: [channel, ...next] });
    }

    /* c8 ignore next 2 */
    default:
      throw new Error(`Unsupported release type: "${type}".`);
  }
}

/**
 * True when `version` carries a prerelease tag and should be published as a
 * GitHub pre-release rather than a stable one.
 */
export function isPrerelease(version) {
  return parseVersion(version).prerelease.length > 0;
}

/**
 * Compares two versions. Returns -1, 0 or 1 so results can feed Array#sort.
 * Prerelease versions sort below their stable counterpart, per the spec.
 */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);

  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }

  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;

  const len = Math.max(left.prerelease.length, right.prerelease.length);
  for (let i = 0; i < len; i += 1) {
    const l = left.prerelease[i];
    const r = right.prerelease[i];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l === r) continue;

    const lNum = /^\d+$/.test(l);
    const rNum = /^\d+$/.test(r);
    if (lNum && rNum) return Number(l) < Number(r) ? -1 : 1;
    if (lNum) return -1;
    if (rNum) return 1;
    return l < r ? -1 : 1;
  }

  return 0;
}
