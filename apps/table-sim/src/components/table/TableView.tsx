"use client";

import { Card, CardBack } from "../card/Card";
import type { TableSimDrill } from "@/lib/drill-schema";
import {
  buildHistoryLines,
  getDecisionStreet,
  getVisibleBoardCards,
  type ReplayStreet,
} from "@/lib/learning-transparency";
import { calculateSpr, formatSessionLabel } from "@/lib/study-session-ui";

interface TableViewProps {
  drill: TableSimDrill;
  zoomed: boolean;
  onToggleZoom: () => void;
  showHeroHand?: boolean;
  replayStreet?: ReplayStreet;
  textureHighlights?: Map<string, string>;
}

export function TableView({
  drill,
  zoomed,
  onToggleZoom,
  showHeroHand = true,
  replayStreet,
  textureHighlights,
}: TableViewProps) {
  const { scenario, decision_point: decisionPoint } = drill;
  const heroHand = scenario.hero_hand;
  const historyLines = buildHistoryLines(drill);
  const spr = calculateSpr(drill);
  const activeStreet = replayStreet ?? getDecisionStreet(drill);
  const visibleCards = getVisibleBoardCards(drill, activeStreet);
  const visibleFlop = visibleCards.slice(0, 3);
  const visibleTurn = visibleCards[3] ?? null;
  const visibleRiver = visibleCards[4] ?? null;
  const facingLabel = decisionPoint.facing?.size_pct_pot
    ? `${decisionPoint.facing.size_pct_pot}% pot ${formatSessionLabel(decisionPoint.facing.action).toLowerCase()}`
    : decisionPoint.facing?.size_bb
      ? `${decisionPoint.facing.size_bb}bb ${formatSessionLabel(decisionPoint.facing.action).toLowerCase()}`
      : decisionPoint.facing
        ? formatSessionLabel(decisionPoint.facing.action)
        : null;

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
        <div className="rounded-[34px] border border-amber-900/45 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.42),rgba(5,46,22,0.95)_48%,rgba(2,6,23,0.96)_100%)] px-4 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">{activeStreet}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">{scenario.pot_type}</span>
              {spr !== null ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">SPR {spr}</span> : null}
            </div>
            {facingLabel && activeStreet === getDecisionStreet(drill) ? (
              <span className="rounded-full bg-yellow-400/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-950 shadow-[0_10px_24px_rgba(234,179,8,0.28)]">
                Facing {facingLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-6 flex justify-center">
            <span className="rounded-full border border-white/10 bg-black/20 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-100">
              Villain {scenario.villain_position}
            </span>
          </div>

          <div className="mt-6 flex justify-center items-center gap-2 sm:gap-2.5">
            {visibleFlop.length > 0
              ? visibleFlop.map((card, index) => (
                  <Card
                    key={`flop-${index}`}
                    card={card}
                    zoomed={zoomed}
                    textureClass={textureHighlights?.get(card)}
                  />
                ))
              : [0, 1, 2].map((index) => <CardBack key={`preflop-${index}`} zoomed={zoomed} />)}

            {activeStreet !== "preflop" ? (
              visibleTurn ? (
                <Card
                  card={visibleTurn}
                  zoomed={zoomed}
                  highlighted={activeStreet === "turn"}
                  textureClass={textureHighlights?.get(visibleTurn)}
                />
              ) : (
                <CardBack zoomed={zoomed} />
              )
            ) : null}

            {activeStreet === "river" ? (
              visibleRiver ? (
                <Card
                  card={visibleRiver}
                  zoomed={zoomed}
                  highlighted={true}
                  textureClass={textureHighlights?.get(visibleRiver)}
                />
              ) : (
                <CardBack zoomed={zoomed} />
              )
            ) : null}
          </div>

          {showHeroHand && heroHand ? (
            <div className="mt-6 flex justify-center items-center gap-2.5">
              <Card card={heroHand[0]} zoomed={zoomed} />
              <Card card={heroHand[1]} zoomed={zoomed} />
            </div>
          ) : null}

          <div className="mt-6 flex justify-center">
            <span className="rounded-full border border-white/10 bg-black/20 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-100">
              Hero {scenario.hero_position}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/8 bg-gray-900/76 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">
              Spot Read
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-200">{drill.prompt}</p>
          </div>

          <div className="rounded-[28px] border border-white/8 bg-gray-900/76 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">
                Action History
              </p>
              <p className="text-xs text-gray-600">Honest replay</p>
            </div>
            <div className="mt-3 space-y-2">
              {historyLines.map((line) => {
                const active = line.street === activeStreet;
                const availabilityTone = line.availability === "structured"
                  ? "border-emerald-500/18 bg-emerald-500/8 text-emerald-100"
                  : "border-amber-500/16 bg-amber-500/8 text-amber-100";

                return (
                  <div
                    key={line.street}
                    className={`rounded-2xl border px-3 py-3 ${active ? "border-white/16 bg-white/8" : "border-white/8 bg-black/20"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{line.label}</p>
                        {line.board ? <p className="mt-1 text-xs uppercase tracking-[0.12em] text-gray-400">{line.board}</p> : null}
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${availabilityTone}`}>
                        {line.availability === "structured" ? "Structured" : "Partial"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-200">{line.summary}</p>
                    {line.detail ? <p className="mt-1 text-xs leading-5 text-gray-400">{line.detail}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleZoom}
          className="rounded-full border border-white/8 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-300 transition hover:border-white/14 hover:bg-white/5"
        >
          {zoomed ? "Normal View" : "Zoom Board"}
        </button>
      </div>
    </section>
  );
}
