import { MessageCircle, Mic, Send, Volume2, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ChatMarkdown } from "./ChatMarkdown";
import type { Lang } from "./i18n";
import { t } from "./i18n";

export type ResourceChatHandle = { open: () => void };

type Msg = { role: "user" | "assistant"; content: string };

function bcp47ForLang(lang: Lang): string {
  if (lang === "es") return "es-ES";
  if (lang === "ht") return "ht-HT";
  if (lang === "zh") return "zh-CN";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}

function parseJsonBody<T>(raw: string, onFail: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(onFail);
  }
}

function pickRecorderMime(): string {
  const c = "audio/webm;codecs=opus";
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "";
}

export const ResourceChat = forwardRef<
  ResourceChatHandle,
  {
    lang: Lang;
    topicSummary: string;
    resourceIds: string[];
  }
>(function ResourceChat({ lang, topicSummary, resourceIds }, ref) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  /** Keeps latest thread for async callers (e.g. voice); state updates alone can lag before fetch. */
  const messagesRef = useRef<Msg[]>([]);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendChat = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || busy) return;
      setErr(null);
      setBusy(true);
      setInput("");
      const nextThread: Msg[] = [...messagesRef.current, { role: "user", content: trimmed }];
      messagesRef.current = nextThread;
      setMessages(nextThread);
      try {
        const res = await fetch("/api/boston-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextThread,
            uiLang: lang,
            uiLangTag: bcp47ForLang(lang),
            topicSummary,
            resourceIds,
          }),
        });
        const raw = await res.text();
        const data = parseJsonBody<{ reply?: string; error?: string }>(
          raw,
          res.ok ? "Invalid response from chat server." : `Chat server error (${res.status}).`,
        );
        if (!res.ok) throw new Error(data.error || res.statusText);
        const reply = data.reply ?? "";
        const withAssistant: Msg[] = [...nextThread, { role: "assistant", content: reply }];
        messagesRef.current = withAssistant;
        setMessages(withAssistant);
      } catch (e) {
        setErr(typeof e === "object" && e && "message" in e ? String((e as Error).message) : String(e));
        const rolled = nextThread.slice(0, -1);
        messagesRef.current = rolled;
        setMessages(rolled);
      } finally {
        setBusy(false);
      }
    },
    [busy, lang, resourceIds, topicSummary],
  );

  const stopRecording = useCallback(() => {
    const r = recRef.current;
    if (r && r.state !== "inactive") r.stop();
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setErr(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr(t(lang, "chatMicUnsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mime = pickRecorderMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = mr;
      mr.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: mime || mr.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 200) {
          setVoiceBusy(false);
          return;
        }
        setVoiceBusy(true);
        try {
          const res = await fetch("/api/deepgram/transcribe", {
            method: "POST",
            headers: { "Content-Type": blob.type || "audio/webm" },
            body: blob,
          });
          const raw = await res.text();
          const data = parseJsonBody<{ transcript?: string; error?: string }>(
            raw,
            res.ok ? "Invalid response from voice server." : `Voice server error (${res.status}).`,
          );
          if (!res.ok) throw new Error(data.error || res.statusText);
          const transcript = (data.transcript ?? "").trim();
          if (transcript) await sendChat(transcript);
        } catch (e) {
          setErr(typeof e === "object" && e && "message" in e ? String((e as Error).message) : String(e));
        } finally {
          setVoiceBusy(false);
        }
      };
      mr.start(200);
      setRecording(true);
    } catch (e) {
      setErr(typeof e === "object" && e && "message" in e ? String((e as Error).message) : String(e));
    }
  }, [lang, sendChat]);

  const playLastAssistant = useCallback(async () => {
    const last = [...messagesRef.current].reverse().find((m) => m.role === "assistant");
    if (!last?.content || voiceBusy) return;
    setErr(null);
    setVoiceBusy(true);
    try {
      const res = await fetch("/api/deepgram/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: last.content, uiLang: lang }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      setErr(typeof e === "object" && e && "message" in e ? String((e as Error).message) : String(e));
    } finally {
      setVoiceBusy(false);
    }
  }, [lang, voiceBusy]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[300] flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg ring-2 ring-white/30 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 sm:bottom-8 sm:right-8"
          aria-label={t(lang, "chatOpen")}
        >
          <MessageCircle className="h-7 w-7" strokeWidth={2} aria-hidden />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 p-0 sm:items-end sm:justify-end sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resource-chat-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 id="resource-chat-title" className="text-lg font-semibold text-zinc-900">
                {t(lang, "chatTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                aria-label={t(lang, "chatClose")}
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm leading-relaxed text-sky-950">
                {t(lang, "chatIntro")}
              </p>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[95%] rounded-lg px-3 py-2 text-base leading-relaxed ${
                    m.role === "user"
                      ? "ml-auto bg-slate-800 text-white"
                      : "mr-auto border border-zinc-200 bg-zinc-50 text-zinc-900"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <ChatMarkdown content={m.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              ))}
              {(busy || voiceBusy) && (
                <p className="text-sm text-zinc-500" aria-live="polite">
                  {busy ? t(lang, "chatThinking") : t(lang, "chatVoiceWorking")}
                </p>
              )}
              <div ref={listEndRef} />
            </div>

            {err && (
              <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-900" role="alert">
                {err}
              </p>
            )}

            <div className="border-t border-zinc-200 p-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={busy || voiceBusy}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 ${
                    recording ? "bg-red-600 text-white ring-red-700" : "bg-zinc-100 text-zinc-900 ring-zinc-200"
                  }`}
                >
                  <Mic className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  {recording ? t(lang, "chatStopRec") : t(lang, "chatMic")}
                </button>
                <button
                  type="button"
                  onClick={playLastAssistant}
                  disabled={busy || voiceBusy || !messages.some((m) => m.role === "assistant")}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-200 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
                >
                  <Volume2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  {t(lang, "chatSpeakLast")}
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendChat(input);
                    }
                  }}
                  placeholder={t(lang, "chatPlaceholder")}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                  disabled={busy || recording}
                  aria-label={t(lang, "chatPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => void sendChat(input)}
                  disabled={busy || recording || !input.trim()}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-md bg-slate-800 px-4 py-2 font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
                  {t(lang, "chatSend")}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{t(lang, "chatDisclaimer")}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

ResourceChat.displayName = "ResourceChat";
