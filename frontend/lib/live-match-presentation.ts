"use client";

import { useEffect, useState } from "react";
import type { LiveMatch, MatchEventSummaryItem } from "@/lib/types";

export type TeamSide = "home" | "away";

export interface MatchNotice {
  label: "Tehlike" | "Gol" | "Gol İptal" | "Penaltı" | "Kaçan Penaltı";
  tone: "danger" | "goal" | "cancelled" | "penalty" | "missed";
}

export interface MatchPresentationSnapshot {
  displayHomeScore: number | null;
  displayAwayScore: number | null;
  homeNotice: MatchNotice | null;
  awayNotice: MatchNotice | null;
  isScoreStripeActive: boolean;
  isLiveIntroActive: boolean;
}

type Listener = () => void;

interface PresentationState extends MatchPresentationSnapshot {
  initialized: boolean;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  statusShort: string | null;
  latestEventKey: string | null;
  scoreStripeUntil: number;
  liveIntroUntil: number;
  homeNoticeUntil: number;
  awayNoticeUntil: number;
  goalTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimers: Set<ReturnType<typeof setTimeout>>;
}

const liveStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "SUSP"]);
const goalDangerMs = 12_000;
const stripeMs = 3_000;
const liveIntroMs = 10_000;
const penaltyNoticeMs = 120_000;
const shortNoticeMs = 8_000;

const emptySnapshot: MatchPresentationSnapshot = {
  displayHomeScore: null,
  displayAwayScore: null,
  homeNotice: null,
  awayNotice: null,
  isScoreStripeActive: false,
  isLiveIntroActive: false,
};

function createState(): PresentationState {
  return {
    ...emptySnapshot,
    initialized: false,
    actualHomeScore: null,
    actualAwayScore: null,
    statusShort: null,
    latestEventKey: null,
    scoreStripeUntil: 0,
    liveIntroUntil: 0,
    homeNoticeUntil: 0,
    awayNoticeUntil: 0,
    goalTimer: null,
    cleanupTimers: new Set(),
  };
}

function getEventKey(event: MatchEventSummaryItem | null | undefined): string | null {
  if (!event) {
    return null;
  }

  return [
    event.minute ?? "",
    event.extraMinute ?? "",
    event.teamId ?? "",
    event.playerName ?? "",
    event.type,
    event.detail,
  ].join(":");
}

function getEventSide(match: LiveMatch, event: MatchEventSummaryItem): TeamSide | null {
  if (event.teamId === match.homeTeam.id) {
    return "home";
  }

  if (event.teamId === match.awayTeam.id) {
    return "away";
  }

  return null;
}

function classifyEvent(
  match: LiveMatch,
): { key: string; side: TeamSide | null; type: "goal-cancelled" | "penalty" | "missed-penalty" } | null {
  const event = match.eventsSummary?.latest;
  const key = getEventKey(event);

  if (!event || !key) {
    return null;
  }

  const text = `${event.type} ${event.detail}`.toLowerCase();
  const side = getEventSide(match, event);
  const isPenaltyText = text.includes("penalty");

  if (
    isPenaltyText &&
    (text.includes("miss") || text.includes("saved") || text.includes("failed"))
  ) {
    return {
      key,
      side,
      type: "missed-penalty",
    };
  }

  if (
    text.includes("goal") &&
    (text.includes("cancel") || text.includes("disallow") || text.includes("var"))
  ) {
    return {
      key,
      side,
      type: "goal-cancelled",
    };
  }

  if (
    isPenaltyText &&
    !text.includes("goal") &&
    !text.includes("miss") &&
    !text.includes("saved")
  ) {
    return {
      key,
      side,
      type: "penalty",
    };
  }

  return null;
}

function inferScoringSide(
  previousHomeScore: number | null,
  previousAwayScore: number | null,
  nextHomeScore: number | null,
  nextAwayScore: number | null,
): TeamSide | null {
  const homeDelta = (nextHomeScore ?? 0) - (previousHomeScore ?? 0);
  const awayDelta = (nextAwayScore ?? 0) - (previousAwayScore ?? 0);

  if (homeDelta > awayDelta && homeDelta > 0) {
    return "home";
  }

  if (awayDelta > homeDelta && awayDelta > 0) {
    return "away";
  }

  if (homeDelta > 0) {
    return "home";
  }

  if (awayDelta > 0) {
    return "away";
  }

  return null;
}

function inferCancelledSide(
  previousHomeScore: number | null,
  previousAwayScore: number | null,
  nextHomeScore: number | null,
  nextAwayScore: number | null,
): TeamSide | null {
  const homeDelta = (nextHomeScore ?? 0) - (previousHomeScore ?? 0);
  const awayDelta = (nextAwayScore ?? 0) - (previousAwayScore ?? 0);

  if (homeDelta < 0) {
    return "home";
  }

  if (awayDelta < 0) {
    return "away";
  }

  return null;
}

