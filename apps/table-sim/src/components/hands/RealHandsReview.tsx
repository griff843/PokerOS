"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealHandsSnapshot } from "@/lib/real-hands";
import { useSession } from "@/lib/session-context";
import { loadRealHandFollowUpSessionPlan } from "@/lib/session-plan";

const initialManualForm = {
  tableName: "",
  stakes: "",
  playedAt: "",
  heroName: "",
  heroPosition: "BB",
  villainPosition: "BTN",
  heroCards: "",
  memoryConfidence: "medium",
  flop: "",
  turn: "",
  river: "",
  effectiveStackBb: "100",
  turnSummary: "",
  turnLineCategory: "unclear",
  turnSizeBucket: "unknown",
  riverSummary: "",
  riverFacingAction: "bet",
  riverSizePctPot: "75",
  riverSizeBucket: "medium",
  note: "",
};

const MEMORY_CONFIDENCE_OPTIONS = [
  { value: "high", label: "High confidence" },
  { value: "medium", label: "Medium confidence" },
  { value: "low", label: "Low confidence" },
];

const TURN_LINE_OPTIONS = [
  { value: "unclear", label: "Unclear / mixed memory" },
  { value: "check_through", label: "Turn checked through" },
  { value: "faced_bet_call", label: "Faced turn bet and called" },
  { value: "faced_bet_fold", label: "Faced turn bet and folded" },
  { value: "hero_probe_called", label: "Hero probed and got called" },
  { value: "hero_probe_raised", label: "Hero probed and got raised" },
  { value: "hero_bet_called", label: "Hero bet and got called" },
  { value: "hero_bet_raised", label: "Hero bet and got raised" },
];

const SIZE_BUCKET_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "polar", label: "Polar / overbet" },
];

const RIVER_ACTION_OPTIONS = [
  { value: "bet", label: "Faced bet" },
  { value: "raise", label: "Faced raise" },
  { value: "check", label: "Checked to hero" },
];

