import { state } from "./state.js";

const labels = {
  capture: "촬영",
  camera: "구도",
  light: "조명",
  export: "저장"
};

export function initTabs() {
  const tabs = [...document.querySelectorAll("[data-tab]")];
  const panels = [...document.querySelectorAll("[data-panel]")];
  const modeLabel = document.querySelector("#modeLabel");

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const next = tab.dataset.tab;
      state.tab = next;

      tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === next));
      modeLabel.textContent = labels[next];
    });
  }
}

export function initCameraControls() {
  const fov = document.querySelector("#fovInput");
  const fovOutput = document.querySelector("#fovOutput");
  const scale = document.querySelector("#scaleInput");
  const scaleOutput = document.querySelector("#scaleOutput");
  const viewButtons = [...document.querySelectorAll("[data-view]")];

  fov.addEventListener("input", () => {
    state.fov = Number(fov.value);
    fovOutput.value = `${state.fov}°`;
  });

  scale.addEventListener("input", () => {
    state.scale = Number(scale.value);
    scaleOutput.value = `${state.scale}%`;
  });

  for (const button of viewButtons) {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      viewButtons.forEach((item) => item.classList.toggle("is-selected", item === button));
    });
  }
}

export function initLightControls() {
  const power = document.querySelector("#lightPowerInput");
  const powerOutput = document.querySelector("#lightPowerOutput");
  const temperature = document.querySelector("#lightTempInput");
  const temperatureOutput = document.querySelector("#lightTempOutput");

  power.addEventListener("input", () => {
    state.light.power = Number(power.value);
    powerOutput.value = `${state.light.power}%`;
  });

  temperature.addEventListener("input", () => {
    state.light.temperature = Number(temperature.value);
    temperatureOutput.value = `${state.light.temperature}K`;
  });
}
