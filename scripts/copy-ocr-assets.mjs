// Copies the on-device text recognition engine (Tesseract) into public/ocr so the
// app serves it itself instead of loading it from a third-party CDN. Runs before
// `npm run dev` and `npm run build`; the copied files are git-ignored.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = dirname(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const out = join(root, "public", "ocr");
const langOut = join(out, "lang");
mkdirSync(langOut, { recursive: true });

function copyIfChanged(from, to) {
  if (existsSync(to) && statSync(to).size === statSync(from).size) return false;
  copyFileSync(from, to);
  return true;
}

const workerDir = dirname(require.resolve("tesseract.js/dist/worker.min.js"));
const coreDir = dirname(require.resolve("tesseract.js-core/package.json"));
const langDir = join(dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");

let copied = 0;
copied += copyIfChanged(join(workerDir, "worker.min.js"), join(out, "worker.min.js")) ? 1 : 0;
// Only the LSTM builds are needed (the app uses the LSTM engine); the browser loads one of them.
for (const file of readdirSync(coreDir).filter((name) => /^tesseract-core.*lstm\.wasm\.js$/.test(name))) {
  copied += copyIfChanged(join(coreDir, file), join(out, file)) ? 1 : 0;
}
copied += copyIfChanged(join(langDir, "eng.traineddata.gz"), join(langOut, "eng.traineddata.gz")) ? 1 : 0;

if (copied) console.log(`Copied ${copied} text recognition file(s) to public/ocr.`);
