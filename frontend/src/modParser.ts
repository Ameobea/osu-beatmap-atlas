/**
 * Returns a mod string like "DTFL" or "HR" given a mods bitmask.
 *
 * Only the following mods are considered:
 *  - EZ
 *  - FL
 *  - DT (NC is considered as DT)
 *  - HR
 *  - HT
 *
 * The mods are returned in a fixed order (EZ, FL, DT, HR, HT)
 */
export const parseModsBitmask = (modsBitmask: number): string => {
  let mods = '';
  if (modsBitmask & 2) mods += 'EZ';
  if (modsBitmask & 1024) mods += 'FL';
  if (modsBitmask & 64) mods += 'DT';
  if (modsBitmask & 16) mods += 'HR';
  if (modsBitmask & 256) mods += 'HT';
  return mods;
};
