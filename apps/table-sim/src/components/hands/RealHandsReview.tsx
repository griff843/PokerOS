"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealHandsSnapshot } from "@/lib/real-hands";

export function RealHandsReview() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<RealHandsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSnapshot(selectedHandId);
  }, [selectedHandId]);

  async function loadSnapshot(handId?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(handId ? `/api/real-hands?id=${encodeURIComponent(handId)}` : "/api/real-hands", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load imported hands");
      }
      const data = await response.json() as RealHandsSnapshot;
      setSnapshot(data);
      setSelectedHandId(data.selectedHand?.importedHandId ?? handId ?? null);
    } catch (loadError) {
      console.error("Failed to load imported hands:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load imported hands");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }

  async function submitImport(importText: string) {
    if (!importText.trim()) {
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const response = await fetch("/api/real-hands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText, source: "paste" }),
      });
      if (!response.ok) {
        throw new Error("Failed to import hands");
      }
      setText("");
      await loadSnapshot(null);
    } catch (importError) {
      console.error("Failed to import hands:", importError);
      setError(importError instanceof Error ? importError.message : "Failed to import hands");
    } finally {
      setImporting(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const content = await file.text();
    setText(content);
    await submitImport(content);
    event.target.value = "";
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,67,0.14),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/85">Real Hand Review</p>
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">
                {snapshot?.header.headline ?? "Connect real hands to the coaching loop."}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-emerald-50/88 sm:text-base">
                {snapshot?.header.summary ?? "Import a hand history and let Poker OS turn it into selective review spots and training follow-ups."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/app/session")}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              Return To Command Center
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              {snapshot?.header.importStatus ?? "No imports yet"}
            </span>
            <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Premium, transparent first version
            </span>
          </div>
        </section>

        <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Import Hand History</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Paste PokerStars-style text or upload a hand-history file. Unsupported hands stay explicit instead of being silently faked.</p>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste one or more PokerStars hand histories here"
                className="mt-4 min-h-[220px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/40"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void submitImport(text)}
                  disabled={importing || !text.trim()}
                  className="rounded-[20px] bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:bg-emerald-700/70 disabled:text-white"
                >
                  {importing ? "Importing Hands" : "Import Hands"}
                </button>
                <label className="rounded-[20px] border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10">
                  Upload File
                  <input type="file" accept=".txt,.log" className="hidden" onChange={(event) => void handleFileChange(event)} />
                </label>
              </div>
              {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
            </div>

            <div className="space-y-3 rounded-[24px] border border-white/8 bg-black/20 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Latest Imports</p>
              {snapshot?.importHistory.length ? snapshot.importHistory.map((item) => (
                <div key={item.importId} className="rounded-[20px] border border-white/8 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.createdAt))}</p>
                    <span className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.parsedHands}/{item.totalHands} hands parsed, {item.unsupportedHands} unsupported.</p>
                  {item.notes[0] ? <p className="mt-2 text-xs leading-5 text-slate-500">{item.notes[0]}</p> : null}
                </div>
              )) : <p className="text-sm leading-6 text-slate-400">No imported hands yet. The first import will populate this history.</p>}
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Imported Hands</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Selective entry points for review, not a raw parser dump.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {loading ? <p className="text-sm text-slate-500">Loading imported hands.</p> : snapshot?.hands.length ? snapshot.hands.map((hand) => (
                <button
                  key={hand.importedHandId}
                  type="button"
                  onClick={() => setSelectedHandId(hand.importedHandId)}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${selectedHandId === hand.importedHandId ? "border-emerald-400/35 bg-emerald-500/10" : "border-white/8 bg-black/20 hover:border-white/16 hover:bg-white/5"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{hand.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{hand.subtitle}</p>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{hand.playedAtLabel}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {hand.themeTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{tag}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{hand.whyReview}</p>
                </button>
              )) : <p className="text-sm leading-6 text-slate-400">No real hands are ready for review yet.</p>}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Coach-Led Review</p>
            {loading ? <p className="mt-4 text-sm text-slate-500">Preparing the selected hand.</p> : snapshot?.selectedHand ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-2xl font-semibold tracking-tight text-white">{snapshot.selectedHand.title}</p>
                    {snapshot.selectedHand.meta.map((item) => (
                      <span key={item} className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{item}</span>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailTile label="Board" value={snapshot.selectedHand.board} />
                    <DetailTile label="Hero" value={snapshot.selectedHand.hero} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{snapshot.selectedHand.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {snapshot.selectedHand.conceptTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Review Spots</p>
                    {snapshot.selectedHand.reviewSpots.length ? snapshot.selectedHand.reviewSpots.map((spot) => (
                      <div key={spot.spotId} className="rounded-[22px] border border-white/8 bg-white/5 p-4">
                        <p className="text-base font-semibold text-white">{spot.summary}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{spot.reason}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {spot.concepts.map((concept) => (
                            <span key={concept} className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{concept}</span>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          {spot.evidence.map((line) => (
                            <div key={line} className="rounded-[16px] border border-white/8 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-400">{line}</div>
                          ))}
                        </div>
                      </div>
                    )) : <p className="text-sm leading-6 text-slate-400">No selective review spots were extracted from this hand yet.</p>}
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Training Follow-Ups</p>
                    {snapshot.selectedHand.recommendations.length ? snapshot.selectedHand.recommendations.map((item) => (
                      <div key={item.label} className="rounded-[22px] border border-emerald-500/14 bg-emerald-500/8 p-4">
                        <p className="text-base font-semibold text-white">{item.label}</p>
                        <p className="mt-2 text-sm leading-6 text-emerald-50">{item.detail}</p>
                        {item.drillTitles.length ? <div className="mt-3 flex flex-wrap gap-2">{item.drillTitles.map((title) => <span key={title} className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{title}</span>)}</div> : null}
                      </div>
                    )) : <p className="text-sm leading-6 text-slate-400">Once a hand maps cleanly into concepts, related training blocks will appear here.</p>}

                    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Priority Themes</p>
                      <div className="mt-3 space-y-3">
                        {snapshot.priorityThemes.length ? snapshot.priorityThemes.map((theme) => (
                          <div key={theme.label}>
                            <p className="text-sm font-semibold text-white">{theme.label}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-400">{theme.detail}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-amber-200">{theme.urgency}</p>
                          </div>
                        )) : <p className="text-sm leading-6 text-slate-400">Real-play themes will appear here once the first import lands.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : <p className="mt-4 text-sm leading-6 text-slate-400">Import a hand to open the first real-play review surface.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

