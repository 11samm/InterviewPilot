// MediaPipe 0.10.33 publishes its types after its JS export conditions.
// Expose the package's own declarations without replacing its runtime module.
declare module "@mediapipe/tasks-vision" {
  export const FaceLandmarker: typeof import("../node_modules/@mediapipe/tasks-vision/vision").FaceLandmarker
  export type FaceLandmarker = import("../node_modules/@mediapipe/tasks-vision/vision").FaceLandmarker
  export const FilesetResolver: typeof import("../node_modules/@mediapipe/tasks-vision/vision").FilesetResolver
  export type FaceLandmarkerResult = import("../node_modules/@mediapipe/tasks-vision/vision").FaceLandmarkerResult
  export type NormalizedLandmark = import("../node_modules/@mediapipe/tasks-vision/vision").NormalizedLandmark
}
