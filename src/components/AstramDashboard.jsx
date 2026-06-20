/**
 * ============================================================================
 * ASTRAM COMMAND DECISION ENGINE
 * MAIN DASHBOARD — AstramDashboard.jsx
 * ============================================================================
 *
 * Top-level component. Owns all shared state and orchestrates the two-tab
 * architecture defined in Section 9 of the spec:
 *
 *   Tab 1 — Situation Awareness (diagnostic)
 *   Tab 2 — Deployment Planner  (prescriptive)
 *
 * State that lives here (shared across both tabs):
 *   - activeWindowId    : which shift is being planned
 *   - weatherState      : DRY | LIGHT_RAIN | HEAVY_MONSOON
 *   - activeEvents      : string[] of EVENT_WINDOW_MAPPING keys
 *   - allocationMatrix  : commander's slider values
 *   - shiftDate / month / dayOfWeek
 *
 * Derived state (computed, never stored):
 *   - prescriptionMatrix  : computeAllPrescriptions()
 *   - comparisonMatrix    : computeAllocationMatrix()
 *   - readinessResult     : computeReadinessScore()
 *   - demandSurface       : computeFullDemandSurface()
 *
 * Reference: Section 9, "Recommended UI Architecture: The Tabbed Dashboard"
 * ============================================================================
 */

import { useState, useMemo, useCallback } from "react";

// Data model — locked constants
import {
  SHIFT_WINDOWS,
  SHIFT_WINDOW_ORDER,
  RESOURCE_TYPES,
  RESOURCE_TYPE_ORDER,
  TOTAL_FLEET,
  CORRIDORS,
  EVENT_WINDOW_MAPPING,
  WEATHER_STATES,
  PRESCRIPTION_LOCATIONS,    // re-exported from engineLogic
  NORTH_STAR,
  DATASET_STATS,
} from "../data/lockedDataModel.js";

// Business logic — pure functions
import {
  PRESCRIPTION_LOCATION_ORDER,
  computeAllPrescriptions,
  computeAllocationMatrix,
  computeReadinessScore,
  computeFullDemandSurface,
  computeFleetRemaining,
  computeTotalAllocated,
  getDefaultAllocationMatrix,
  shouldTriggerFeedbackLogger,
  getPlanningContextSummary,
  getDemandIntensityLevel,
  getActiveEventWindowConflicts,
  formatGap,
  formatDeviation,
  isHighRiskEvent,
  getNorthStarProgress,
} from "../logic/engineLogic.js";

// Sub-components (imported — built in separate files)
import SituationAwarenessTab from "./SituationAwarenessTab.jsx";
import DeploymentPlannerTab  from "./DeploymentPlannerTab.jsx";
import FeedbackLoggerModal   from "./FeedbackLoggerModal.jsx";
import NorthStarBanner       from "./NorthStarBanner.jsx";


// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

const TABS = [
  { id: "SITUATION",  label: "Situation Awareness",  icon: "◉" },
  { id: "DEPLOYMENT", label: "Deployment Planner",    icon: "⊞" },
];

/** Alert status → Tailwind background/border classes */
const ALERT_STYLE = {
  OPTIMAL:      { bg: "bg-green-900/40",  border: "border-green-500",  text: "text-green-400"  },
  ADVISORY:     { bg: "bg-amber-900/40",  border: "border-amber-500",  text: "text-amber-400"  },
  WARNING:      { bg: "bg-orange-900/40", border: "border-orange-500", text: "text-orange-400" },
  CRITICAL_GAP: { bg: "bg-red-900/40",    border: "border-red-500",    text: "text-red-400"    },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}


// ============================================================================
// ROOT COMPONENT
// ============================================================================

