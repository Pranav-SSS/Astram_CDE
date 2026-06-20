/**
 * ============================================================================
 * ASTRAM — TAB 1: SITUATION AWARENESS
 * ============================================================================
 * Diagnostic view. Commanders see WHERE and WHEN the city will be stressed.
 * No allocation decisions happen here — this is the "read the battlefield" tab.
 *
 * Contents:
 *   1. Demand heat map — Corridor × Shift Window, colour-coded by intensity
 *   2. Corridor risk tier summary cards
 *   3. Active event overlay — which events affect which windows
 *   4. Data quality warning banner (Phase 2 gate context)
 *
 * Reference: Section 9, "Tab 1 — SITUATION AWARENESS"
 *            Section 7, Layer 1 — "The Demand Surface"
 * ============================================================================
 */

import { useMemo } from "react";
import {
  CORRIDORS, SHIFT_WINDOWS, SHIFT_WINDOW_ORDER,
  EVENT_WINDOW_MAPPING, CORRIDOR_TIERS, DATA_QUALITY_BASELINE,
  NORTH_STAR,
} from "../data/lockedDataModel.js";
import {
  getDemandIntensityLevel,
  getActiveEventWindowConflicts,
  isHighRiskEvent,
} from "../logic/engineLogic.js";


// Intensity → Tailwind background class
const INTENSITY_CLASSES = {
  none:     "bg-gray-900 text-gray-700",
  low:      "bg-blue-950 text-blue-500",
  moderate: "bg-blue-900/70 text-blue-300",
  high:     "bg-orange-900/70 text-orange-300",
  critical: "bg-red-900/70 text-red-300",
};

const TIER_BORDER = {
  1: "border-red-600",
  2: "border-orange-600",
  3: "border-yellow-600",
  4: "border-green-700",
  5: "border-gray-700",
};


export default function SituationAwarenessTab({
  demandSurface,
  activeEvents,
  activeWindowId,
  weatherState,
  month,
  dayOfWeek,
  onSwitchToDeployment,
}) {
  const eventConflicts = useMemo(
    () => getActiveEventWindowConflicts(activeEvents),
    [activeEvents]
  );

  const corridorList = Object.values(CORRIDORS).sort((a, b) => a.tier - b.tier);

  return (
    <div className="space-y-6">

      {/* ── DATA QUALITY WARNING ── */}
      <DataQualityWarning />

      {/* ── DEMAND HEAT MAP ── */}
      <section>
        <SectionHeader
          title="Demand Surface"
          subtitle="Expected incidents per corridor per shift window — all active modifiers applied"
        />
        <DemandHeatMap
          demandSurface={demandSurface}
          corridorList={corridorList}
          activeWindowId={activeWindowId}
          eventConflicts={eventConflicts}
        />
      </section>

      {/* ── ACTIVE EVENT OVERLAYS ── */}
      {activeEvents.length > 0 && (
        <section>
          <SectionHeader
            title="Active Event Overlays"
            subtitle="Which events affect which windows — calibrated to actual timing data"
          />
          <EventOverlays
            activeEvents={activeEvents}
            eventConflicts={eventConflicts}
          />
        </section>
      )}

      {/* ── CORRIDOR RISK TIERS ── */}
      <section>
        <SectionHeader
          title="Corridor Risk Tiers"
          subtitle="Derived from 8,173 records. Tier 1 static outpost mandate is ironclad."
        />
        <CorridorTierGrid corridorList={corridorList} />
      </section>

      {/* ── SWITCH TO PLANNER CTA ── */}
      <div className="border-t border-gray-800 pt-4">
        <button
          onClick={onSwitchToDeployment}
          className="bg-blue-800 hover:bg-blue-700 border border-blue-600 text-blue-100 px-5 py-2.5 rounded text-sm font-medium transition-colors"
        >
          → Open Deployment Planner
        </button>
        <span className="ml-3 text-xs text-gray-500">
          Allocate resources for the selected shift window
        </span>
      </div>
    </div>
  );
}


// ============================================================================
// DEMAND HEAT MAP
// Corridor (rows) × Shift Window (columns), colour-coded by intensity.
// The active window column is highlighted.
// ============================================================================

