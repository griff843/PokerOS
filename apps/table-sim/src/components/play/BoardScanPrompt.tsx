"use client";

import { useEffect, useState } from "react";

interface BoardScanPromptProps {
  onDismiss: () => void;
}

const SCAN_ITEMS = [
  "Pairs on board?",
  "Flush draws?",
  "Straight draws?",
  "Top card?",
  "Board density?",
];

export function BoardScanPrompt({ onDismiss }: BoardScanPromptProps) {
  const [canDismiss, setCanDismiss] = useState(false);
  const [countdown, setCountdown] = useState(1.5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        const next = Math.max(0, prev - 0.1);
        if (next <= 0) {
          setCanDismiss(true);
          clearInterval(interval);
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-700 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-center text-yellow-400 mb-4 uppercase tracking-wide">
          Scan the Board
        </h2>

        <ul className="space-y-2 mb-6">
          {SCAN_ITEMS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-gray-200 text-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        <button
          onClick={onDismiss}
          disabled={!canDismiss}
          className={`w-full py-3 rounded-lg font-semibold text-lg transition-all ${
            canDismiss
              ? "bg-yellow-500 text-gray-900 hover:bg-yellow-400"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          {canDismiss ? "OK - Ready" : `Wait ${countdown.toFixed(1)}s`}
        </button>
      </div>
    </div>
  );
}

