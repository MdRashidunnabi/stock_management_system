"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Mic, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { processAssistantTurn } from "@/lib/assistant/engine";
import { lookupAssistantFactsAction } from "@/lib/assistant/actions";
import { AssistantLoginCard } from "@/components/assistant/assistant-login-card";
import { useT } from "@/components/i18n/locale-provider";
import { LOCALE_META } from "@/lib/i18n/config";
import type {
  AssistantAction,
  AssistantChip,
  AssistantPhase,
  AssistantReply,
  AssistantSession,
  PendingLogin,
} from "@/lib/assistant/types";

type ChatMessage = {
  id: string;
  from: "user" | "assistant";
} & AssistantReply;

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toMessages(replies: AssistantReply[]): ChatMessage[] {
  return replies.map((reply, index) => ({
    id: `welcome-${index}`,
    from: "assistant" as const,
    ...reply,
  }));
}

function SpeechButton({ onText }: { onText: (text: string) => void }) {
  const { t, locale } = useT();
  const [listening, setListening] = useState(false);

  function start() {
    const win = window as Window & {
      SpeechRecognition?: new () => BrowserSpeech;
      webkitSpeechRecognition?: new () => BrowserSpeech;
    };
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error(t("errors.generic"));
      return;
    }
    const rec = new Ctor();
    rec.lang = LOCALE_META[locale]?.speechLang ?? "en-US";
    rec.interimResults = false;
    rec.onresult = (event) => {
      const said = event.results[0]?.[0]?.transcript?.trim();
      if (said) onText(said);
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <Button
      type="button"
      size="icon-sm"
      variant={listening ? "default" : "ghost"}
      aria-label={t("a11y.speak")}
      onClick={start}
      className={cn(listening && "animate-pulse")}
    >
      <Mic className="size-4" />
    </Button>
  );
}

type BrowserSpeech = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
};

