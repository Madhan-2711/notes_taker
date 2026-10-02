/**
 * On-device text recognition with Tesseract. The engine and English language data are
 * served by this app from /ocr (see scripts/copy-ocr-assets.mjs); the image never leaves
 * the device. The first run downloads about 7 MB, which the browser then caches.
 */
export interface OcrProgress {
  stage: "loading" | "reading";
  /** 0 to 1 */
  progress: number;
}

const MAX_SIDE = 2200;

/** Large photos are shrunk first: much faster, and phone photos are far larger than OCR needs. */
async function prepareImage(file: Blob): Promise<HTMLCanvasElement | Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas;
  } catch {
    return file;
  }
}

/** Joins lines Tesseract split mid-paragraph and trims stray whitespace. */
export function tidyRecognizedText(text: string): string {
  return text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split("\n").map((line) => line.trim()).filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export async function recognizeText(image: Blob, onProgress: (progress: OcrProgress) => void, signal?: AbortSignal): Promise<string> {
  const { createWorker, OEM } = await import("tesseract.js");
  onProgress({ stage: "loading", progress: 0 });
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr/lang",
    gzip: true,
    workerBlobURL: false,
    logger: (message: { status: string; progress: number }) => {
      if (message.status === "recognizing text") onProgress({ stage: "reading", progress: message.progress });
      else onProgress({ stage: "loading", progress: message.progress });
    },
  });
  const stop = () => void worker.terminate();
  signal?.addEventListener("abort", stop);
  try {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const { data } = await worker.recognize(await prepareImage(image));
    return tidyRecognizedText(data.text);
  } finally {
    signal?.removeEventListener("abort", stop);
    await worker.terminate().catch(() => undefined);
  }
}
