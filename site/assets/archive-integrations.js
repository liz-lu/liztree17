// A enables each integration only after its handoff and browser checks.
// Paths are relative to this module; null keeps the readable static fallback.
export const integrations = {
  tree: './archive-tree-adapter.js?v=archive-20261109-playback-1',
  location: '../modules/location-v4/index.js?v=archive-20261109-playback-1',
  visuals: './style-v4/manifest.json'
};