class MatchPresentationManager {
  private readonly states = new Map<number, PresentationState>();

  private readonly listeners = new Map<number, Set<Listener>>();

  subscribe(matchId: number, listener: Listener): () => void {
    const listeners = this.listeners.get(matchId);

    if (listeners) {
      listeners.add(listener);
    } else {
      this.listeners.set(matchId, new Set([listener]));
    }

    return () => {
      const current = this.listeners.get(matchId);

      if (!current) {
        return;
      }

      current.delete(listener);

      if (current.size === 0) {
        this.listeners.delete(matchId);
      }
    };
  }

  markEnteredLive(matchId: number): void {
    const state = this.ensureState(matchId);
    const now = Date.now();

    state.liveIntroUntil = Math.max(state.liveIntroUntil, now + liveIntroMs);
    state.scoreStripeUntil = Math.max(state.scoreStripeUntil, now + stripeMs);
    this.scheduleExpiry(matchId, state.liveIntroUntil);
    this.scheduleExpiry(matchId, state.scoreStripeUntil);
    this.publish(matchId);
  }

  ingest(match: LiveMatch): MatchPresentationSnapshot {
    const state = this.ensureState(match.matchId);
    const previousHomeScore = state.actualHomeScore;
    const previousAwayScore = state.actualAwayScore;
    const previousStatus = state.statusShort;
    const latestEvent = classifyEvent(match);

    if (!state.initialized) {
      state.initialized = true;
      state.actualHomeScore = match.homeScore;
      state.actualAwayScore = match.awayScore;
      state.displayHomeScore = match.homeScore;
      state.displayAwayScore = match.awayScore;
      state.statusShort = match.statusShort;
      state.latestEventKey = latestEvent?.key ?? getEventKey(match.eventsSummary?.latest);
      this.prune(match.matchId);
      return this.getSnapshot(match.matchId, match);
    }

    state.actualHomeScore = match.homeScore;
    state.actualAwayScore = match.awayScore;
    state.statusShort = match.statusShort;

    if (
      previousStatus &&
      !liveStatuses.has(previousStatus) &&
      liveStatuses.has(match.statusShort)
    ) {
      this.markEnteredLive(match.matchId);
    }

    const scoringSide = inferScoringSide(
      previousHomeScore,
      previousAwayScore,
      match.homeScore,
      match.awayScore,
    );
    const cancelledSide = inferCancelledSide(
      previousHomeScore,
      previousAwayScore,
      match.homeScore,
      match.awayScore,
    );

    if (cancelledSide) {
      this.cancelPendingGoal(state);
      state.displayHomeScore = match.homeScore;
      state.displayAwayScore = match.awayScore;
      this.setNotice(match.matchId, cancelledSide, {
        label: "Gol İptal",
        tone: "cancelled",
      }, shortNoticeMs);
      this.startStripe(match.matchId);
    } else if (scoringSide) {
      this.startGoalDanger(
        match.matchId,
        scoringSide,
        previousHomeScore,
        previousAwayScore,
      );
    } else if (!state.goalTimer) {
      state.displayHomeScore = match.homeScore;
      state.displayAwayScore = match.awayScore;
    }

    if (latestEvent && latestEvent.key !== state.latestEventKey) {
      state.latestEventKey = latestEvent.key;

      if (!(scoringSide && latestEvent.type === "penalty")) {
        this.applyEvent(match.matchId, latestEvent);
      }
    }

    this.prune(match.matchId);
    this.publish(match.matchId);
    return this.getSnapshot(match.matchId, match);
  }

  getSnapshot(matchId: number, fallbackMatch: LiveMatch | null): MatchPresentationSnapshot {
    const state = this.states.get(matchId);

    if (!state) {
      return fallbackMatch
        ? {
            ...emptySnapshot,
            displayHomeScore: fallbackMatch.homeScore,
            displayAwayScore: fallbackMatch.awayScore,
          }
        : emptySnapshot;
    }

    this.prune(matchId);

    return {
      displayHomeScore: state.initialized
        ? state.displayHomeScore
        : fallbackMatch?.homeScore ?? null,
      displayAwayScore: state.initialized
        ? state.displayAwayScore
        : fallbackMatch?.awayScore ?? null,
      homeNotice: state.homeNotice,
      awayNotice: state.awayNotice,
      isScoreStripeActive: state.scoreStripeUntil > Date.now(),
      isLiveIntroActive: state.liveIntroUntil > Date.now(),
    };
  }