export default function AstramDashboard() {

  // ── Context state (top-bar controls shared across both tabs) ──────────────
  const [activeWindowId, setActiveWindowId] = useState("DAWN_PEAK");
  const [weatherState,   setWeatherState]   = useState("DRY");
  const [activeEvents,   setActiveEvents]   = useState([]);
  const [activeTab,      setActiveTab]      = useState("SITUATION");
  const [shiftDate,      setShiftDate]      = useState(todayISO);

  // Date-derived fields (month, dayOfWeek)
  const dateObj    = useMemo(() => new Date(shiftDate + "T00:00:00"), [shiftDate]);
  const month      = useMemo(() => dateObj.getMonth() + 1, [dateObj]);
  const dayOfWeek  = useMemo(() => dateObj.getDay(),        [dateObj]);

  // ── Derived prescriptions (recomputed whenever context changes) ───────────
  const prescriptionMatrix = useMemo(
    () => computeAllPrescriptions(activeWindowId, weatherState, activeEvents),
    [activeWindowId, weatherState, activeEvents]
  );

  // ── Allocation state — seeded from prescriptions on window/context change ─
  // We keep a separate "seed key" so React re-initialises defaults correctly
  const [allocationMatrix, setAllocationMatrix] = useState(
    () => getDefaultAllocationMatrix(
      computeAllPrescriptions("DAWN_PEAK", "DRY", [])
    )
  );

  // When the shift window changes, reset allocations to new prescriptions
  const handleWindowChange = useCallback((newWindowId) => {
    setActiveWindowId(newWindowId);
    setAllocationMatrix(
      getDefaultAllocationMatrix(
        computeAllPrescriptions(newWindowId, weatherState, activeEvents)
      )
    );
  }, [weatherState, activeEvents]);

  // ── Comparison matrix ─────────────────────────────────────────────────────
  const comparisonMatrix = useMemo(
    () => computeAllocationMatrix(prescriptionMatrix, allocationMatrix),
    [prescriptionMatrix, allocationMatrix]
  );

  // ── Readiness score ───────────────────────────────────────────────────────
  const readinessResult = useMemo(
    () => computeReadinessScore(
      prescriptionMatrix, allocationMatrix, activeWindowId, activeEvents
    ),
    [prescriptionMatrix, allocationMatrix, activeWindowId, activeEvents]
  );

  // ── Demand surface (Tab 1 heat map) ──────────────────────────────────────
  const demandSurface = useMemo(
    () => computeFullDemandSurface({ weatherState, activeEvents, month, dayOfWeek }),
    [weatherState, activeEvents, month, dayOfWeek]
  );

  // ── Fleet counters ────────────────────────────────────────────────────────
  const totalAllocated  = useMemo(() => computeTotalAllocated(allocationMatrix),  [allocationMatrix]);
  const fleetRemaining  = useMemo(() => computeFleetRemaining(allocationMatrix),  [allocationMatrix]);

  // ── Feedback logger modal ─────────────────────────────────────────────────
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [finalisedLog,      setFinalisedLog]      = useState(null);  // last saved log

  const feedbackTrigger = useMemo(
    () => shouldTriggerFeedbackLogger(
      comparisonMatrix, readinessResult, activeEvents, activeWindowId
    ),
    [comparisonMatrix, readinessResult, activeEvents, activeWindowId]
  );

  // ── Slider update handler ─────────────────────────────────────────────────
  const handleAllocationChange = useCallback(
    (locationId, resourceType, newValue) => {
      setAllocationMatrix(prev => ({
        ...prev,
        [locationId]: {
          ...prev[locationId],
          [resourceType]: newValue,
        },
      }));
    },
    []
  );

  // ── Active event toggle ───────────────────────────────────────────────────
  const handleEventToggle = useCallback((eventId) => {
    setActiveEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  }, []);

  // ── Finalise shift plan ───────────────────────────────────────────────────
  const handleFinalise = useCallback(() => {
    if (feedbackTrigger.shouldTrigger) {
      setShowFeedbackModal(true);
    } else {
      // No deviation — log is auto-saved silently
      handleFeedbackSubmit({ deviationReason: null, deviationNote: "" });
    }
  }, [feedbackTrigger]);

  const handleFeedbackSubmit = useCallback(({ deviationReason, deviationNote }) => {
    setShowFeedbackModal(false);
    // In the full implementation this persists via API / IndexedDB
    // For now, record the log in local state and expose it for testing
    const log = {
      commanderId:      "CMD-001",         // pulled from auth context in prod
      station:          "Central Command",
      shiftDate,
      activeWindowId,
      weatherState,
      activeEvents,
      prescriptionMatrix,
      allocationMatrix,
      readinessResult,
      comparisonMatrix,
      deviationReason,
      deviationNote,
      savedAt: new Date().toISOString(),
    };
    setFinalisedLog(log);
    console.info("[ASTRAM] Shift plan finalised:", log);
  }, [
    shiftDate, activeWindowId, weatherState, activeEvents,
    prescriptionMatrix, allocationMatrix, readinessResult, comparisonMatrix,
  ]);

  // ── Alert style ───────────────────────────────────────────────────────────
  const alertStyle = ALERT_STYLE[readinessResult.alertStatus] ?? ALERT_STYLE.CRITICAL_GAP;

  // ── Context summary line (header) ─────────────────────────────────────────
  const contextSummary = useMemo(
    () => getPlanningContextSummary(activeWindowId, weatherState, activeEvents, month, dayOfWeek),
    [activeWindowId, weatherState, activeEvents, month, dayOfWeek]
  );


  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">

      {/* ── FEEDBACK LOGGER MODAL (blocks until completed) ── */}
      {showFeedbackModal && (
        <FeedbackLoggerModal
          triggerReasons={feedbackTrigger.triggerReasons}
          comparisonMatrix={comparisonMatrix}
          readinessResult={readinessResult}
          prescriptionMatrix={prescriptionMatrix}
          allocationMatrix={allocationMatrix}
          onSubmit={handleFeedbackSubmit}
          onCancel={() => setShowFeedbackModal(false)}
        />
      )}

      {/* ── SYSTEM MASTHEAD ─────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">
              ASTRAM · Command Decision Engine · Bengaluru Traffic Authority
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Dataset: {DATASET_STATS.totalRecords.toLocaleString()} records · Nov 2023–Apr 2024
          </span>
        </div>
      </header>

      {/* ── CONTEXT CONTROLS BAR ────────────────────────── */}
      <ContextControlsBar
        shiftDate={shiftDate}
        activeWindowId={activeWindowId}
        weatherState={weatherState}
        activeEvents={activeEvents}
        onDateChange={setShiftDate}
        onWindowChange={handleWindowChange}
        onWeatherChange={setWeatherState}
        onEventToggle={handleEventToggle}
      />

      {/* ── NORTH STAR BANNER ───────────────────────────── */}
      {/* Always visible — this is the metric that ties all phases together */}
      <NorthStarBanner />

      {/* ── READINESS HEADER BAR ────────────────────────── */}
      <ReadinessBar
        readinessResult={readinessResult}
        alertStyle={alertStyle}
        totalAllocated={totalAllocated}
        fleetRemaining={fleetRemaining}
        contextSummary={contextSummary}
        activeWindowId={activeWindowId}
      />

      {/* ── TAB NAVIGATION ──────────────────────────────── */}
      <nav className="border-b border-gray-800 bg-gray-900 px-6">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-5 py-3 text-sm font-medium tracking-wide border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-blue-400 text-blue-300"
                  : "border-transparent text-gray-500 hover:text-gray-300",
              ].join(" ")}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── TAB CONTENT ─────────────────────────────────── */}
      <main className="px-6 py-6 max-w-screen-xl mx-auto">
        {activeTab === "SITUATION" && (
          <SituationAwarenessTab
            demandSurface={demandSurface}
            activeEvents={activeEvents}
            activeWindowId={activeWindowId}
            weatherState={weatherState}
            month={month}
            dayOfWeek={dayOfWeek}
            onSwitchToDeployment={() => setActiveTab("DEPLOYMENT")}
          />
        )}

        {activeTab === "DEPLOYMENT" && (
          <DeploymentPlannerTab
            activeWindowId={activeWindowId}
            prescriptionMatrix={prescriptionMatrix}
            allocationMatrix={allocationMatrix}
            comparisonMatrix={comparisonMatrix}
            readinessResult={readinessResult}
            fleetRemaining={fleetRemaining}
            totalAllocated={totalAllocated}
            alertStyle={alertStyle}
            feedbackTrigger={feedbackTrigger}
            onAllocationChange={handleAllocationChange}
            onFinalise={handleFinalise}
            finalisedLog={finalisedLog}
          />
        )}
      </main>
    </div>
  );
}


