"use client";

import { useState } from "react";
import type { TableSimActivePool } from "@/lib/session-plan";

const COUNT_OPTIONS = [5, 10, 15, 20, 30];
const POOL_OPTIONS: Array<{ value: TableSimActivePool; label: string; description: string }> = [
  { value: "baseline", label: "Baseline", description: "GTO baseline" },
  { value: "A", label: "Pool A", description: "Competent regulars" },
  { value: "B", label: "Pool B", description: "Passive recreationals" },
  { value: "C", label: "Pool C", description: "Aggressive gamblers" },
];

interface SessionConfigProps {
  onStart: (count: number, timed: boolean, activePool: TableSimActivePool) => void;
  loading?: boolean;
}

export function SessionConfig({ onStart, loading }: SessionConfigProps) {
  const [count, setCount] = useState(10);
  const [timed, setTimed] = useState(true);
  const [activePool, setActivePool] = useState<TableSimActivePool>("baseline");

  return (
    <div className="w-full max-w-sm mx-auto">
      <h1 className="text-xl font-bold text-center mb-1">Table Sim</h1>
      <p className="text-gray-400 text-center text-sm mb-8">
        Configure your drill session
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Number of drills
          </label>
          <div className="flex gap-2">
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  count === n
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-500"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Active pool
          </label>
          <div className="grid grid-cols-2 gap-2">
            {POOL_OPTIONS.map((pool) => (
              <button
                key={pool.value}
                onClick={() => setActivePool(pool.value)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                  activePool === pool.value
                    ? "border-amber-400 bg-amber-500/10 text-amber-100 ring-1 ring-amber-400/50"
                    : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                <div className="text-sm font-semibold">{pool.label}</div>
                <div className="text-[11px] text-gray-400">{pool.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">
            Timer
          </span>
          <button
            onClick={() => setTimed(!timed)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              timed ? "bg-emerald-600" : "bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                timed ? "left-6" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <button
          onClick={() => onStart(count, timed, activePool)}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-lg transition-colors mt-4"
        >
          {loading ? "Loading..." : "Start Session"}
        </button>
      </div>
    </div>
  );
}