export function RealHandsReview() {
  const router = useRouter();
  const { startSession } = useSession();
  const [snapshot, setSnapshot] = useState<RealHandsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [startingConceptKey, setStartingConceptKey] = useState<string | null>(null);
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [manualForm, setManualForm] = useState(initialManualForm);
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

  async function submitManualHand() {
    setSavingManual(true);
    setError(null);
    try {
      const response = await fetch("/api/real-hands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          manual: {
            tableName: manualForm.tableName || undefined,
            stakes: manualForm.stakes || undefined,
            playedAt: manualForm.playedAt ? new Date(manualForm.playedAt).toISOString() : undefined,
            heroName: manualForm.heroName || undefined,
            heroPosition: manualForm.heroPosition,
            villainPosition: manualForm.villainPosition || undefined,
            heroCards: normalizeHoleCards(manualForm.heroCards),
            memoryConfidence: manualForm.memoryConfidence,
            flop: normalizeBoardCards(manualForm.flop, 3),
            turn: normalizeSingleCard(manualForm.turn),
            river: normalizeSingleCard(manualForm.river),
            effectiveStackBb: manualForm.effectiveStackBb ? Number(manualForm.effectiveStackBb) : undefined,
            turnSummary: manualForm.turnSummary || undefined,
            turnLineCategory: manualForm.turnLineCategory,
            turnSizeBucket: manualForm.turnSizeBucket,
            riverSummary: manualForm.riverSummary || undefined,
            riverFacingAction: manualForm.riverFacingAction,
            riverSizePctPot: manualForm.riverSizePctPot ? Number(manualForm.riverSizePctPot) : undefined,
            riverSizeBucket: manualForm.riverSizeBucket,
            note: manualForm.note || undefined,
          },
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save live reconstruction");
      }
      setManualForm(initialManualForm);
      await loadSnapshot(null);
    } catch (saveError) {
      console.error("Failed to save live reconstruction:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Failed to save live reconstruction");
    } finally {
      setSavingManual(false);
    }
  }

  async function handleStartFollowUp(item: NonNullable<RealHandsSnapshot["selectedHand"]>["recommendations"][number]) {
    const handTitle = snapshot?.selectedHand?.title ?? null;
    setStartingConceptKey(item.conceptKey);
    setError(null);
    try {
      const plan = await loadRealHandFollowUpSessionPlan({
        conceptKey: item.conceptKey,
        activePool: item.recommendedPool,
        preferredDrillIds: item.preferredDrillIds,
        handTitle,
        handSource: snapshot?.selectedHand?.followUpContext.handSource,
        parseStatus: snapshot?.selectedHand?.followUpContext.parseStatus,
        uncertaintyProfile: snapshot?.selectedHand?.followUpContext.uncertaintyProfile,
        count: Math.max(item.preferredDrillIds.length, 6),
      });
      startSession({
        config: {
          drillCount: plan.metadata.selectedCount,
          timed: true,
          activePool: plan.metadata.activePool,
        },
        plan,
      });
      router.push("/app/play");
    } catch (startError) {
      console.error("Failed to start real-hand follow-up session:", startError);
      setError(startError instanceof Error ? startError.message : "Failed to start follow-up session");
      setStartingConceptKey(null);
    }
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
          <div className="mt-5 rounded-[24px] border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Quick Live Reconstruction</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              For live hands you remember approximately. Capture the decision family honestly without pretending you know every size exactly.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InputField label="Table / Session" value={manualForm.tableName} onChange={(value) => setManualForm((current) => ({ ...current, tableName: value }))} placeholder="2/5 main game" />
              <InputField label="Stakes" value={manualForm.stakes} onChange={(value) => setManualForm((current) => ({ ...current, stakes: value }))} placeholder="$2/$5" />
              <InputField label="Played At" type="datetime-local" value={manualForm.playedAt} onChange={(value) => setManualForm((current) => ({ ...current, playedAt: value }))} />
              <InputField label="Stack (bb)" value={manualForm.effectiveStackBb} onChange={(value) => setManualForm((current) => ({ ...current, effectiveStackBb: value }))} placeholder="100" />
              <InputField label="Hero Name" value={manualForm.heroName} onChange={(value) => setManualForm((current) => ({ ...current, heroName: value }))} placeholder="Hero" />
              <InputField label="Hero Position" value={manualForm.heroPosition} onChange={(value) => setManualForm((current) => ({ ...current, heroPosition: value.toUpperCase() }))} placeholder="BB" />
              <InputField label="Villain Position" value={manualForm.villainPosition} onChange={(value) => setManualForm((current) => ({ ...current, villainPosition: value.toUpperCase() }))} placeholder="BTN" />
              <InputField label="Hero Cards" value={manualForm.heroCards} onChange={(value) => setManualForm((current) => ({ ...current, heroCards: value }))} placeholder="Qd 9h" />
              <SelectField
                label="Memory Confidence"
                value={manualForm.memoryConfidence}
                onChange={(value) => setManualForm((current) => ({ ...current, memoryConfidence: value }))}
                options={MEMORY_CONFIDENCE_OPTIONS}
              />
              <InputField label="Flop" value={manualForm.flop} onChange={(value) => setManualForm((current) => ({ ...current, flop: value }))} placeholder="Qc 7s 3h" />
              <InputField label="Turn" value={manualForm.turn} onChange={(value) => setManualForm((current) => ({ ...current, turn: value }))} placeholder="2d" />
              <InputField label="River" value={manualForm.river} onChange={(value) => setManualForm((current) => ({ ...current, river: value }))} placeholder="5c" />
              <InputField label="River Size % Pot" value={manualForm.riverSizePctPot} onChange={(value) => setManualForm((current) => ({ ...current, riverSizePctPot: value }))} placeholder="75" />
            </div>
            <div className="mt-3 rounded-[20px] border border-amber-300/18 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
              Use exact cards if you know them. For the line itself, it is better to choose the right action family honestly than to fake precise sizing from memory.
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <TextAreaField label="Turn Memory" value={manualForm.turnSummary} onChange={(value) => setManualForm((current) => ({ ...current, turnSummary: value }))} placeholder="What you remember most clearly: check-through, bet-call, probe-call, turn raise, or who capped their range." />
              <TextAreaField label="River Memory" value={manualForm.riverSummary} onChange={(value) => setManualForm((current) => ({ ...current, riverSummary: value }))} placeholder="River felt like a big polar bet after a quiet turn." />
              <TextAreaField label="Why This Matters" value={manualForm.note} onChange={(value) => setManualForm((current) => ({ ...current, note: value }))} placeholder="I think I overfolded because villain looked strong." />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <SelectField
                label="Turn Line Family"
                value={manualForm.turnLineCategory}
                onChange={(value) => setManualForm((current) => ({ ...current, turnLineCategory: value }))}
                options={TURN_LINE_OPTIONS}
              />
              <SelectField
                label="Turn Size Bucket"
                value={manualForm.turnSizeBucket}
                onChange={(value) => setManualForm((current) => ({ ...current, turnSizeBucket: value }))}
                options={SIZE_BUCKET_OPTIONS}
              />
              <SelectField
                label="River Facing Action"
                value={manualForm.riverFacingAction}
                onChange={(value) => setManualForm((current) => ({ ...current, riverFacingAction: value }))}
                options={RIVER_ACTION_OPTIONS}
              />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <SelectField
                label="River Size Bucket"
                value={manualForm.riverSizeBucket}
                onChange={(value) => setManualForm((current) => ({ ...current, riverSizeBucket: value }))}
                options={SIZE_BUCKET_OPTIONS}
              />
              <div className="rounded-[20px] border border-white/8 bg-white/5 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reconstruction Tips</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-300">
                  <li>Anchor the turn line first. That is usually what decides the river threshold.</li>
                  <li>Use `polar` only when the live sizing clearly felt huge.</li>
                  <li>If the sizing is fuzzy but the line family is clear, keep going anyway.</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void submitManualHand()}
                disabled={savingManual}
                className="rounded-[20px] bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:bg-amber-500/60"
              >
                {savingManual ? "Saving Reconstruction" : "Save Live Reconstruction"}
              </button>
              <button
                type="button"
                onClick={() => setManualForm(initialManualForm)}
                className="rounded-[20px] border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
              >
                Reset Form
              </button>
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
                  {snapshot.selectedHand.reconstructionNote ? (
                    <div className="mt-4 rounded-[20px] border border-amber-300/18 bg-amber-300/10 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">{snapshot.selectedHand.reconstructionNote.label}</p>
                      <p className="mt-2 text-sm leading-6 text-amber-50/90">{snapshot.selectedHand.reconstructionNote.detail}</p>
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-[20px] border border-white/8 bg-white/5 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Assignment Profile</p>
                      <span className="rounded-full border border-white/8 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                        {snapshot.selectedHand.followUpContext.uncertaintyLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{snapshot.selectedHand.followUpContext.planningBias}</p>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-white">{item.label}</p>
                          {item.laneLabel ? (
                            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                              {item.laneLabel}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-emerald-50">{item.detail}</p>
                        {item.laneReason ? (
                          <p className="mt-2 text-xs leading-5 text-emerald-100/80">{item.laneReason}</p>
                        ) : null}
                        {item.drills.length ? (
                          <div className="mt-3 space-y-2">
                            {item.drills.map((drill) => (
                              <div key={`${item.label}:${drill.title}`} className="rounded-[18px] border border-white/8 bg-slate-950/70 px-3 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-white">{drill.title}</p>
                                  <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    {drill.nodeId}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-slate-300">{drill.whyPicked}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link
                            href={item.destination}
                            className="rounded-[18px] bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                          >
                            Open follow-up concept
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleStartFollowUp(item)}
                            disabled={startingConceptKey === item.conceptKey}
                            className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
                          >
                            {startingConceptKey === item.conceptKey ? "Starting Follow-Up Block" : "Train this leak now"}
                          </button>
                        </div>
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

function InputField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="rounded-[20px] border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="rounded-[20px] border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full bg-transparent text-sm font-semibold text-white outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950 text-white">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="rounded-[20px] border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-[110px] w-full bg-transparent text-sm leading-6 text-white outline-none placeholder:text-slate-500"
      />
    </label>
  );
}

function normalizeHoleCards(value: string) {
  const cards = value.trim().split(/\s+/).filter(Boolean);
  if (cards.length !== 2) {
    throw new Error("Hero cards must include exactly two cards, like 'Qd 9h'.");
  }
  return [normalizeSingleCard(cards[0]), normalizeSingleCard(cards[1])] as [string, string];
}

function normalizeBoardCards(value: string, expectedCount: number) {
  const cards = value.trim().split(/\s+/).filter(Boolean);
  if (cards.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} board cards, like 'Qc 7s 3h'.`);
  }
  return cards.map((card) => normalizeSingleCard(card)) as [string, string, string];
}

function normalizeSingleCard(value: string) {
  const normalized = value.trim();
  if (!/^[2-9TJQKA][shdc]$/i.test(normalized)) {
    throw new Error(`Invalid card '${value}'. Use formats like Qd, 9h, As.`);
  }
  return `${normalized[0].toUpperCase()}${normalized[1].toLowerCase()}`;
}

