/**
 * ============================================================================
 * ASTRAM COMMAND DECISION ENGINE
 * FEEDBACK LOGGER MODAL — FeedbackLoggerModal.jsx
 * ============================================================================
 *
 * The most important component in the entire system.
 * "The system that builds its successor." — Section 7, Layer 5
 *
 * This modal is BLOCKING. It cannot be dismissed without completing the log.
 * Rationale: every dismissed deviation is a training data point lost forever.
 * After 12 months, this log becomes the dataset for the supervised ML model
 * that learns when commanders were right to deviate.
 *
 * Trigger conditions (either is sufficient):
 *   (a) Any resource type deviates >20% from system prescription
 *   (b) Any high-risk event window (closure prob >40%) has shortfall >5 units
 *
 * Commander-provided fields (required + optional):
 *   - deviationReason : one of DEVIATION_REASONS (required, single select)
 *   - deviationNote   : free text, max 200 chars (optional)
 *
 * Auto-captured fields (zero commander input):
 *   - Full prescription matrix snapshot
 *   - Full allocation matrix snapshot
 *   - Readiness score at time of finalisation
 *   - Active events + weather state
 *   - Shift date + window + commander ID
 *   - Outcome fields (populated later from incident data — null at creation)
 *
 * Reference: Section 8, "Feedback Logger — Exact Trigger Logic and Modal Specification"
 *            Section 7, Layer 5 — "The Feedback Logger"
 * ============================================================================
 */

import { useState, useCallback, useMemo } from "react";
import { DEVIATION_REASONS, SHIFT_WINDOWS, WEATHER_STATES, EVENT_WINDOW_MAPPING,
         PRESCRIPTION_LOCATION_ORDER, RESOURCE_TYPE_ORDER } from "../data/lockedDataModel.js";
import { formatGap, formatDeviation } from "../logic/engineLogic.js";


// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

export default function FeedbackLoggerModal({
  triggerReasons,        // [{ type, locationId, resourceType, ... }]
  comparisonMatrix,      // full comparison data for deviation table
  readinessResult,       // { score, alertStatus, shortfall, ... }
  prescriptionMatrix,    // system recommendation snapshot
  allocationMatrix,      // commander allocation snapshot
  onSubmit,              // ({ deviationReason, deviationNote }) => void
  onCancel,              // () => void — only enabled when safe to cancel
}) {

  const [selectedReason, setSelectedReason] = useState(null);
  const [note,           setNote]           = useState("");
  const [noteError,      setNoteError]      = useState("");
  const [reasonError,    setReasonError]    = useState("");
  const [confirmed,      setConfirmed]      = useState(false);

  // Determine if this can be cancelled.
  // Rule 1 override (high-risk event shortfall) is NEVER cancellable.
  // Pure deviation (condition A only) gives a cancel path with a warning.
  const hasRule1Override = triggerReasons.some(r => r.type === "HIGH_RISK_EVENT_SHORTFALL");
  const canCancel        = !hasRule1Override;

  // Count unique deviated rows for the summary header
  const deviatedRows = useMemo(
    () => triggerReasons.filter(r => r.type === "DEVIATION"),
    [triggerReasons]
  );
  const hasHighRiskTrigger = triggerReasons.some(r => r.type === "HIGH_RISK_EVENT_SHORTFALL");

  // ── Validation ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    let valid = true;

    if (!selectedReason) {
      setReasonError("A deviation reason is required before this shift plan can be finalised.");
      valid = false;
    } else {
      setReasonError("");
    }

    if (note.length > 200) {
      setNoteError("Note must be 200 characters or fewer.");
      valid = false;
    } else {
      setNoteError("");
    }

    if (!valid) return;

    setConfirmed(true);
    // Small delay so user sees the confirmation state before modal closes
    setTimeout(() => {
      onSubmit({ deviationReason: selectedReason, deviationNote: note });
    }, 400);
  }, [selectedReason, note, onSubmit]);

  const handleNoteChange = useCallback((e) => {
    const val = e.target.value;
    setNote(val);
    if (val.length > 200) {
      setNoteError(`${val.length}/200 characters — exceeds limit.`);
    } else {
      setNoteError("");
    }
  }, []);


  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    // Overlay — clicking outside does NOT close (blocking modal)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-red-600 rounded-lg shadow-2xl">

        {/* ── MODAL HEADER ── */}
        <ModalHeader
          hasRule1Override={hasRule1Override}
          deviatedRowCount={deviatedRows.length}
          readinessResult={readinessResult}
        />

        <div className="px-6 pb-6 space-y-5">

          {/* ── DEVIATION TABLE ── */}
          <DeviationTable
            comparisonMatrix={comparisonMatrix}
            triggerReasons={triggerReasons}
          />

          {/* ── HIGH-RISK EVENT SHORTFALL CALLOUT (if Rule 1 triggered) ── */}
          {hasHighRiskTrigger && (
            <HighRiskEventCallout
              triggerReasons={triggerReasons.filter(r => r.type === "HIGH_RISK_EVENT_SHORTFALL")}
              readinessResult={readinessResult}
            />
          )}

          {/* ── REASON SELECTOR ── */}
          <ReasonSelector
            selectedReason={selectedReason}
            onSelect={setSelectedReason}
            error={reasonError}
          />

          {/* ── NOTE FIELD ── */}
          <NoteField
            value={note}
            onChange={handleNoteChange}
            error={noteError}
            selectedReason={selectedReason}
          />

          {/* ── AUTO-CAPTURED FIELDS TRANSPARENCY SECTION ── */}
          <AutoCapturedFields
            readinessResult={readinessResult}
            prescriptionMatrix={prescriptionMatrix}
            allocationMatrix={allocationMatrix}
          />

          {/* ── ACTION BUTTONS ── */}
          <ActionButtons
            selectedReason={selectedReason}
            confirmed={confirmed}
            canCancel={canCancel}
            hasRule1Override={hasRule1Override}
            onSubmit={handleSubmit}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// MODAL HEADER
