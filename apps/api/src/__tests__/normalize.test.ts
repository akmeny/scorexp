import { describe, expect, it } from "vitest";
import { classifyStatus, normalizeMatch, normalizeMatchDetail, parseScore } from "../domain/normalize.js";

describe("football normalization", () => {
  it("classifies provider statuses into stable groups", () => {
    expect(classifyStatus("Second half")).toBe("live");
    expect(classifyStatus("Finished after penalties")).toBe("finished");
    expect(classifyStatus("Not started")).toBe("upcoming");
  });

  it("parses home and away scores", () => {
    expect(parseScore("3 - 1")).toMatchObject({ home: 3, away: 1 });
    expect(parseScore(null)).toMatchObject({ home: null, away: null });
  });

  it("normalizes Highlightly match payloads", () => {
    const match = normalizeMatch(
      {
        id: 489389,
        date: "2026-05-02T20:45:00.000Z",
        country: { code: "TR", name: "Turkey", logo: "tr.svg" },
        homeTeam: { id: 1, name: "Fenerbahce", logo: null },
        awayTeam: { id: 2, name: "Galatasaray", logo: null },
        league: { id: 10, name: "Super Lig", season: 2026 },
        state: { description: "First half", clock: 31, score: { current: "1 - 0", penalties: null } }
      },
      "Europe/Istanbul",
      "2026-05-02T21:00:00.000Z"
    );

    expect(match.status.group).toBe("live");
    expect(match.score.home).toBe(1);
    expect(match.localTime).toBe("23:45");
  });

  it("normalizes lineup payloads and ignores unknown-only placeholders", () => {
    const detail = normalizeMatchDetail(
      {
        id: 1173801253,
        date: "2026-05-09T14:00:00.000Z",
        country: { code: "GB", name: "England", logo: null },
        homeTeam: { id: 44185, name: "Brighton", logo: null },
        awayTeam: { id: 33973, name: "Wolves", logo: null },
        league: { id: 1, name: "Premier League", season: 2026 },
        state: { description: "Second half", clock: 56, score: { current: "2 - 0", penalties: null } }
      },
      "Europe/Istanbul",
      "2026-05-09T15:00:00.000Z",
      "2026-05-09T15:02:00.000Z",
      {
        reason: "live",
        providerRefreshSeconds: 120,
        clientRefreshSeconds: 30,
        nextProviderRefreshAt: "2026-05-09T15:02:00.000Z"
      },
      {
        lineups: {
          homeTeam: {
            formation: "4-2-3-1",
            initialLineup: [[{ id: 1, name: "Bart Verbruggen", number: 1, position: "Goalkeeper" }]],
            substitutes: [{ id: 2, name: "Jason Steele", number: 23, position: "Goalkeeper" }]
          },
          awayTeam: {
            formation: "Unknown",
            initialLineup: [],
            substitutes: []
          }
        }
      }
    );

    expect(detail.lineups?.home?.formation).toBe("4-2-3-1");
    expect(detail.lineups?.home?.initialLineup[0]?.[0]?.name).toBe("Bart Verbruggen");
    expect(detail.lineups?.home?.substitutes[0]?.name).toBe("Jason Steele");
    expect(detail.lineups?.away).toBeNull();
  });
});
