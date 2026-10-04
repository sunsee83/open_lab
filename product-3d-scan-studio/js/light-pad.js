import { state } from "./state.js";

export function initLightPad() {
  const pad = document.querySelector("#lightPad");
  const handle = document.querySelector("#lightHandle");

  const move = (clientX, clientY) => {
    const rect = pad.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    state.light.x = x;
    state.light.y = y;
    handle.style.left = `${x}%`;
    handle.style.top = `${y}%`;
  };

  let dragging = false;

  pad.addEventListener("pointerdown", (event) => {
    dragging = true;
    pad.setPointerCapture(event.pointerId);
    move(event.clientX, event.clientY);
  });

  pad.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    move(event.clientX, event.clientY);
  });

  const stop = () => {
    dragging = false;
  };

  pad.addEventListener("pointerup", stop);
  pad.addEventListener("pointercancel", stop);
}
