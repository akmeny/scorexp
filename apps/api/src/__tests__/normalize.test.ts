import { describe, expect, it } from "vitest";
import { classifyStatus, normalizeMatch, parseScore } from "../domain/normalize.js";

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
});
