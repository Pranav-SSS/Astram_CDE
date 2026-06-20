/**
 * ============================================================================
 * ASTRAM — TAB 2: DEPLOYMENT PLANNER
 * ============================================================================
 * Prescriptive view. Commanders set unit allocations for the selected shift.
 * This is the "make the decision" tab — designed for a 5-minute pre-shift brief.
 *
 * Every row shows:
 *   [Location · Resource] [Slider] [Allocated] | Prescribed: X | Gap: ±Z
 *
 * Gaps highlighted: amber for shortfall >2 units, red for shortfall >5 units.
 * Reference: Section 9, "Tab 2 — Deployment Planner"
 *            Section 9, "Missing 1–5" (the five fixes implemented here)
 * ============================================================================
 */

import { useMemo } from "react";
import {
  SHIFT_WINDOWS, RESOURCE_TYPES, TOTAL_FLEET,
  PRESCRIPTION_LOCATIONS, RESOURCE_TYPE_ORDER, PRESCRIPTION_LOCATION_ORDER
} from "../data/lockedDataModel.js";

import {
  formatGap
} from "../logic/engineLogic.js";


// Resource type → accent colour
const RESOURCE_COLOUR = {
  INTERCEPTORS: { text: "text-blue-400",   bg: "bg-blue-900/40",   border: "border-blue-700",   track: "bg-blue-500"   },
  WARDENS:      { text: "text-green-400",  bg: "bg-green-900/40",  border: "border-green-700",  track: "bg-green-500"  },
  BARRICADES:   { text: "text-purple-400", bg: "bg-purple-900/40", border: "border-purple-700", track: "bg-purple-500" },
};

// Gap severity → highlight class
const GAP_CLASS = {
  ok:    "text-gray-500",
  amber: "text-amber-400",
  red:   "text-red-400 font-bold",
};


export default function DeploymentPlannerTab({
  activeWindowId,
  prescriptionMatrix,
  allocationMatrix,
  comparisonMatrix,
  readinessResult,
  fleetRemaining,
  totalAllocated,
  alertStyle,
  feedbackTrigger,
  onAllocationChange,
  onFinalise,
  finalisedLog,
}) {
  const windowData = SHIFT_WINDOWS[activeWindowId];

  // Total prescribed (for the header reference)
  const totalPrescribed = useMemo(() =>
    PRESCRIPTION_LOCATION_ORDER.reduce((sum, loc) =>
      sum + RESOURCE_TYPE_ORDER.reduce((s, rt) =>
        s + (prescriptionMatrix[loc]?.[rt] ?? 0), 0
      ), 0
    ), [prescriptionMatrix]
  );

  return (
    <div className="space-y-5">

      {/* ── SHIFT CONTEXT REMINDER ── */}
      <ShiftReminder windowData={windowData} activeWindowId={activeWindowId} />

      {/* ── FLEET SUMMARY BAR ── */}
      <FleetSummaryBar
        totalPrescribed={totalPrescribed}
        totalAllocated={totalAllocated}
        fleetRemaining={fleetRemaining}
        feedbackTrigger={feedbackTrigger}
      />

      {/* ── ALLOCATION ROWS ── */}
      {PRESCRIPTION_LOCATION_ORDER.map(locationId => (
        <LocationCard
          key={locationId}
          locationId={locationId}
          prescriptionMatrix={prescriptionMatrix}
          allocationMatrix={allocationMatrix}
          comparisonMatrix={comparisonMatrix}
          onAllocationChange={onAllocationChange}
        />
      ))}

      {/* ── RESERVE POOL ── */}
      <ReservePool
        fleetRemaining={fleetRemaining}
        totalAllocated={totalAllocated}
      />

      {/* ── FINALISE BUTTON ── */}
      <FinaliseSection
        feedbackTrigger={feedbackTrigger}
        readinessResult={readinessResult}
        alertStyle={alertStyle}
        finalisedLog={finalisedLog}
        onFinalise={onFinalise}
      />
    </div>
  );
}


// ============================================================================
// SHIFT CONTEXT REMINDER
// ============================================================================

function ShiftReminder({ windowData, activeWindowId }) {
  if (!windowData) return null;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="border border-blue-700 bg-blue-900/20 rounded px-3 py-1.5">
        <span className="text-blue-300 font-bold">{windowData.label}</span>
        <span className="text-gray-500 ml-2">{windowData.hours}</span>
        <span className="text-gray-600 ml-2">·</span>
        <span className="text-gray-400 ml-2">~{windowData.avgEventsPerDay} events/day avg</span>
        <span className="text-gray-600 ml-2">·</span>
        <span className="text-gray-400 ml-2">risk weight {windowData.riskWeight}</span>
      </div>
      {windowData.isDead && (
        <div className="border border-gray-700 bg-gray-900 rounded px-3 py-1.5 text-gray-600">
          DEAD ZONE — Reallocate units freed here to Dawn or Night peaks
        </div>
      )}
    </div>
  );
}


// ============================================================================
// FLEET SUMMARY BAR
// ============================================================================