function DemandHeatMap({ demandSurface, corridorList, activeWindowId, eventConflicts }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        {/* Column headers */}
        <thead>
          <tr>
            <th className="text-left text-gray-500 uppercase tracking-wider px-3 py-2 w-36">
              Corridor
            </th>
            {SHIFT_WINDOW_ORDER.map(windowId => {
              const w = SHIFT_WINDOWS[windowId];
              const isActive    = windowId === activeWindowId;
              const hasEvents   = (eventConflicts[windowId]?.length ?? 0) > 0;
              const hasHighRisk = (eventConflicts[windowId] ?? []).some(isHighRiskEvent);
              return (
                <th
                  key={windowId}
                  className={[
                    "text-center px-2 py-2 border-b",
                    isActive   ? "border-blue-500 text-blue-300" : "border-gray-800 text-gray-500",
                  ].join(" ")}
                >
                  <div className="font-medium">{w.shortLabel}</div>
                  <div className="text-gray-600 font-normal">{w.hours}</div>
                  {hasEvents && (
                    <div className={`text-xs mt-0.5 ${hasHighRisk ? "text-red-400" : "text-purple-400"}`}>
                      {hasHighRisk ? "⚠ event" : "◇ event"}
                    </div>
                  )}
                  {w.isDead && (
                    <div className="text-xs text-gray-700 mt-0.5">dead zone</div>
                  )}
                </th>
              );
            })}
            <th className="text-right text-gray-500 uppercase tracking-wider px-3 py-2">
              Tier
            </th>
          </tr>
        </thead>

        {/* Corridor rows */}
        <tbody>
          {corridorList.map(corridor => (
            <tr key={corridor.id} className="border-b border-gray-900 hover:bg-gray-900/40">
              {/* Corridor name */}
              <td className="px-3 py-2">
                <div className={`text-xs font-medium ${
                  corridor.tier === 1 ? "text-red-300" :
                  corridor.tier === 2 ? "text-orange-300" :
                  corridor.tier === 3 ? "text-yellow-300" : "text-gray-400"
                }`}>
                  {corridor.name}
                </div>
                <div className="text-gray-600 text-xs">{corridor.totalEvents} events</div>
              </td>

              {/* Demand cells */}
              {SHIFT_WINDOW_ORDER.map(windowId => {
                const demand   = demandSurface[corridor.id]?.[windowId] ?? 0;
                const level    = getDemandIntensityLevel(demand);
                const isActive = windowId === activeWindowId;
                return (
                  <td key={windowId} className={`px-2 py-1.5 text-center ${
                    isActive ? "ring-1 ring-inset ring-blue-700" : ""
                  }`}>
                    <div className={`rounded px-1.5 py-1 tabular-nums font-medium ${INTENSITY_CLASSES[level]}`}>
                      {demand > 0 ? demand.toFixed(1) : "—"}
                    </div>
                  </td>
                );
              })}

              {/* Tier badge */}
              <td className="px-3 py-2 text-right">
                <span className={`border rounded px-1.5 py-0.5 text-xs ${TIER_BORDER[corridor.tier]}`}>
                  T{corridor.tier}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="uppercase tracking-wider">Intensity:</span>
        {Object.entries(INTENSITY_CLASSES).map(([level, cls]) => (
          <span key={level} className={`px-2 py-0.5 rounded ${cls}`}>{level}</span>
        ))}
      </div>
    </div>
  );
}


// ============================================================================
// EVENT OVERLAYS
// ============================================================================

function EventOverlays({ activeEvents, eventConflicts }) {
  return (
    <div className="space-y-2">
      {activeEvents.map(eventId => {
        const mapping   = EVENT_WINDOW_MAPPING[eventId];
        if (!mapping) return null;
        const highRisk  = mapping.isHighRisk;
        return (
          <div
            key={eventId}
            className={`border rounded p-3 ${
              highRisk
                ? "bg-red-950/40 border-red-700"
                : "bg-purple-950/40 border-purple-700"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className={`font-bold text-sm ${highRisk ? "text-red-300" : "text-purple-300"}`}>
                  {eventId.replace(/_/g, " ")}
                  {highRisk && <span className="ml-2 text-xs text-red-400">⚠ High Risk</span>}
                </span>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>
                    Affects:{" "}
                    <span className="text-gray-200">
                      {mapping.affectedWindows.map(w => SHIFT_WINDOWS[w]?.shortLabel).join(", ")}
                    </span>
                  </span>
                  <span>
                    Closure prob:{" "}
                    <span className={`font-medium ${highRisk ? "text-red-300" : "text-gray-200"}`}>
                      {Math.round(mapping.closureProbability * 100)}%
                    </span>
                  </span>
                  <span>
                    Demand uplift:{" "}
                    <span className="text-gray-200 font-medium">
                      +{Math.round(mapping.demandMultiplier * 100)}%
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {activeEvents.length === 0 && (
        <p className="text-gray-600 text-sm italic">No planned events active for this shift.</p>
      )}
    </div>
  );
}


// ============================================================================
// CORRIDOR TIER GRID
// ============================================================================

function CorridorTierGrid({ corridorList }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {corridorList.map(corridor => (
        <div
          key={corridor.id}
          className={`border rounded p-3 bg-gray-900 ${TIER_BORDER[corridor.tier]}`}
        >
          <div className={`text-sm font-bold ${
            corridor.tier === 1 ? "text-red-300" :
            corridor.tier === 2 ? "text-orange-300" :
            corridor.tier === 3 ? "text-yellow-300" : "text-gray-300"
          }`}>
            {corridor.name}
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-gray-500">
            <div>
              <span className="text-gray-400">{corridor.totalEvents}</span> events ·{" "}
              <span className="text-gray-400">{corridor.roadClosures}</span> closures
            </div>
            <div>
              Closure rate:{" "}
              <span className={corridor.closureRate > 0.08 ? "text-orange-400" : "text-gray-400"}>
                {Math.round(corridor.closureRate * 100)}%
              </span>
            </div>
            <div>
              Demand mult:{" "}
              <span className="text-gray-400">{corridor.demandMultiplier}×</span>
            </div>
            {corridor.stagingJunction && (
              <div className="text-gray-600 mt-1 pt-1 border-t border-gray-800">
                Stage at: <span className="text-gray-500">{corridor.stagingJunction}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


// ============================================================================
// DATA QUALITY WARNING
// Phase 2 gate context — reminds commanders that junction data is 30.7% filled.
// Reference: Section 4, "Field Completeness Audit"
// ============================================================================

function DataQualityWarning() {
  return (
    <div className="bg-amber-950/30 border border-amber-800 rounded p-3 text-xs">
      <div className="flex items-start gap-2">
        <span className="text-amber-400 mt-0.5">⚠</span>
        <div className="text-amber-200/70">
          <span className="font-bold text-amber-300">Phase 2 Data Quality Gate: </span>
          Junction field is {Math.round(DATA_QUALITY_BASELINE.junction.rate * 100)}% complete
          (target: ≥85%). Corridor-level hotspot rankings are directionally correct
          but may shift with clean data. Reason Breakdown field is{" "}
          {Math.round(DATA_QUALITY_BASELINE.reasonBreakdown.rate * 100)}% complete
          (target: ≥80%). Root-cause analysis is not yet reliable.
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// SHARED LAYOUT HELPERS
// ============================================================================

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
