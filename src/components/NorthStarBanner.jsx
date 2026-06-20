/**
 * ============================================================================
 * ASTRAM — NORTH STAR BANNER
 * ============================================================================
 * Always visible. Never hidden. This is the single number the entire
 * Phase 1–4 journey is measured by.
 *
 * Planned Event Coverage Rate:
 *   "% of known planned events where resources were pre-positioned
 *    before the event started."
 *
 * Current baseline: ~0%
 * Phase 3 gate:      60%
 * 12-month target:   80%
 *
 * Reference: Section 12, "The North Star Metric"
 * ============================================================================
 */

import { NORTH_STAR, PHASE_GATES } from "../data/lockedDataModel.js";

export default function NorthStarBanner() {
  // In production this is fetched from the backend (actual covered/total counts).
  // For the MVP, we display the baseline and targets statically so commanders
  // always see the goal, even before live data is wired in.
  const currentRate    = NORTH_STAR.currentBaseline; // 0.00 at launch
  const phase3Target   = NORTH_STAR.phase3Gate;       // 0.60
  const annualTarget   = NORTH_STAR.target12Month;    // 0.80

  const currentPct  = Math.round(currentRate  * 100);
  const phase3Pct   = Math.round(phase3Target * 100);
  const annualPct   = Math.round(annualTarget * 100);

  // Phase gate met?
  const phase3Met  = currentRate >= phase3Target;
  const annualMet  = currentRate >= annualTarget;

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-2">
      <div className="flex items-center gap-6 flex-wrap">

        {/* Label */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 uppercase tracking-widest">North Star ↗</span>
          <span className="text-xs text-gray-400 font-medium">Planned Event Coverage Rate</span>
        </div>

        {/* Progress bar + number */}
        <div className="flex items-center gap-3 flex-1 min-w-48">
          <div className="relative flex-1 h-1.5 bg-gray-800 rounded-full max-w-48">
            {/* Phase 3 gate marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-amber-600"
              style={{ left: `${phase3Pct}%` }}
              title={`Phase 3 gate: ${phase3Pct}%`}
            />
            {/* Annual target marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-green-600"
              style={{ left: `${annualPct}%` }}
              title={`12-month target: ${annualPct}%`}
            />
            {/* Current fill */}
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(currentPct, 100)}%` }}
            />
          </div>

          <span className="text-sm font-bold tabular-nums text-blue-400">
            {currentPct}%
          </span>
        </div>

        {/* Gate indicators */}
        <div className="flex items-center gap-4 text-xs">
          <GateIndicator
            label="Phase 3 Gate"
            target={`${phase3Pct}%`}
            met={phase3Met}
            deadline="Day 90"
          />
          <GateIndicator
            label="12-Month Target"
            target={`${annualPct}%`}
            met={annualMet}
            deadline="Month 12"
          />
        </div>

        {/* Context tooltip */}
        <span
          className="text-xs text-gray-700 hidden lg:block cursor-default"
          title={NORTH_STAR.definition}
        >
          ⓘ Definition
        </span>
      </div>
    </div>
  );
}

function GateIndicator({ label, target, met, deadline }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${met ? "bg-green-500" : "bg-gray-700"}`} />
      <span className={met ? "text-green-400" : "text-gray-500"}>
        {label}: {target}
        <span className="text-gray-600 ml-1">({deadline})</span>
      </span>
    </div>
  );
}
