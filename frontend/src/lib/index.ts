// place files you want to import through the `$lib` alias in this folder.

import type { ScoreMetadata } from '../corpus';

export enum ColorMode {
  AveragePP,
  ReleaseYear,
  AimSpeedRatio,
}

interface ColorModeConfig {
  explicitMinVal?: number;
  explicitMaxVal?: number;
  getValue: (d: ScoreMetadata) => number;
  title: string;
}

export const ColorModeConfigs: { [K in ColorMode]: ColorModeConfig } = {
  [ColorMode.AveragePP]: {
    explicitMinVal: 100,
    explicitMaxVal: 615,
    getValue: (d) => d.averagePp,
    title: 'Average PP',
  },
  [ColorMode.ReleaseYear]: { getValue: (d) => d.releaseYear, title: 'Year Ranked' },
  [ColorMode.AimSpeedRatio]: {
    explicitMinVal: 0.85,
    explicitMaxVal: 1.6,
    getValue: (d) => d.aimDifficulty / d.speedDifficulty,
    title: 'Aim/Speed Ratio',
  },
};
