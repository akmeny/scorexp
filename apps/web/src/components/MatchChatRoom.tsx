import { MessageCircle, Send, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { chatEventsUrl, fetchChatMessages, sendChatMessage } from "../lib/api";
import type { ChatMessage, NormalizedMatch } from "../types";

interface MatchChatRoomProps {
  match: NormalizedMatch;
  variant?: "panel" | "embedded";
  onClose?: () => void;
}

interface ChatUser {
  id: string;
  nickname: string;
  color: string;
}

const chatUserKey = "scorexp:chatUser";
const maxLocalMessages = 150;

const nicknameColors = [
  "#8A91FF",
  "#52D6A0",
  "#FF7C87",
  "#F2CA5B",
  "#6DD6FF",
  "#C58CFF",
  "#FF9F68",
  "#5EEAD4",
  "#F472B6",
  "#A3E635",
  "#93C5FD",
  "#FDA4AF",
  "#FBBF24",
  "#34D399",
  "#818CF8",
  "#FB7185",
  "#2DD4BF",
  "#E879F9",
  "#60A5FA",
  "#F97316",
  "#FACC15",
  "#22D3EE",
  "#A78BFA",
  "#F87171",
  "#4ADE80",
  "#38BDF8",
  "#FB923C",
  "#EAB308",
  "#C084FC",
  "#67E8F9",
  "#F9A8D4",
  "#86EFAC",
  "#7DD3FC",
  "#FDBA74",
  "#C4B5FD",
  "#FDE047",
  "#99F6E4",
  "#FCA5A5",
  "#BFDBFE",
  "#D8B4FE"
];

const nicknameSeeds = [
  "Tribun",
  "KaleArkasi",
  "Deplasman",
  "Skorcu",
  "Forvet",
  "OnNumara",
  "Kanat",
  "Presci",
  "Libero",
  "Tempo",
  "Golcu",
  "Taktik"
];

export function MatchChatRoom({ match, variant = "panel", onClose }: MatchChatRoomProps) {
  const user = useMemo(() => readChatUser(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [viewerCount, setViewerCount] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const matchTitle = `${match.homeTeam.name} - ${match.awayTeam.name}`;

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const target = scrollRef.current;
    if (!target) return;

    target.scrollTo({
      top: target.scrollHeight,
      behavior
    });
    shouldStickToBottomRef.current = true;
    setHasNewMessages(false);
  }, []);

  const appendMessages = useCallback(
    (incoming: ChatMessage[]) => {
      if (incoming.length === 0) return;

      const knownIds = new Set(messagesRef.current.map((message) => message.id));
      const freshMessages = incoming.filter((message) => !knownIds.has(message.id));
      if (freshMessages.length === 0) return;

      const nextMessages = [...messagesRef.current, ...freshMessages]
        .sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt))
        .slice(-maxLocalMessages);

      messagesRef.current = nextMessages;
      setMessages(nextMessages);

      const hasFreshMessageFromOthers = freshMessages.some((message) => message.authorId !== user.id);
      if (!shouldStickToBottomRef.current && hasFreshMessageFromOthers) {
        setHasNewMessages(true);
      }
    },
    [user.id]
  );

  useEffect(() => {
    messagesRef.current = [];
    setMessages([]);
    setNotice(null);
    setHasNewMessages(false);
    setViewerCount(1);
    shouldStickToBottomRef.current = true;

    const controller = new AbortController();
    void fetchChatMessages({ matchId: match.id, signal: controller.signal })
      .then((snapshot) => {
        appendMessages(snapshot.messages);
        if (typeof snapshot.viewerCount === "number") {
          setViewerCount(normalizeViewerCount(snapshot.viewerCount));
        }
      })
      .catch((caught) => {
        if ((caught as Error).name !== "AbortError") {
          setNotice("Sohbet gecmisi alinamadi.");
        }
      });

    const events = new EventSource(chatEventsUrl(match.id));

    events.onopen = () => {
      setNotice(null);
    };

    events.addEventListener("ready", (event) => {
      const payload = parseEventData<{ messages?: ChatMessage[]; viewerCount?: number }>(event);
      if (payload?.messages) appendMessages(payload.messages);
      if (typeof payload?.viewerCount === "number") {
        setViewerCount(normalizeViewerCount(payload.viewerCount));
      }
    });

    events.addEventListener("message", (event) => {
      const message = parseEventData<ChatMessage>(event);
      if (message) appendMessages([message]);
    });

    events.addEventListener("presence", (event) => {
      const payload = parseEventData<{ viewerCount?: number }>(event);
      if (typeof payload?.viewerCount === "number") {
        setViewerCount(normalizeViewerCount(payload.viewerCount));
      }
    });

    return () => {
      controller.abort();
      events.close();
    };
  }, [appendMessages, match.id]);

  useLayoutEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    if (shouldStickToBottomRef.current || lastMessage.authorId === user.id) {
      window.requestAnimationFrame(() => scrollToLatest(lastMessage.authorId === user.id ? "smooth" : "auto"));
    }
  }, [messages, scrollToLatest, user.id]);

  useLayoutEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;

    const styles = window.getComputedStyle(composer);
    const minHeight = Number.parseFloat(styles.minHeight) || 40;
    const maxHeight = Number.parseFloat(styles.getPropertyValue("--chat-composer-max-height")) || 118;

    composer.style.height = "auto";
    const nextHeight = Math.min(Math.max(composer.scrollHeight, minHeight), maxHeight);
    composer.style.height = `${nextHeight}px`;
    composer.style.overflowY = composer.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [body]);

  const handleScroll = () => {
    const target = scrollRef.current;
    if (!target) return;

    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const atBottom = distanceFromBottom < 36;
    shouldStickToBottomRef.current = atBottom;
    if (atBottom) setHasNewMessages(false);
  };

  const handleSubmit = async () => {
    const nextBody = body.trim();
    if (!nextBody || isSending) return;

    setIsSending(true);
    setNotice(null);

    try {
      const message = await sendChatMessage({
        matchId: match.id,
        authorId: user.id,
        nickname: user.nickname,
        color: user.color,
        body: nextBody
      });
      setBody("");
      shouldStickToBottomRef.current = true;
      appendMessages([message]);
    } catch {
      setNotice("Mesaj gonderilemedi.");
    } finally {
      setIsSending(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    void handleSubmit();
  };

  return (
    <section className={`matchChatRoom ${variant}`} aria-label={`${matchTitle} sohbet odasi`}>
      <header className="chatTop">
        <div className="chatTitleBlock">
          <span>
            <MessageCircle size={15} />
            Sohbet
          </span>
          <strong title={matchTitle}>{matchTitle}</strong>
        </div>
        <div className="chatTopActions">
          <span
            className="chatViewerCount"
            aria-label={`${viewerCount} kisi iceride`}
            title={`${viewerCount} kisi iceride`}
          >
            <UsersRound size={14} />
            <strong>{viewerCount}</strong>
          </span>
          {onClose ? (
            <button className="iconButton" type="button" aria-label="Sohbeti kapat" onClick={onClose}>
              <X size={17} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="chatMessages" ref={scrollRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="chatEmptyState">
            <UsersRound size={17} />
            <span>Sohbet sessiz.</span>
          </div>
        ) : null}

        {messages.map((message) => {
          const mine = message.authorId === user.id;
          const nicknameColor = mine ? user.color : message.color;

          return (
            <article className={mine ? "chatMessage mine" : "chatMessage other"} key={message.id}>
              <div className="chatMessageHeader">
                <strong style={{ color: nicknameColor }}>{mine ? "Sen" : message.nickname}</strong>
                <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
              </div>
              <p>{message.body}</p>
            </article>
          );
        })}
      </div>

      <div className="chatComposerWrap">
        {hasNewMessages ? (
          <button className="chatNewMessageNotice" type="button" onClick={() => scrollToLatest()}>
            Yeni mesaj
          </button>
        ) : null}
        {notice ? <div className="chatNotice">{notice}</div> : null}
        <form
          className="chatComposer"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <textarea
            ref={composerRef}
            value={body}
            maxLength={280}
            rows={1}
            aria-label="Mesaj yaz"
            autoComplete="off"
            enterKeyHint="send"
            placeholder="Fikrini paylaş"
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={onComposerKeyDown}
          />
          <button type="submit" aria-label="Mesaj gonder" disabled={!body.trim() || isSending}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}

function readChatUser(): ChatUser {
  try {
    const stored = localStorage.getItem(chatUserKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ChatUser>;
      if (parsed.id && parsed.nickname && parsed.color) {
        return {
          id: parsed.id,
          nickname: parsed.nickname,
          color: parsed.color
        };
      }
    }
  } catch {
    // Local storage can be unavailable in privacy modes.
  }

  const color = randomItem(nicknameColors);
  const nickname = `${randomItem(nicknameSeeds)}${Math.floor(100 + Math.random() * 900)}`;
  const user: ChatUser = {
    id: `local:${safeRandomId()}`,
    nickname,
    color
  };

  try {
    localStorage.setItem(chatUserKey, JSON.stringify(user));
  } catch {
    // Chat still works for the current page lifetime.
  }

  return user;
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)] ?? items[0]!;
}

function safeRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function parseEventData<T>(event: Event) {
  try {
    return JSON.parse((event as MessageEvent<string>).data) as T;
  } catch {
    return null;
  }
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeViewerCount(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function formatMessageTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}