function FleetSummaryBar({ totalPrescribed, totalAllocated, fleetRemaining, feedbackTrigger }) {
  const allocatedPct = Math.min((totalAllocated / TOTAL_FLEET) * 100, 100);
  const prescribedPct = Math.min((totalPrescribed / TOTAL_FLEET) * 100, 100);

  return (
    <div className="border border-gray-800 rounded p-4 bg-gray-900">
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="text-gray-500 uppercase tracking-wider">Fleet Allocation</span>
        <div className="flex items-center gap-4 text-gray-400">
          <span>Prescribed: <span className="text-gray-200 tabular-nums">{totalPrescribed}</span></span>
          <span>Allocated: <span className="text-gray-200 tabular-nums">{totalAllocated}</span></span>
          <span>Reserve: <span className={`tabular-nums font-medium ${fleetRemaining < 5 ? "text-amber-400" : "text-gray-200"}`}>{fleetRemaining}</span></span>
          <span className="text-gray-600">/ {TOTAL_FLEET} total</span>
        </div>
      </div>

      {/* Stacked bar: prescribed (ghost) + allocated (solid) */}
      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
        {/* Prescribed marker */}
        <div
          className="absolute top-0 left-0 h-full bg-gray-600 rounded-full"
          style={{ width: `${prescribedPct}%` }}
        />
        {/* Actual allocated */}
        <div
          className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-200"
          style={{ width: `${allocatedPct}%` }}
        />
      </div>

      {feedbackTrigger.shouldTrigger && (
        <p className="text-xs text-amber-400 mt-2">
          ⚠ Deviation log will be required when you finalise this plan.
        </p>
      )}
    </div>
  );
}


// ============================================================================
// LOCATION CARD
// One card per static outpost location.
// ============================================================================

function LocationCard({
  locationId,
  prescriptionMatrix,
  allocationMatrix,
  comparisonMatrix,
  onAllocationChange,
}) {
  const location = PRESCRIPTION_LOCATIONS[locationId];
  const totals   = comparisonMatrix[locationId]?._totals;
  if (!location) return null;

  const totalShortfall = totals ? Math.max(0, -(totals.gap)) : 0;
  const hasShortfall   = totalShortfall > 0;

  return (
    <div className={`border rounded-lg overflow-hidden ${
      totals?.severity === "red"   ? "border-red-700" :
      totals?.severity === "amber" ? "border-amber-700" : "border-gray-800"
    }`}>
      {/* Card header */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${
        totals?.severity === "red"   ? "bg-red-950/40" :
        totals?.severity === "amber" ? "bg-amber-950/30" : "bg-gray-900"
      }`}>
        <div>
          <span className="text-sm font-bold text-gray-200">{location.label}</span>
          <span className="ml-2 text-xs text-gray-500">
            Tier {PRESCRIPTION_LOCATIONS[locationId]?.tier ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">
            Total prescribed: <span className="text-gray-300 tabular-nums">{totals?.prescribed ?? 0}</span>
          </span>
          <span className="text-gray-500">
            Allocated: <span className="text-gray-200 tabular-nums font-medium">{totals?.allocated ?? 0}</span>
          </span>
          {hasShortfall && (
            <span className="text-red-400 font-bold">
              Gap: -{totalShortfall}
            </span>
          )}
        </div>
      </div>

      {/* Resource rows */}
      <div className="divide-y divide-gray-900 bg-gray-950">
        {RESOURCE_TYPE_ORDER.map(resourceType => (
          <AllocationRow
            key={resourceType}
            locationId={locationId}
            resourceType={resourceType}
            prescriptionMatrix={prescriptionMatrix}
            allocationMatrix={allocationMatrix}
            comparisonMatrix={comparisonMatrix}
            onAllocationChange={onAllocationChange}
          />
        ))}
      </div>
    </div>
  );
}


// ============================================================================
// ALLOCATION ROW
// The core unit. Shows: [Label] [Slider] [Value] | Prescribed: X | Gap: ±Z
// Reference: Section 9, "Missing 2: No Demand Signal" — fix implementation
// ============================================================================

function AllocationRow({
  locationId,
  resourceType,
  prescriptionMatrix,
  allocationMatrix,
  comparisonMatrix,
  onAllocationChange,
}) {
  const prescribed = prescriptionMatrix[locationId]?.[resourceType] ?? 0;
  const allocated  = allocationMatrix[locationId]?.[resourceType]  ?? 0;
  const cell       = comparisonMatrix[locationId]?.[resourceType];
  const gap        = cell?.gap ?? 0;
  const severity   = cell?.severity ?? "ok";

  const colour = RESOURCE_COLOUR[resourceType] ?? RESOURCE_COLOUR.INTERCEPTORS;
  const maxSlider = Math.max(prescribed * 2, 15); // slider ceiling

  return (
    <div className="px-4 py-3 flex items-center gap-4">
      {/* Resource type label */}
      <div className={`w-28 flex-shrink-0 text-xs font-medium ${colour.text}`}>
        {RESOURCE_TYPES[resourceType]?.shortLabel ?? resourceType}
      </div>

      {/* Slider */}
      <div className="flex-1 relative">
        {/* Prescription marker line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-500 opacity-50 pointer-events-none"
          style={{ left: `${Math.min((prescribed / maxSlider) * 100, 100)}%` }}
          title={`Prescribed: ${prescribed}`}
        />
        <input
          type="range"
          min={0}
          max={maxSlider}
          step={1}
          value={allocated}
          onChange={e => onAllocationChange(locationId, resourceType, Number(e.target.value))}
          className="w-full h-2 appearance-none rounded-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--slider-fill, #3b82f6) 0%, var(--slider-fill, #3b82f6) ${(allocated / maxSlider) * 100}%, #374151 ${(allocated / maxSlider) * 100}%, #374151 100%)`,
          }}
        />
      </div>

      {/* Allocated value (large, tabular) */}
      <div className={`w-8 text-center tabular-nums font-bold text-sm ${colour.text}`}>
        {allocated}
      </div>

      {/* Prescribed reference */}
      <div className="w-28 text-right text-xs text-gray-600">
        Prescribed:{" "}
        <span className="text-gray-400 tabular-nums">{prescribed}</span>
      </div>

      {/* Gap indicator */}
      <div className={`w-16 text-right text-xs tabular-nums ${GAP_CLASS[severity]}`}>
        Gap: {formatGap(gap)}
        {cell?.exceedsDeviationThreshold && (
          <span className="ml-1 text-amber-500" title="Deviation >20% — log required">!</span>
        )}
      </div>
    </div>
  );
}


