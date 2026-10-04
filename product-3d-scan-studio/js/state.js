const initialState = {
  tab: "capture",
  view: "front",
  fov: 38,
  scale: 100,
  light: {
    x: 25,
    y: 25,
    power: 100,
    temperature: 5200
  },
  source: null
};

export const state = structuredClone(initialState);

export function resetState() {
  Object.assign(state, structuredClone(initialState));
}
