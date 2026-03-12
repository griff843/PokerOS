"use client";

import { TagSelector } from "./TagSelector";
import { ConfidenceSelector } from "./ConfidenceSelector";
import type { TableSimDrill } from "@/lib/drill-schema";
import type { DecisionConfidence } from "@/lib/session-types";
import { actionNeedsSizing, getDecisionHotkeyMap } from "@/lib/study-session-ui";

const SIZING_BUCKETS = [33, 50, 75, 100, 130];

interface DecisionOverlayProps {
  drill: TableSimDrill;
  selectedAction: string | null;
  selectedSize: number | null;
  selectedTags: string[];
  confidence: DecisionConfidence;
  canSubmit: boolean;
  onSelectAction: (action: string) => void;
  onSelectSize: (size: number) => void;
  onToggleTag: (tag: string) => void;
  onSetConfidence: (confidence: DecisionConfidence) => void;
  onSubmit: () => void;
}

export function DecisionOverlay({
  drill,
  selectedAction,
  selectedSize,
  selectedTags,
  confidence,
  canSubmit,
  onSelectAction,
  onSelectSize,
  onToggleTag,
  onSetConfidence,
  onSubmit,
}: DecisionOverlayProps) {
  const { options, decision_point: decisionPoint } = drill;
  const hotkeys = getDecisionHotkeyMap(options);

  const needsSizing =
    decisionPoint.sizing_buttons_enabled && actionNeedsSizing(selectedAction);

  function actionStyle(action: string, isSelected: boolean): string {
    const base = "w-full rounded-[24px] border px-4 py-3 text-left transition duration-150 ";
    if (isSelected) {
      if (action === "FOLD") return `${base} border-red-400/55 bg-red-500/14 text-red-50 shadow-[0_12px_32px_rgba(127,29,29,0.28)]`;
      if (action === "CALL" || action === "CHECK") return `${base} border-sky-400/55 bg-sky-500/14 text-sky-50 shadow-[0_12px_32px_rgba(14,116,144,0.28)]`;
      return `${base} border-emerald-400/55 bg-emerald-500/14 text-emerald-50 shadow-[0_12px_32px_rgba(6,95,70,0.28)]`;
    }
    if (action === "FOLD") return `${base} border-red-950/70 bg-black/20 text-red-200 hover:border-red-700/60 hover:bg-red-950/30`;
    if (action === "CALL" || action === "CHECK") return `${base} border-sky-950/70 bg-black/20 text-sky-200 hover:border-sky-700/60 hover:bg-sky-950/30`;
    return `${base} border-emerald-950/70 bg-black/20 text-emerald-200 hover:border-emerald-700/60 hover:bg-emerald-950/30`;
  }

  return (
    <section className="rounded-[30px] border border-white/8 bg-gray-900/78 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">
            Build Your Line
          </p>
          <p className="text-sm leading-6 text-gray-300">
            Choose the action first. Add the trigger and confidence before you send it.
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
          <p>1-4 or F/C/R</p>
          <p>Enter submits</p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {options.map((option, index) => {
          const hint = Object.entries(hotkeys).find(([, value]) => value === option.key)?.[0] ?? String(index + 1);
          const selected = selectedAction === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelectAction(option.key)}
              className={actionStyle(option.key, selected)}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block text-base font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-current/65">
                    {selected ? "Selected line" : "Available line"}
                  </span>
                </div>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {hint}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {needsSizing ? (
        <div className="mt-5 space-y-2.5 rounded-[24px] border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
              Sizing
            </p>
            <p className="text-xs text-gray-500">Choose the pressure level</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {SIZING_BUCKETS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onSelectSize(size)}
                className={`rounded-2xl px-2 py-3 text-sm font-semibold transition ${
                  selectedSize === size
                    ? "bg-amber-400 text-gray-950 shadow-[0_10px_28px_rgba(217,119,6,0.3)]"
                    : "border border-white/8 bg-gray-950/80 text-gray-300 hover:border-white/14 hover:bg-gray-900"
                }`}
              >
                {size}%
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-[24px] border border-white/8 bg-black/20 p-4">
        <ConfidenceSelector value={confidence} onChange={onSetConfidence} />
      </div>

      <div className="mt-4 rounded-[24px] border border-white/8 bg-black/20 p-4">
        <TagSelector selectedTags={selectedTags} onToggleTag={onToggleTag} />
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`mt-5 w-full rounded-[24px] px-4 py-3.5 text-base font-semibold transition ${
          canSubmit
            ? "bg-emerald-600 text-white shadow-[0_16px_44px_rgba(5,150,105,0.3)] hover:bg-emerald-500"
            : "cursor-not-allowed bg-gray-950 text-gray-600"
        }`}
      >
        Submit Decision
      </button>
      {!canSubmit ? (
        <p className="mt-2 text-center text-xs text-gray-500">
          Choose a line and trigger before you submit.
        </p>
      ) : null}
    </section>
  );
}