// ============================================================================

function ModalHeader({ hasRule1Override, deviatedRowCount, readinessResult }) {
  return (
    <div className="bg-red-950 border-b border-red-700 px-6 py-4 rounded-t-lg">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 text-lg">⚠</span>
            <span className="text-red-300 font-bold text-base tracking-wide uppercase">
              Deviation Log Required
            </span>
          </div>
          <p className="text-sm text-red-200/80 leading-relaxed max-w-lg">
            {hasRule1Override
              ? "A high-risk planned event is active and the shortfall exceeds the critical threshold. This log is mandatory and cannot be dismissed."
              : `${deviatedRowCount} allocation row${deviatedRowCount !== 1 ? "s deviate" : " deviates"} more than 20% from the system prescription. Document your reasoning before finalising.`
            }
          </p>
        </div>
        <div className="text-right ml-4">
          <div className="text-2xl font-bold text-red-400 tabular-nums">
            {readinessResult.score}
          </div>
          <div className="text-xs text-red-500 uppercase tracking-wider">
            readiness
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// DEVIATION TABLE
// Shows: System Recommended → Your Allocation → Gap (%)
// Reference: Section 8, "Modal contents" specification
// ============================================================================

function DeviationTable({ comparisonMatrix, triggerReasons }) {
  // Only show rows that exceed the threshold (condition A triggers)
  const deviatedRows = triggerReasons.filter(r => r.type === "DEVIATION");
  if (deviatedRows.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-2">
        Allocation Deviations
      </h3>
      <div className="border border-gray-700 rounded overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-5 bg-gray-800 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
          <span className="col-span-2">Resource</span>
          <span className="text-right">Prescribed</span>
          <span className="text-right">Allocated</span>
          <span className="text-right">Gap</span>
        </div>
        {/* Rows */}
        {deviatedRows.map((reason, i) => {
          const cell = comparisonMatrix[reason.locationId]?.[reason.resourceType];
          if (!cell) return null;
          const isShortfall = reason.gap < 0;
          const isSurplus   = reason.gap > 0;
          return (
            <div
              key={i}
              className={`grid grid-cols-5 px-4 py-2 text-sm border-t border-gray-800 items-center ${
                isShortfall ? "bg-red-950/30" : "bg-gray-900"
              }`}
            >
              <span className="col-span-2 text-gray-300">
                <span className="text-gray-500">
                  {reason.locationId.replace(/_/g, " ")} ·{" "}
                </span>
                {reason.resourceType}
              </span>
              <span className="text-right text-gray-400 tabular-nums">{cell.prescribed}</span>
              <span className="text-right text-gray-200 tabular-nums font-medium">{cell.allocated}</span>
              <span className={`text-right tabular-nums font-bold ${
                isShortfall ? "text-red-400" : isSurplus ? "text-amber-400" : "text-gray-400"
              }`}>
                {formatGap(cell.gap)}
                <span className="ml-1 text-xs font-normal text-gray-500">
                  ({formatDeviation(cell.deviationPct)})
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ============================================================================
// HIGH-RISK EVENT CALLOUT
// Fires when Rule 1 override is triggered (closure prob >40%, shortfall >5).
// ============================================================================

function HighRiskEventCallout({ triggerReasons, readinessResult }) {
  return (
    <div className="bg-red-950/60 border border-red-700 rounded p-4">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-xl mt-0.5">⚡</span>
        <div>
          <div className="text-red-300 font-bold text-sm mb-1">
            Rule 1 Override — Critical Event Shortfall
          </div>
          {triggerReasons.map((r, i) => (
            <p key={i} className="text-sm text-red-200/80 leading-relaxed">
              <strong className="text-red-300">{r.eventId?.replace(/_/g, " ")}</strong>{" "}
              is active in this window with a {Math.round(r.closureProbability * 100)}%
              road closure probability. The current shortfall of{" "}
              <strong className="text-red-300">{readinessResult.shortfall} units</strong>{" "}
              exceeds the {r.threshold}-unit critical threshold. Alert Status is locked to{" "}
              <strong className="text-red-300">CRITICAL GAP</strong> regardless of base score.
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// REASON SELECTOR
// Reference: Section 8, deviation reasons list
// ============================================================================

function ReasonSelector({ selectedReason, onSelect, error }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-2">
        Why are you deviating from the system recommendation?{" "}
        <span className="text-red-400">*</span>
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {DEVIATION_REASONS.map(reason => {
          const isSelected = selectedReason === reason.id;
          return (
            <button
              key={reason.id}
              onClick={() => onSelect(reason.id)}
              className={[
                "text-left px-4 py-3 rounded border transition-colors text-sm",
                isSelected
                  ? "bg-blue-900 border-blue-500 text-blue-100"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  isSelected ? "bg-blue-400 border-blue-400" : "border-gray-600"
                }`}>
                  {isSelected && <span className="block w-1.5 h-1.5 bg-gray-900 rounded-full" />}
                </span>
                <div>
                  <div className={`font-medium ${isSelected ? "text-blue-200" : "text-gray-300"}`}>
                    {reason.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{reason.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}


// ============================================================================
// NOTE FIELD
// Optional free-text, max 200 characters.
// Reference: Section 8, "Optional note (200 chars max)"
// ============================================================================

function NoteField({ value, onChange, error, selectedReason }) {
  const charsRemaining = 200 - value.length;
  const isRequired     = selectedReason === "OTHER";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs uppercase tracking-widest text-gray-500">
          Note {isRequired
            ? <span className="text-red-400">* (required when reason is "Other")</span>
            : <span className="text-gray-600">(optional)</span>
          }
        </label>
        <span className={`text-xs tabular-nums ${charsRemaining < 20 ? "text-amber-400" : "text-gray-600"}`}>
          {charsRemaining} chars remaining
        </span>
      </div>
      <textarea
        value={value}
        onChange={onChange}
        placeholder="Describe your reasoning (e.g. 'Strike march expected on Bellary Road — local intel from station')"
        rows={3}
        maxLength={210} // slightly over to allow the error to fire
        className={[
          "w-full bg-gray-800 text-gray-200 text-sm border rounded px-3 py-2 resize-none",
          "placeholder-gray-600 focus:outline-none focus:ring-1",
          error ? "border-red-500 focus:ring-red-500" : "border-gray-700 focus:ring-blue-500",
        ].join(" ")}
      />
      {error && (
        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}


// ============================================================================
// AUTO-CAPTURED FIELDS TRANSPARENCY SECTION
// Shows commanders exactly what is being recorded automatically.
// Transparency builds trust in the system.
// Reference: Section 8, "Auto-captured fields (no commander input required)"
// ============================================================================

function AutoCapturedFields({ readinessResult, prescriptionMatrix, allocationMatrix }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-800 rounded">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
      >
        <span className="uppercase tracking-wider">
          Auto-captured system fields (no input required)
        </span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-3 text-xs text-gray-400">
          <p className="text-gray-500 italic">
            These fields are recorded automatically. You do not need to enter them.
            After shift completion, outcome fields (events handled, closures,
            resolution times) are populated from incident data.
          </p>

          {/* Readiness snapshot */}
          <div>
            <span className="text-gray-600 uppercase tracking-wider mr-2">Readiness at finalisation:</span>
            <span className="text-gray-300">
              {readinessResult.score} · {readinessResult.alertStatus} ·
              Required: {readinessResult.required} · Allocated: {readinessResult.allocated}
            </span>
          </div>

          {/* Prescription matrix snapshot */}
          <div>
            <span className="text-gray-600 uppercase tracking-wider block mb-1">
              System prescription (full snapshot):
            </span>
            <div className="font-mono bg-gray-950 rounded p-2 text-xs space-y-0.5">
              {PRESCRIPTION_LOCATION_ORDER.map(locationId => (
                RESOURCE_TYPE_ORDER.map(rt => {
                  const prescribed = prescriptionMatrix[locationId]?.[rt] ?? 0;
                  const allocated  = allocationMatrix[locationId]?.[rt] ?? 0;
                  return (
                    <div key={`${locationId}-${rt}`} className="grid grid-cols-3 gap-2 text-gray-500">
                      <span>{locationId.replace(/_/g, " ")}.{rt}</span>
                      <span className="text-right text-gray-400">presc: {prescribed}</span>
                      <span className="text-right text-gray-300">actual: {allocated}</span>
                    </div>
                  );
                })
              ))}
            </div>
          </div>

          {/* Outcome fields placeholder */}
          <div>
            <span className="text-gray-600 uppercase tracking-wider mr-2">
              Outcome fields (populated post-shift):
            </span>
            <span className="text-gray-600 italic">
              events_handled · road_closures · median_resolution_min/corridor
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================================
// ACTION BUTTONS
// ============================================================================

function ActionButtons({
  selectedReason, confirmed,
  canCancel, hasRule1Override,
  onSubmit, onCancel,
}) {
  return (
    <div className="flex items-center justify-between pt-2 border-t border-gray-800">

      {/* Cancel — only available when no Rule 1 override */}
      <div>
        {canCancel ? (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors border border-gray-700 rounded"
          >
            Go Back (unsaved)
          </button>
        ) : (
          <p className="text-xs text-red-500 italic max-w-xs">
            This log cannot be dismissed. A high-risk event requires mandatory documentation.
          </p>
        )}
      </div>

      {/* Confirm & Finalise */}
      <button
        onClick={onSubmit}
        disabled={confirmed}
        className={[
          "px-6 py-2.5 rounded text-sm font-bold tracking-wide transition-all",
          confirmed
            ? "bg-green-800 border border-green-600 text-green-300 cursor-not-allowed"
            : selectedReason
            ? "bg-blue-700 hover:bg-blue-600 border border-blue-500 text-white"
            : "bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed",
        ].join(" ")}
      >
        {confirmed ? "✓ Logged & Finalised" : "Confirm & Finalise Plan"}
      </button>
    </div>
  );
}
