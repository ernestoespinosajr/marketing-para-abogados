import * as migration_20260811_154933_initial from './20260811_154933_initial';

export const migrations = [
  {
    up: migration_20260811_154933_initial.up,
    down: migration_20260811_154933_initial.down,
    name: '20260811_154933_initial'
  },
];
