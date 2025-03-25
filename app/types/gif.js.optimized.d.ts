declare module 'gif.js.optimized' {
  export interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    background?: string;
    repeat?: number;
    transparent?: string | null;
    dither?: boolean;
    debug?: boolean;
  }

  export default class GIF {
    constructor(options: GIFOptions);
    addFrame(imageData: ImageData | HTMLCanvasElement | HTMLImageElement, options?: { delay?: number; copy?: boolean; dispose?: number }): void;
    render(): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    on(event: string, callback: Function): void;
  }
} 