import { state } from "./state.js";

export function showImage(dataUrl) {
  const image = document.querySelector("#imageView");
  const video = document.querySelector("#cameraView");
  const empty = document.querySelector("#emptyState");
  const savePng = document.querySelector("#savePngButton");

  video.style.display = "none";
  image.src = dataUrl;
  image.style.display = "block";
  empty.style.display = "none";
  savePng.disabled = false;

  state.source = {
    type: "image",
    dataUrl
  };
}

export function bindImageInput() {
  const input = document.querySelector("#imageInput");

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => showImage(reader.result));
    reader.readAsDataURL(file);
  });
}
