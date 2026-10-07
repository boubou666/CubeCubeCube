// Two boards at each chapter transition; exhaustive replays are opt-in.
export const EXHAUSTIVE_LEVELS = process.env.TEST_ALL_LEVELS === '1';
export const CAMPAIGN_SAMPLE = Object.freeze(EXHAUSTIVE_LEVELS
  ? Array.from({ length: 48 }, (_, index) => index)
  : [0, 11, 12, 23, 24, 35, 36, 47]);
export const CUBE_SAMPLE = Object.freeze(EXHAUSTIVE_LEVELS
  ? Array.from({ length: 28 }, (_, index) => index)
  : [0, 6, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]);
export const COLONY_SAMPLE = Object.freeze(EXHAUSTIVE_LEVELS
  ? Array.from({ length: 96 }, (_, index) => index)
  : [0, 5, 6, 17, 23, 24, 47, 48, 71, 72, 80, 95]);
