export class CameraManager {
  async start(): Promise<HTMLVideoElement> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });

    const video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.srcObject = stream;
    await video.play();

    return video;
  }
}
