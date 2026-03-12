"use client";

import { parseCard, rankDisplay, suitColor, suitSymbol } from "./card-utils";

interface CardProps {
  card: string;
  zoomed?: boolean;
  highlighted?: boolean;
  textureClass?: string;
}

export function Card({ card, zoomed, highlighted, textureClass }: CardProps) {
  const { rank, suit } = parseCard(card);
  const color = suitColor(suit);
  const symbol = suitSymbol(suit);
  const display = rankDisplay(rank);

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center
        rounded-xl border bg-white shadow-[0_8px_24px_rgba(15,23,42,0.28)]
        ${highlighted ? "border-yellow-300 border-2 ring-2 ring-yellow-300/45" : "border-slate-200"}
        ${textureClass ?? ""}
        ${zoomed ? "h-24 w-16 text-xl sm:h-28 sm:w-[72px] sm:text-2xl" : "h-[70px] w-12 text-lg sm:h-[78px] sm:w-[54px] sm:text-xl"}
        select-none transition-transform
      `}
    >
      <span className={`font-bold leading-none ${color}`}>{display}</span>
      <span className={`${color} leading-none ${zoomed ? "text-2xl sm:text-[30px]" : "text-xl sm:text-2xl"}`}>
        {symbol}
      </span>
    </div>
  );
}

export function CardBack({ zoomed }: { zoomed?: boolean }) {
  return (
    <div
      className={`
        flex items-center justify-center
        rounded-xl border border-blue-950/70 bg-[linear-gradient(160deg,rgba(30,64,175,0.95),rgba(15,23,42,0.95))] shadow-[0_8px_24px_rgba(15,23,42,0.28)]
        ${zoomed ? "h-24 w-16 sm:h-28 sm:w-[72px]" : "h-[70px] w-12 sm:h-[78px] sm:w-[54px]"}
        select-none
      `}
    >
      <div className="h-8 w-6 rounded border border-blue-300/60 bg-blue-500/40" />
    </div>
  );
}
