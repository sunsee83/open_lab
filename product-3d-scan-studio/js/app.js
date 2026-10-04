import { CameraController } from "./camera.js";
import { bindImageInput, showImage } from "./media.js";
import { initCameraControls, initLightControls, initTabs } from "./ui.js";
import { initLightPad } from "./light-pad.js";

const video = document.querySelector("#cameraView");
const image = document.querySelector("#imageView");
const empty = document.querySelector("#emptyState");
const openCameraButton = document.querySelector("#openCameraButton");
const captureButton = document.querySelector("#captureButton");
const scanButton = document.querySelector("#scanButton");
const camera = new CameraController(video);

initTabs();
initCameraControls();
initLightControls();
initLightPad();
bindImageInput();

openCameraButton.addEventListener("click", async () => {
  try {
    image.style.display = "none";
    empty.style.display = "none";
    await camera.open();
    captureButton.disabled = false;
    scanButton.disabled = false;
  } catch {
    document.querySelector("#imageInput").click();
  }
});

captureButton.addEventListener("click", () => {
  const frame = camera.capture();
  if (!frame) return;
  camera.close();
  showImage(frame);
});

scanButton.addEventListener("click", () => {
  // 다중 프레임 스캔 엔진 연결 지점.
});

window.addEventListener("pagehide", () => camera.close());
