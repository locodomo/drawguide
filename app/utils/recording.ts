import GIF from 'gif.js.optimized';

export interface RecordingFrame {
  dataUrl: string;
  delay: number;
}

export class CanvasRecorder {
  private frames: RecordingFrame[] = [];
  private isRecording: boolean = false;
  private startTime: number = 0;
  private lastFrameTime: number = 0;
  private minFrameDelay: number = 33; // Minimum 33ms between frames (approximately 30fps)
  private width: number = 460;
  private height: number = 460;

  startRecording() {
    this.frames = [];
    this.isRecording = true;
    this.startTime = Date.now();
    this.lastFrameTime = this.startTime;
  }

  stopRecording() {
    this.isRecording = false;
  }

  addFrame(dataUrl: string) {
    if (!this.isRecording) return;

    const currentTime = Date.now();
    const timeSinceLastFrame = currentTime - this.lastFrameTime;

    // Only capture frame if enough time has passed
    if (timeSinceLastFrame >= this.minFrameDelay) {
      this.frames.push({
        dataUrl,
        delay: timeSinceLastFrame
      });
      this.lastFrameTime = currentTime;
    }
  }

  private createWhiteBackgroundCanvas(imageData: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d')!;

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image on top
    ctx.drawImage(imageData, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  async generateGif(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const gif = new GIF({
        workers: 4,
        quality: 1,
        width: this.width,
        height: this.height,
        workerScript: '/gif.worker.js',
        background: '#ffffff',
        transparent: null,
        repeat: 0,
        dither: false,
        debug: false
      });

      // Process each frame with white background
      const framePromises = this.frames.map(frame => {
        return new Promise<void>((resolveFrame) => {
          const img = new Image();
          img.onload = () => {
            const canvas = this.createWhiteBackgroundCanvas(img);
            gif.addFrame(canvas, { delay: frame.delay, copy: true });
            resolveFrame();
          };
          img.src = frame.dataUrl;
        });
      });

      // Once all frames are processed, render the GIF
      Promise.all(framePromises).then(() => {
        gif.on('finished', (blob: Blob) => {
          resolve(blob);
        });

        gif.on('error', (error: Error) => {
          reject(error);
        });

        gif.render();
      });
    });
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  getFrameCount(): number {
    return this.frames.length;
  }
} 