export function ShopAssistant({ session }: { session: AssistantSession }) {
  const { t } = useT();
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<AssistantPhase>("idle");
  const [demoStep, setDemoStep] = useState(0);
  const [pendingLogin, setPendingLogin] = useState<PendingLogin | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    toMessages([
      {
        text: session.signedIn
          ? t("agent.welcomeUser", { name: session.displayName ?? session.email ?? "" })
          : t("agent.welcomeGuest"),
        chips: session.signedIn
          ? undefined
          : [
              {
                id: "account",
                label: t("agent.chipAccount"),
                payload: "I want to access my account",
              },
              { id: "demo", label: t("agent.chipDemo"), payload: "::demo" },
              { id: "pay", label: t("agent.chipPay"), payload: "How do I take a payment?" },
              { id: "stock", label: t("agent.chipStock"), payload: "Where do I see stock?" },
            ],
      },
    ]),
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  const runTurn = useCallback(
    async (text: string, visibleText?: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      setMessages((prev) => [
        ...prev,
        { id: newId(), from: "user", text: visibleText?.trim() || trimmed },
      ]);
      try {
        const result = processAssistantTurn({
          text: trimmed,
          session,
          phase,
          demoStep,
          pendingLogin,
        });
        setPhase(result.phase);
        setDemoStep(result.demoStep);
        setPendingLogin(result.pendingLogin);

        const enriched: ChatMessage[] = [];
        for (const reply of result.replies) {
          const message: ChatMessage = { id: newId(), from: "assistant", ...reply };
          if (reply.lookupTopic && session.signedIn) {
            const lookup = await lookupAssistantFactsAction({ topic: reply.lookupTopic });
            const facts = lookup?.data && lookup.data.ok ? lookup.data.facts : [];
            if (facts.length > 0) message.facts = facts;
          }
          enriched.push(message);
          const autoHref = reply.actions?.find((a) => a.href && result.phase === "demo")?.href;
          if (result.phase === "demo" && autoHref) {
            router.push(autoHref);
          }
        }
        setMessages((prev) => [...prev, ...enriched]);
      } finally {
        setBusy(false);
      }
    },
    [busy, demoStep, pendingLogin, phase, router, session],
  );

  function handleAction(action: AssistantAction) {
    if (action.href) {
      setOpen(true);
      router.push(action.href);
    }
    if (action.payload) {
      void runTurn(action.payload, action.payload.startsWith("::") ? action.label : undefined);
    }
  }

  function handleChip(chip: AssistantChip) {
    void runTurn(chip.payload, chip.label);
  }

  function submitDraft() {
    const value = draft;
    setDraft("");
    void runTurn(value);
  }

  return (
    <div data-shopos-agent className="print:hidden">
      {open ? (
        <section
          aria-label={t("agent.title")}
          className="border-border bg-card fixed inset-x-3 bottom-3 z-[80] flex max-h-[min(40rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[24.5rem]"
        >
          <header className="from-primary via-primary to-info flex items-center justify-between bg-gradient-to-r px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-sm leading-tight font-semibold">{t("agent.title")}</p>
                <p className="text-[11px] text-white/80">
                  {session.signedIn
                    ? t("agent.signedLine", {
                        shop: session.tenantName ?? "",
                        role: session.role ?? "",
                      })
                    : t("agent.guestLine")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-white hover:bg-white/15 hover:text-white"
              aria-label={t("a11y.closeHelp")}
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                pendingLogin={pendingLogin}
                onAction={handleAction}
                onChip={handleChip}
              />
            ))}
            {busy ? (
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="size-3.5 animate-spin" /> {t("agent.looking")}
              </p>
            ) : null}
          </div>

          <form
            className="border-border bg-background/90 border-t p-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitDraft();
            }}
          >
            <div className="border-input flex items-end gap-1 rounded-xl border px-2 py-1.5">
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitDraft();
                  }
                }}
                placeholder={t("agent.placeholder")}
                className="placeholder:text-muted-foreground max-h-24 min-h-9 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none"
              />
              <SpeechButton
                onText={(text) => {
                  setDraft(text);
                  void runTurn(text);
                }}
              />
              <Button
                type="submit"
                size="icon-sm"
                disabled={!draft.trim() || busy}
                aria-label={t("a11y.send")}
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground mt-1.5 text-center text-[10px]">
              {t("agent.footer")}
            </p>
          </form>
        </section>
      ) : (
        <Button
          type="button"
          onClick={() => {
            setOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="from-primary to-info fixed right-4 bottom-4 z-[80] h-14 gap-2 rounded-full bg-gradient-to-r px-4 text-white shadow-xl hover:opacity-95 sm:right-6 sm:bottom-6"
          aria-label={t("a11y.openHelp")}
        >
          <Sparkles className="size-5" />
          <span className="hidden sm:inline">{t("agent.fab")}</span>
        </Button>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  pendingLogin,
  onAction,
  onChip,
}: {
  message: ChatMessage;
  pendingLogin: PendingLogin | null;
  onAction: (action: AssistantAction) => void;
  onChip: (chip: AssistantChip) => void;
}) {
  const mine = message.from === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          mine
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md",
        )}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        {message.facts && message.facts.length > 0 ? (
          <ul className="mt-2 space-y-1 border-t border-black/10 pt-2 text-xs">
            {message.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        ) : null}
        {message.chips && message.chips.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => onChip(chip)}
                className="bg-background text-foreground hover:border-primary rounded-full border px-2.5 py-1 text-xs"
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}
        {message.actions && message.actions.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {message.actions.map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant={action.variant ?? "default"}
                className="justify-between"
                onClick={() => onAction(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
        {message.showLogin && pendingLogin ? <AssistantLoginCard pending={pendingLogin} /> : null}
        {message.from === "assistant" && message.lookupTopic ? (
          <Badge variant="info" className="mt-2">
            Live shop data
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