// ============================================================================
// CONTEXT CONTROLS BAR
// The top-level planning context. Must be set before allocations have meaning.
// Reference: Section 9, "Context before allocation is the right UX hierarchy"
// ============================================================================

function ContextControlsBar({
  shiftDate, activeWindowId, weatherState, activeEvents,
  onDateChange, onWindowChange, onWeatherChange, onEventToggle,
}) {
  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
      <div className="flex flex-wrap items-center gap-4 text-xs">

        {/* Date picker */}
        <label className="flex items-center gap-2 text-gray-400">
          <span className="text-gray-500 uppercase tracking-wider">Date</span>
          <input
            type="date"
            value={shiftDate}
            onChange={e => onDateChange(e.target.value)}
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs"
          />
        </label>

        {/* Shift window selector */}
        <div className="flex items-center gap-1">
          <span className="text-gray-500 uppercase tracking-wider mr-1">Shift</span>
          {SHIFT_WINDOW_ORDER.map(windowId => {
            const w = SHIFT_WINDOWS[windowId];
            const isActive = windowId === activeWindowId;
            const isDead   = w.isDead;
            return (
              <button
                key={windowId}
                onClick={() => onWindowChange(windowId)}
                title={`${w.label} · ${w.hours} · ~${w.avgEventsPerDay} events/day`}
                className={[
                  "px-2 py-1 rounded text-xs border transition-colors",
                  isActive
                    ? "bg-blue-700 border-blue-500 text-white"
                    : isDead
                    ? "bg-gray-800 border-gray-700 text-gray-600 hover:border-gray-600"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500",
                ].join(" ")}
              >
                {w.shortLabel}
                {isDead && <span className="ml-1 text-gray-600">·dead</span>}
              </button>
            );
          })}
        </div>

        {/* Weather state */}
        <div className="flex items-center gap-1">
          <span className="text-gray-500 uppercase tracking-wider mr-1">Weather</span>
          {Object.values(WEATHER_STATES).map(ws => (
            <button
              key={ws.id}
              onClick={() => onWeatherChange(ws.id)}
              title={`${ws.description} · ${ws.incidentMultiplier}× multiplier`}
              className={[
                "px-2 py-1 rounded text-xs border transition-colors",
                weatherState === ws.id
                  ? "bg-sky-800 border-sky-500 text-sky-200"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500",
              ].join(" ")}
            >
              {ws.label}
              {ws.incidentMultiplier !== 1.0 && (
                <span className="ml-1 text-sky-400">{ws.incidentMultiplier}×</span>
              )}
            </button>
          ))}
        </div>

        {/* Planned event toggles */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-gray-500 uppercase tracking-wider mr-1">Events</span>
          {Object.entries(EVENT_WINDOW_MAPPING).map(([eventId, mapping]) => {
            const isActive   = activeEvents.includes(eventId);
            const isHighRisk = mapping.isHighRisk;
            return (
              <button
                key={eventId}
                onClick={() => onEventToggle(eventId)}
                title={`Closure prob: ${Math.round(mapping.closureProbability * 100)}% · +${Math.round(mapping.demandMultiplier * 100)}% demand · ${mapping.affectedWindows.join(", ")}`}
                className={[
                  "px-2 py-1 rounded text-xs border transition-colors",
                  isActive && isHighRisk
                    ? "bg-red-900 border-red-500 text-red-200"
                    : isActive
                    ? "bg-purple-900 border-purple-500 text-purple-200"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500",
                ].join(" ")}
              >
                {eventId.replace(/_/g, " ")}
                {isHighRisk && <span className="ml-1 text-red-400">⚠</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// READINESS BAR
// Persistent header signal — updating live as sliders move.
// Reference: Section 9, "Missing 3: No Readiness Score or Alert Status" fix.
//            Section 8, "The Readiness Formula"
// ============================================================================

function ReadinessBar({
  readinessResult, alertStyle,
  totalAllocated, fleetRemaining,
  contextSummary, activeWindowId,
}) {
  const { score, alertStatus, alertLabel, required, allocated, shortfall,
          surplus, rule1Triggered, rule1Detail } = readinessResult;

  return (
    <div className={`${alertStyle.bg} border-b ${alertStyle.border} px-6 py-3`}>
      <div className="flex items-center justify-between flex-wrap gap-3">

        {/* Left: score + alert status */}
        <div className="flex items-center gap-4">
          {/* Radial-style score display */}
          <div className="flex flex-col items-center">
            <span className={`text-3xl font-bold tabular-nums ${alertStyle.text}`}>
              {score}
            </span>
            <span className="text-xs text-gray-500 tracking-wider">READINESS</span>
          </div>

          <div className={`border-l ${alertStyle.border} pl-4`}>
            <div className={`text-lg font-bold ${alertStyle.text} tracking-wide`}>
              {alertLabel.toUpperCase()}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{contextSummary}</div>
          </div>

          {/* Rule 1 override warning — critical, must be prominent */}
          {rule1Triggered && (
            <div className="bg-red-950 border border-red-600 rounded px-3 py-1.5 text-xs">
              <span className="text-red-400 font-bold">RULE 1 OVERRIDE · </span>
              <span className="text-red-300">
                {rule1Detail?.eventId?.replace(/_/g, " ")} active —{" "}
                shortfall of {rule1Detail?.shortfall} units exceeds threshold of{" "}
                {rule1Detail?.threshold}. Status forced to CRITICAL GAP.
              </span>
            </div>
          )}
        </div>

        {/* Right: fleet counters */}
        <div className="flex items-center gap-6 text-xs">
          <Stat label="Required"   value={required}        dim={false} />
          <Stat label="Allocated"  value={allocated}       dim={false} />
          {shortfall > 0 && (
            <Stat label="Shortfall" value={`-${shortfall}`} dim={false} danger />
          )}
          {surplus > 0 && (
            <Stat label="Surplus"   value={`+${surplus}`}   dim={false} />
          )}
          <div className="border-l border-gray-700 pl-6">
            <Stat label="Fleet Total"   value={`${totalAllocated} / 50`} dim={false} />
            <Stat label="In Reserve"    value={fleetRemaining}            dim={true}  />
          </div>
        </div>
      </div>

      {/* Readiness score bar */}
      <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${alertStyle.text.replace("text-", "bg-")}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, dim, danger }) {
  return (
    <div className="flex flex-col items-end">
      <span className={`text-sm font-bold tabular-nums ${danger ? "text-red-400" : dim ? "text-gray-500" : "text-gray-200"}`}>
        {value}
      </span>
      <span className="text-xs text-gray-600 uppercase tracking-wider">{label}</span>
    </div>
  );
}


// ============================================================================
// NORTH STAR BANNER
// Always-visible progress indicator for the single most important metric.
// Reference: Section 12, "The North Star Metric"
// Baseline: 0% · Phase 3 Gate: 60% · 12-month Target: 80%
// ============================================================================

// NorthStarBanner is defined in its own file — see NorthStarBanner.jsx
// Declared here as stub to enable this file to compile standalone