// ============================================================================
// RESERVE POOL
// Shows unallocated units available for mobile/rapid response.
// ============================================================================

function ReservePool({ fleetRemaining, totalAllocated }) {
  const isLow = fleetRemaining < 5;
  return (
    <div className={`border rounded p-3 text-xs flex items-center justify-between ${
      isLow ? "border-amber-800 bg-amber-950/20" : "border-gray-800 bg-gray-900"
    }`}>
      <div>
        <span className={`font-bold ${isLow ? "text-amber-300" : "text-gray-300"}`}>
          Mobile Reserve Pool
        </span>
        <span className="text-gray-500 ml-2">
          — units not assigned to static outposts; available for rapid response
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-500">
          Allocated to outposts: <span className="text-gray-300 tabular-nums">{totalAllocated}</span>
        </span>
        <span className={`font-bold tabular-nums text-sm ${isLow ? "text-amber-400" : "text-gray-200"}`}>
          {fleetRemaining} in reserve
        </span>
        {isLow && (
          <span className="text-amber-400">⚠ Low reserve</span>
        )}
      </div>
    </div>
  );
}


// ============================================================================
// FINALISE SECTION
// The button that either saves cleanly or triggers the Feedback Logger.
// Reference: Section 9, "Finalise Shift Plan button"
// ============================================================================

function FinaliseSection({ feedbackTrigger, readinessResult, alertStyle, finalisedLog, onFinalise }) {
  const isDeviation = feedbackTrigger.shouldTrigger;
  const { alertStatus, score } = readinessResult;

  return (
    <div className="border-t border-gray-800 pt-5 space-y-3">
      {/* Current readiness summary before finalising */}
      <div className={`border ${alertStyle.border} ${alertStyle.bg} rounded p-3 text-sm flex items-center justify-between`}>
        <span className={`font-bold ${alertStyle.text}`}>
          {alertStatus === "OPTIMAL"      ? "✓ Deployment looks good for this window." :
           alertStatus === "ADVISORY"     ? "→ Minor gaps — review before finalising." :
           alertStatus === "WARNING"      ? "⚠ Significant shortfalls — consider adjusting." :
                                           "⛔ Critical gap — do not finalise without resolution."}
        </span>
        <span className={`tabular-nums font-bold text-lg ${alertStyle.text}`}>{score}%</span>
      </div>

      {isDeviation && (
        <div className="bg-amber-950/30 border border-amber-700 rounded p-3 text-xs text-amber-300">
          ⚠ {feedbackTrigger.triggerReasons.length} deviation
          {feedbackTrigger.triggerReasons.length !== 1 ? "s" : ""} detected.
          You will be required to document your reasoning before this plan is saved.
          This creates institutional memory and training data for future ML models.
        </div>
      )}

      <button
        onClick={onFinalise}
        className={[
          "w-full py-3 rounded text-sm font-bold tracking-wide transition-colors",
          isDeviation
            ? "bg-amber-800 hover:bg-amber-700 border border-amber-600 text-amber-100"
            : "bg-blue-700 hover:bg-blue-600 border border-blue-500 text-white",
        ].join(" ")}
      >
        {isDeviation
          ? "Finalise Shift Plan → Deviation Log Required"
          : "✓ Finalise Shift Plan"}
      </button>

      {finalisedLog && (
        <div className="bg-green-950/30 border border-green-800 rounded p-3 text-xs text-green-300">
          ✓ Last plan finalised at {finalisedLog.savedAt?.slice(11, 19)} —
          Log ID: <span className="font-mono">{finalisedLog.logId ?? "pending"}</span>
        </div>
      )}
    </div>
  );
}
