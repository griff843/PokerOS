"use client";

const ACTIVE_TAGS = [
  { id: "paired_top_river", label: "Paired top river" },
  { id: "scare_river_ace", label: "Scare card ace river" },
  { id: "turn_overbet_faced", label: "Facing turn overbet" },
  { id: "flush_complete_turn", label: "Flush completes turn" },
  { id: "four_liner_river", label: "Four-liner river" },
  { id: "polar_turn_big_bet", label: "Polar turn big bet" },
  { id: "overbet_opportunity", label: "Overbet opportunity" },
];

interface TagSelectorProps {
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export function TagSelector({ selectedTags, onToggleTag }: TagSelectorProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
          Trigger
        </p>
        <p className="text-xs text-gray-500">Mark the cue you anchored on</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTIVE_TAGS.map((tag) => {
          const selected = selectedTags.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggleTag(tag.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                selected
                  ? "bg-emerald-500/16 text-emerald-100 ring-1 ring-emerald-400/40"
                  : "bg-black/25 text-gray-400 ring-1 ring-white/6 hover:text-gray-200 hover:ring-white/12"
              }`}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