  private applyEvent(
    matchId: number,
    event: { side: TeamSide | null; type: "goal-cancelled" | "penalty" | "missed-penalty" },
  ): void {
    if (!event.side) {
      return;
    }

    if (event.type === "goal-cancelled") {
      const state = this.ensureState(matchId);

      this.cancelPendingGoal(state);
      state.displayHomeScore = state.actualHomeScore;
      state.displayAwayScore = state.actualAwayScore;
      this.setNotice(matchId, event.side, {
        label: "Gol İptal",
        tone: "cancelled",
      }, shortNoticeMs);
      this.startStripe(matchId);
      return;
    }

    if (event.type === "missed-penalty") {
      this.setNotice(matchId, event.side, {
        label: "Kaçan Penaltı",
        tone: "missed",
      }, shortNoticeMs);
      return;
    }

    this.setNotice(matchId, event.side, {
      label: "Penaltı",
      tone: "penalty",
    }, penaltyNoticeMs);
  }

  private startGoalDanger(
    matchId: number,
    side: TeamSide,
    previousHomeScore: number | null,
    previousAwayScore: number | null,
  ): void {
    const state = this.ensureState(matchId);

    this.cancelPendingGoal(state);
    state.displayHomeScore = previousHomeScore;
    state.displayAwayScore = previousAwayScore;
    this.setNotice(matchId, side, {
      label: "Tehlike",
      tone: "danger",
    }, goalDangerMs);

    state.goalTimer = setTimeout(() => {
      state.goalTimer = null;
      state.displayHomeScore = state.actualHomeScore;
      state.displayAwayScore = state.actualAwayScore;
      this.setNotice(matchId, side, {
        label: "Gol",
        tone: "goal",
      }, stripeMs);
      this.startStripe(matchId);
      this.publish(matchId);
    }, goalDangerMs);
  }

  private setNotice(
    matchId: number,
    side: TeamSide,
    notice: MatchNotice,
    ttlMs: number,
  ): void {
    const state = this.ensureState(matchId);
    const until = Date.now() + ttlMs;

    if (side === "home") {
      state.homeNotice = notice;
      state.homeNoticeUntil = until;
    } else {
      state.awayNotice = notice;
      state.awayNoticeUntil = until;
    }

    this.scheduleExpiry(matchId, until);
  }

  private startStripe(matchId: number): void {
    const state = this.ensureState(matchId);

    state.scoreStripeUntil = Math.max(state.scoreStripeUntil, Date.now() + stripeMs);
    this.scheduleExpiry(matchId, state.scoreStripeUntil);
  }

  private scheduleExpiry(matchId: number, until: number): void {
    const state = this.ensureState(matchId);
    const delay = Math.max(0, until - Date.now()) + 20;
    const timer = setTimeout(() => {
      state.cleanupTimers.delete(timer);
      this.prune(matchId);
      this.publish(matchId);
    }, delay);

    state.cleanupTimers.add(timer);
  }

  private prune(matchId: number): void {
    const state = this.ensureState(matchId);
    const now = Date.now();

    if (state.scoreStripeUntil <= now) {
      state.scoreStripeUntil = 0;
    }

    if (state.liveIntroUntil <= now) {
      state.liveIntroUntil = 0;
    }

    if (state.homeNotice && state.homeNoticeUntil <= now) {
      state.homeNotice = null;
      state.homeNoticeUntil = 0;
    }

    if (state.awayNotice && state.awayNoticeUntil <= now) {
      state.awayNotice = null;
      state.awayNoticeUntil = 0;
    }
  }

  private cancelPendingGoal(state: PresentationState): void {
    if (!state.goalTimer) {
      return;
    }

    clearTimeout(state.goalTimer);
    state.goalTimer = null;
  }

  private ensureState(matchId: number): PresentationState {
    const existing = this.states.get(matchId);

    if (existing) {
      return existing;
    }

    const state = createState();
    this.states.set(matchId, state);
    return state;
  }

  private publish(matchId: number): void {
    const listeners = this.listeners.get(matchId);

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener();
    }
  }
}

const presentationManager = new MatchPresentationManager();

export function markMatchEnteredLive(matchId: number): void {
  presentationManager.markEnteredLive(matchId);
}

export function useMatchPresentation(match: LiveMatch | null): MatchPresentationSnapshot {
  const [snapshot, setSnapshot] = useState<MatchPresentationSnapshot>(() =>
    match
      ? presentationManager.getSnapshot(match.matchId, match)
      : emptySnapshot,
  );

  useEffect(() => {
    if (!match) {
      setSnapshot(emptySnapshot);
      return;
    }

    const update = () => {
      setSnapshot(presentationManager.getSnapshot(match.matchId, match));
    };
    const unsubscribe = presentationManager.subscribe(match.matchId, update);

    setSnapshot(presentationManager.ingest(match));

    return unsubscribe;
  }, [match]);

  return snapshot;
}
