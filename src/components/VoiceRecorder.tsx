"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Save, Trash2, Loader2, TextCursorInput, Download } from "lucide-react";
import { MAX_INLINE_PLAINTEXT } from "../lib/attachmentCrypto";

const MAX_SECONDS = 180;
const BITRATE = 24_000;

interface LocalRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface RecognitionConstructor {
  new (): LocalRecognition;
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (options: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
}

type LocalSpeech = "checking" | "available" | "downloadable" | "unavailable";

function recognitionConstructor(): RecognitionConstructor | undefined {
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

/**
 * Only on-device recognition is ever used. Browsers that would send audio to a
 * cloud service report "unavailable" here, and transcription stays hidden.
 */
async function checkLocalSpeech(lang: string): Promise<LocalSpeech> {
  const Recognition = recognitionConstructor();
  if (!Recognition?.available) return "unavailable";
  try {
    const status = await Recognition.available({ langs: [lang], processLocally: true });
    if (status === "available") return "available";
    if (status === "downloadable" || status === "downloading") return "downloadable";
  } catch {
    // Treated as unsupported.
  }
  return "unavailable";
}

function pickMimeType(): string {
  for (const type of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function extensionFor(mime: string): string {
  if (mime.startsWith("audio/ogg")) return "ogg";
  if (mime.startsWith("audio/mp4")) return "m4a";
  return "webm";
}

function formatSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function VoiceRecorder({ disabled = false, onSave, onInsertText }: {
  disabled?: boolean;
  onSave: (file: File) => Promise<void> | void;
  onInsertText?: (text: string) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "recorded">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState<{ blob: Blob; url: string; mime: string } | null>(null);
  const [transcript, setTranscript] = useState("");
  const [localSpeech, setLocalSpeech] = useState<LocalSpeech>("checking");
  const [transcribe, setTranscribe] = useState(false);
  const [saving, setSaving] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<LocalRecognition | null>(null);
  const timerRef = useRef<number | null>(null);
  const lang = typeof navigator === "undefined" ? "en-US" : navigator.language || "en-US";

  useEffect(() => {
    if (!onInsertText) return;
    let active = true;
    void checkLocalSpeech(lang).then((status) => { if (active) setLocalSpeech(status); });
    return () => { active = false; };
  }, [lang, onInsertText]);

  const cleanup = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;
  };

  useEffect(() => () => {
    cleanup();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  useEffect(() => () => { if (recording) URL.revokeObjectURL(recording.url); }, [recording]);

  const stop = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    cleanup();
  };

  const startTranscription = () => {
    const Recognition = recognitionConstructor();
    if (!Recognition || localSpeech !== "available" || !transcribe) return;
    const recognition = new Recognition();
    if (!("processLocally" in recognition)) return;
    recognition.processLocally = true;
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) finalText += event.results[index][0].transcript;
      }
      if (finalText) setTranscript((current) => `${current} ${finalText}`.trim());
    };
    recognition.onerror = () => setError("On-device transcription stopped. Your recording continues.");
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setError("On-device transcription could not start. Your recording continues.");
    }
  };

  const start = async () => {
    setError("");
    setTranscript("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot record audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mime = pickMimeType();
      const recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: BITRATE });
      const chunks: Blob[] = [];
      let bytes = 0;
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        chunks.push(event.data);
        bytes += event.data.size;
        if (bytes > MAX_INLINE_PLAINTEXT * 0.92) stop();
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks, { type });
        setRecording({ blob, url: URL.createObjectURL(blob), mime: type });
        setState("recorded");
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      setSeconds(0);
      setState("recording");
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS) stop();
      }, 1000);
      startTranscription();
    } catch {
      cleanup();
      setError("Microphone access was blocked. Allow the microphone for this site and try again.");
    }
  };

  const discard = () => {
    setRecording(null);
    setTranscript("");
    setState("idle");
  };

  const save = async () => {
    if (!recording) return;
    setSaving(true);
    try {
      const stamp = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }).replace(/[/:]/g, "-");
      await onSave(new File([recording.blob], `Voice note ${stamp}.${extensionFor(recording.mime)}`, { type: recording.mime }));
      discard();
    } finally {
      setSaving(false);
    }
  };

  const installModel = async () => {
    const Recognition = recognitionConstructor();
    if (!Recognition?.install) return;
    setLocalSpeech("checking");
    const installed = await Recognition.install({ langs: [lang], processLocally: true }).catch(() => false);
    setLocalSpeech(installed ? "available" : "unavailable");
  };

  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50";

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-left">
      <div className="flex flex-wrap items-center gap-2">
        {state === "recording" ? (
          <>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-700" role="status">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden /> Recording {formatSeconds(seconds)} / {formatSeconds(MAX_SECONDS)}
            </span>
            <button type="button" onClick={stop} className={`${button} border-red-300 bg-red-50 text-red-800 hover:bg-red-100`}><Square size={15} /> Stop</button>
          </>
        ) : state === "recorded" && recording ? (
          <>
            <audio controls src={recording.url} className="h-11 max-w-full" aria-label="Recorded voice note" />
            <button type="button" disabled={saving || disabled} onClick={() => void save()} className={`${button} border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100`}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save voice note
            </button>
            <button type="button" disabled={saving} onClick={discard} className={`${button} border-slate-300 text-slate-700 hover:bg-slate-50`}><Trash2 size={15} /> Discard</button>
          </>
        ) : (
          <button type="button" disabled={disabled} onClick={() => void start()} className={`${button} border-indigo-300 bg-white text-indigo-800 hover:bg-indigo-50`}><Mic size={16} /> Record voice note</button>
        )}

        {onInsertText && state === "idle" && localSpeech === "available" && (
          <label className="ml-auto inline-flex min-h-11 items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={transcribe} onChange={(event) => setTranscribe(event.target.checked)} className="h-4 w-4 accent-indigo-600" />
            Transcribe on this device
          </label>
        )}
        {onInsertText && state === "idle" && localSpeech === "downloadable" && (
          <button type="button" onClick={() => void installModel()} className={`${button} ml-auto border-slate-300 text-slate-700 hover:bg-slate-50`}>
            <Download size={15} /> Enable on-device transcription
          </button>
        )}
      </div>

      {transcript && state !== "idle" && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Transcript (made on this device)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{transcript}</p>
          {state === "recorded" && onInsertText && (
            <button type="button" onClick={() => { onInsertText(transcript); setTranscript(""); }} className={`${button} mt-2 border-indigo-300 text-indigo-800 hover:bg-indigo-50`}>
              <TextCursorInput size={15} /> Insert into note
            </button>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Up to {MAX_SECONDS / 60} minutes. {onInsertText && localSpeech === "unavailable" ? "Transcription is off: this browser can't transcribe without sending audio to an online service." : ""}
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
