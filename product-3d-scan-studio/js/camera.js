export class CameraController {
  constructor(video) {
    this.video = video;
    this.stream = null;
  }

  async open() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("camera-unavailable");
    }

    this.close();

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    this.video.srcObject = this.stream;
    this.video.style.display = "block";
    await this.video.play();
  }

  capture() {
    if (!this.video.videoWidth) return null;

    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    canvas.getContext("2d").drawImage(this.video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  close() {
    if (!this.stream) return;
    this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
