/**
 * smile.ts — hands-free smile detection via MediaPipe FaceLandmarker blendshapes.
 * Loaded from CDN with a dynamic import ONLY when the user picks smile mode, so
 * none of this ships in the initial bundle. Falls back gracefully on failure.
 */

const VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export interface SmileDetector {
  /** 0..1 smile strength for the current video frame */
  score: (video: HTMLVideoElement, tsMs: number) => number;
  close: () => void;
}

export async function loadSmileDetector(): Promise<SmileDetector> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vision: any = await import(/* webpackIgnore: true */ VISION_URL);
  const { FilesetResolver, FaceLandmarker } = vision;
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  });

  return {
    score(video, tsMs) {
      if (video.readyState < 2) return 0;
      const res = landmarker.detectForVideo(video, tsMs);
      const shapes = res?.faceBlendshapes?.[0]?.categories;
      if (!shapes) return 0;
      let left = 0;
      let right = 0;
      for (const c of shapes) {
        if (c.categoryName === 'mouthSmileLeft') left = c.score;
        if (c.categoryName === 'mouthSmileRight') right = c.score;
      }
      return Math.min(1, (left + right) / 1.4);
    },
    close() {
      try { landmarker.close(); } catch {}
    },
  };
}
