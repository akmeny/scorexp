import {
  ExternalLink,
  Heart,
  LoaderCircle,
  MessageCircle,
  PlayCircle,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Trophy,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchHighlights } from "../lib/api";
import { localizeCountryName } from "../lib/localization";
import type { HighlightsSnapshot, MatchHighlight } from "../types";

interface MatchHighlightsFeedProps {
  date: string;
  timezone: string;
  onRequestClose: () => void;
}

const pageSize = 20;

export function MatchHighlightsFeed({ date, timezone, onRequestClose }: MatchHighlightsFeedProps) {
  const [items, setItems] = useState<MatchHighlight[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => readLikedHighlights());
  const [comments, setComments] = useState<Record<string, string[]>>(() => readHighlightComments());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = async (offset = 0, mode: "replace" | "append" = "replace") => {
    const controller = new AbortController();
    if (mode === "append") setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const snapshot = await fetchHighlights({
        date,
        timezone,
        limit: pageSize,
        offset,
        signal: controller.signal
      });
      applySnapshot(snapshot, mode);
    } catch (caught) {
      setError("Maç özetleri şu anda alınamadı.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void load(0, "replace");
  }, [date, timezone]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onRequestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRequestClose]);

  const featuredCount = useMemo(() => items.filter((item) => item.type === "VERIFIED").length, [items]);

  const applySnapshot = (snapshot: HighlightsSnapshot, mode: "replace" | "append") => {
    setTotalCount(snapshot.pagination.totalCount);
    setNextOffset(snapshot.pagination.nextOffset);
    setItems((current) => {
      const merged = mode === "append" ? [...current, ...snapshot.highlights] : snapshot.highlights;
      return Array.from(new Map(merged.map((item) => [item.id, item])).values());
    });
  };

  const toggleLike = (id: string) => {
    setLikedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("scorexp:highlightLikes", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const submitComment = (id: string) => {
    const text = drafts[id]?.trim();
    if (!text) return;

    setComments((current) => {
      const next = {
        ...current,
        [id]: [...(current[id] ?? []), text].slice(-8)
      };
      localStorage.setItem("scorexp:highlightComments", JSON.stringify(next));
      return next;
    });
    setDrafts((current) => ({ ...current, [id]: "" }));
  };

  const shareHighlight = async (highlight: MatchHighlight) => {
    const shareUrl = highlight.url ?? window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: highlight.title,
          text: matchTitle(highlight),
          url: shareUrl
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Sharing can be cancelled by the user; the feed should stay quiet.
    }
  };

  return (
    <div className="highlightsOverlay" role="dialog" aria-modal="true" aria-label="Maç özetleri">
      <aside className="highlightsRail" aria-label="Maç özeti bilgileri">
        <div className="highlightsBrand">
          <span className="brandMark">S</span>
          <div>
            <strong>Scorexp</strong>
            <span>Maç Özetleri</span>
          </div>
        </div>

        <div className="highlightsRailMetric">
          <Sparkles size={16} />
          <span>{totalCount || items.length} özet</span>
        </div>
        <div className="highlightsRailMetric">
          <Trophy size={16} />
          <span>{featuredCount} doğrulanmış video</span>
        </div>

        <button className="highlightsRefreshButton" type="button" onClick={() => void load(0, "replace")}>
          <RefreshCw size={15} />
          Yenile
        </button>
      </aside>

      <section className="highlightsStage">
        <header className="highlightsTopbar">
          <div>
            <strong>Maç Özetleri</strong>
            <span>Kaydır, izle, yorumla</span>
          </div>
          <button className="highlightsClose" type="button" onClick={onRequestClose} aria-label="Kapat">
            <X size={20} />
          </button>
        </header>

        {loading ? (
          <div className="highlightsState">
            <LoaderCircle className="syncSpin" size={24} />
            <strong>Özetler yükleniyor</strong>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="highlightsState">
            <strong>{error}</strong>
            <button type="button" onClick={() => void load(0, "replace")}>
              Tekrar dene
            </button>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="highlightsState">
            <PlayCircle size={24} />
            <strong>Bugün için özet bulunamadı</strong>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="highlightReel" aria-label="Kaydırmalı maç özeti akışı">
            {items.map((highlight, index) => (
              <article className="highlightPost" key={highlight.id}>
                <div className="highlightVideoFrame">
                  {highlight.embedUrl ? (
                    <iframe
                      title={highlight.title}
                      src={embedUrl(highlight.embedUrl)}
                      loading={index < 2 ? "eager" : "lazy"}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <div className="highlightPoster">
                      {highlight.imageUrl ? <img src={highlight.imageUrl} alt="" loading="lazy" /> : null}
                      <a href={highlight.url ?? "#"} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} />
                        Kaynakta izle
                      </a>
                    </div>
                  )}
                </div>

                <div className="highlightMetaPanel">
                  <div className="highlightMatchLine">
                    <span>{highlight.type === "VERIFIED" ? "Doğrulanmış" : "Anlık"}</span>
                    <strong>{matchTitle(highlight)}</strong>
                  </div>
                  <h2>{highlight.title}</h2>
                  {highlight.description ? <p>{highlight.description}</p> : null}
                  <div className="highlightSourceRow">
                    <span>{sourceLabel(highlight)}</span>
                    {highlight.url ? (
                      <a href={highlight.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        Kaynak
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="highlightActions" aria-label="Özet etkileşimleri">
                  <button
                    className={likedIds.has(highlight.id) ? "active" : ""}
                    type="button"
                    onClick={() => toggleLike(highlight.id)}
                    aria-label="Beğen"
                  >
                    <Heart size={21} />
                    <span>{formatCount(baseLikes(highlight.id) + (likedIds.has(highlight.id) ? 1 : 0))}</span>
                  </button>
                  <button type="button" aria-label="Yorumlar">
                    <MessageCircle size={21} />
                    <span>{(comments[highlight.id]?.length ?? 0) + baseComments(highlight.id)}</span>
                  </button>
                  <button type="button" onClick={() => void shareHighlight(highlight)} aria-label="Paylaş">
                    <Share2 size={21} />
                    <span>Paylaş</span>
                  </button>
                </div>

                <aside className="highlightComments" aria-label="Yorumlar">
                  <strong>Yorumlar</strong>
                  <div className="highlightCommentList">
                    {(comments[highlight.id] ?? []).length > 0 ? (
                      comments[highlight.id].map((comment, commentIndex) => (
                        <span key={`${highlight.id}:${commentIndex}`}>{comment}</span>
                      ))
                    ) : (
                      <em>İlk yorumu sen yaz.</em>
                    )}
                  </div>
                  <label className="highlightCommentInput">
                    <input
                      value={drafts[highlight.id] ?? ""}
                      onChange={(event) => setDrafts((current) => ({ ...current, [highlight.id]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitComment(highlight.id);
                      }}
                      placeholder="Yorum ekle"
                    />
                    <button type="button" onClick={() => submitComment(highlight.id)} aria-label="Yorumu gönder">
                      <Send size={15} />
                    </button>
                  </label>
                </aside>
              </article>
            ))}

            {nextOffset !== null ? (
              <button className="highlightsMoreButton" type="button" disabled={loadingMore} onClick={() => void load(nextOffset, "append")}>
                {loadingMore ? <LoaderCircle className="syncSpin" size={16} /> : <PlayCircle size={16} />}
                Daha fazla özet
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function readLikedHighlights() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem("scorexp:highlightLikes") ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function readHighlightComments() {
  try {
    const parsed = JSON.parse(localStorage.getItem("scorexp:highlightComments") ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

function embedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtube.com")) {
      url.searchParams.set("rel", "0");
      url.searchParams.set("modestbranding", "1");
    }
    return url.toString();
  } catch {
    return value;
  }
}

function matchTitle(highlight: MatchHighlight) {
  const match = highlight.match;
  if (!match) return highlight.channel ?? "Futbol";
  return `${match.homeTeam.name} - ${match.awayTeam.name}`;
}

function sourceLabel(highlight: MatchHighlight) {
  const match = highlight.match;
  const league = match ? `${localizeCountryName(match.country.name)} · ${match.league.name}` : "Global";
  const channel = highlight.channel ?? highlight.source ?? "Kaynak";
  return `${channel} · ${league}`;
}

function baseLikes(id: string) {
  return 240 + (numericSeed(id) % 9800);
}

function baseComments(id: string) {
  return 3 + (numericSeed(id) % 38);
}

function numericSeed(id: string) {
  return id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}
