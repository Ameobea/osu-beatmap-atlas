/**
 * Returns a mod string like "DTFL" or "HR" given a mods bitmask.
 *
 * Only the following mods are considered:
 *  - EZ
 *  - FL
 *  - DT (NC is considered as DT)
 *  - HR
 *
 * The mods are returned in alphabetical order (EZ, FL, DT, HR)
 */
export const parseModsBitmask = (modsBitmask: number): string => {
  let mods = '';
  if (modsBitmask & 2) mods += 'EZ';
  if (modsBitmask & 1024) mods += 'FL';
  if (modsBitmask & 64) mods += 'DT';
  if (modsBitmask & 16) mods += 'HR';
  return mods;
};
