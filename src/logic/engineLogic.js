/**
 * ============================================================================
 * ASTRAM COMMAND DECISION ENGINE
 * CORE BUSINESS LOGIC — v1.0
 * ============================================================================
 *
 * This file contains pure functions only. No UI. No side effects.
 * Every function is independently testable.
 *
 * Functions are organised into five layers matching the architecture spec:
 *   Layer 1 — Demand Surface computation
 *   Layer 2 — Resource Prescription Engine
 *   Layer 3 — Constraint Solver
 *   Layer 4 — Readiness Score (Event-Context-Aware)
 *   Layer 5 — Feedback Logger trigger logic
 *
 * Reference: Astram_Complete_Analysis_and_Roadmap.txt, Sections 7 & 8
 * ============================================================================
 */

import {
  SHIFT_WINDOWS,
  SHIFT_WINDOW_ORDER,
  RESOURCE_TYPES,
  RESOURCE_TYPE_ORDER,
  TOTAL_FLEET,
  CORRIDORS,
  EVENT_WINDOW_MAPPING,
  WEATHER_STATES,
  BASE_PRESCRIPTIONS_DAWN_DRY,
  BASE_PRESCRIPTION_TOTAL,
  BASE_RESERVE_UNITS,
  READINESS_THRESHOLDS,
  CRITICAL_SHORTFALL_THRESHOLD,
  HIGH_RISK_CLOSURE_PROBABILITY_THRESHOLD,
  DEVIATION_TRIGGER_PERCENT,
  MONTHLY_EVENT_COUNTS,
} from "../data/lockedDataModel.js";


// ============================================================================
// LAYER 1 — DEMAND SURFACE COMPUTATION
// Computes expected incident demand per corridor per shift window,
// stacking all active modifiers in the correct order.
// Reference: Section 7, Layer 1 & Section 8 data tables
// ============================================================================

/**
 * Monthly season multipliers derived from dataset.
 * March is the highest month (1,931 events vs 972 baseline).
 * April is excluded (incomplete data).
 * Reference: Section 1, "Monthly Trend"; Section 7, Layer 1
 */
const MONTH_MULTIPLIERS = {
  1:  1.49,  // Jan 2024: 1,446 / 972 baseline
  2:  1.38,  // Feb 2024: 1,340 / 972 — explicitly cited in spec
  3:  2.0,   // Mar 2024: 1,931 / 972 — explicitly cited in spec
  4:  null,  // Apr 2024: incomplete, do not use
  5:  1.0,   // No data — default to 1.0
  6:  1.0,
  7:  1.0,
  8:  1.0,
  9:  1.0,
  10: 1.0,
  11: 1.0,   // Nov 2023: baseline month
  12: 1.80,  // Dec 2023: 1,746 / 972
};

/**
 * Day-of-week multipliers for planned high-risk events.
 * Processions, Public Events, Protests cluster on Sunday (0) and Monday (1).
 * Reference: Section 3, "Planned Event Patterns by Day of Week"
 */
const DAY_OF_WEEK_PLANNED_EVENT_RISK = {
  0: 1.30,  // Sunday  — highest planned event concentration
  1: 1.30,  // Monday  — highest planned event concentration
  2: 1.05,  // Tuesday
  3: 1.10,  // Wednesday
  4: 1.15,  // Thursday — Construction peaks (permit filing pattern)
  5: 1.05,  // Friday
  6: 1.15,  // Saturday
};

/**
 * Base incident rates per shift window per corridor tier.
 * Derived by distributing the hourly dataset counts across corridors
 * using tier multipliers.
 * Units: expected incidents per shift per corridor.
 */
const BASE_INCIDENT_RATE_BY_WINDOW = {
  DAWN_PEAK:      { tier1: 18, tier2: 12, tier3: 8,  tier4: 6,  tier5: 4  },
  COMMUTER_PEAK:  { tier1: 4,  tier2: 3,  tier3: 2,  tier4: 1,  tier5: 1  },
  AFTERNOON_LULL: { tier1: 1,  tier2: 1,  tier3: 0,  tier4: 0,  tier5: 0  },
  EVENING_RUSH:   { tier1: 14, tier2: 9,  tier3: 6,  tier4: 5,  tier5: 3  },
  NIGHT_PEAK:     { tier1: 20, tier2: 14, tier3: 9,  tier4: 7,  tier5: 4  },
};

/**
 * computeWindowDemand()
 * Returns the expected incident count for a single corridor × window cell,
 * after all active modifiers have been applied.
 *
 * @param {string}   windowId      — one of SHIFT_WINDOW_ORDER
 * @param {number}   corridorTier  — 1–5
 * @param {string}   weatherState  — "DRY" | "LIGHT_RAIN" | "HEAVY_MONSOON"
 * @param {string[]} activeEvents  — array of EVENT_WINDOW_MAPPING keys
 * @param {number}   month         — 1–12
 * @param {number}   dayOfWeek     — 0 (Sun) – 6 (Sat)
 * @returns {number} expectedIncidents (rounded to 1 decimal)
 */
export function computeWindowDemand(
  windowId,
  corridorTier,
  weatherState,
  activeEvents,
  month,
  dayOfWeek
) {
  const tierKey = `tier${corridorTier}`;
  let base = BASE_INCIDENT_RATE_BY_WINDOW[windowId]?.[tierKey] ?? 0;

  // Step 1 — Apply season/month multiplier
  const monthMult = MONTH_MULTIPLIERS[month] ?? 1.0;
  base *= monthMult;

  // Step 2 — Apply weather multiplier
  const weatherMult = WEATHER_STATES[weatherState]?.incidentMultiplier ?? 1.0;
  base *= weatherMult;

  // Step 3 — Apply active event overlays (calibrated per event type, per window)
  for (const eventId of activeEvents) {
    const mapping = EVENT_WINDOW_MAPPING[eventId];
    if (!mapping) continue;
    if (mapping.affectedWindows.includes(windowId)) {
      base *= 1 + mapping.demandMultiplier;
    }
  }

  // Step 4 — Apply day-of-week risk modifier for planned-event-sensitive windows
  // Dawn Peak and Night Peak have the highest planned event concentration
  const plannedEventWindows = ["DAWN_PEAK", "NIGHT_PEAK", "EVENING_RUSH"];
  if (plannedEventWindows.includes(windowId)) {
    base *= DAY_OF_WEEK_PLANNED_EVENT_RISK[dayOfWeek] ?? 1.0;
  }

  return Math.round(base * 10) / 10;
}

/**
 * computeFullDemandSurface()
 * Computes the complete corridor × window demand matrix for a given shift context.
 * This is the "heat map" data that drives Tab 1 (Situation Awareness).
 *
 * @param {Object} context — { weatherState, activeEvents, month, dayOfWeek }
 * @returns {Object} demandSurface — keyed as demandSurface[corridorId][windowId]
 */
export function computeFullDemandSurface(context) {
  const { weatherState, activeEvents, month, dayOfWeek } = context;
  const surface = {};

  for (const [corridorId, corridor] of Object.entries(CORRIDORS)) {
    surface[corridorId] = {};
    for (const windowId of SHIFT_WINDOW_ORDER) {
      surface[corridorId][windowId] = computeWindowDemand(
        windowId,
        corridor.tier,
        weatherState,
        activeEvents,
        month,
        dayOfWeek
      );
    }
  }
  return surface;
}

/**
 * getDemandIntensityLevel()
 * Classifies a demand value into a heat map intensity level for UI rendering.
 * Thresholds are calibrated to the dataset's actual range.
 *
 * @param {number} demandValue
 * @returns {"none"|"low"|"moderate"|"high"|"critical"}
 */
export function getDemandIntensityLevel(demandValue) {
  if (demandValue === 0)      return "none";
  if (demandValue < 5)        return "low";
  if (demandValue < 12)       return "moderate";
  if (demandValue < 20)       return "high";
  return "critical";
}


// ============================================================================
// LAYER 2 — RESOURCE PRESCRIPTION ENGINE
// Computes the data-derived unit requirements for each location × resource type,
// adjusted for shift window, weather, and active events.
// Reference: Section 7, Layer 2 & Section 8, "Calibrated Prescriptions"
// ============================================================================

/**
 * Prescription locations — the three static outpost positions mandated by data.
 * These are the outputs of Layer 2, not inputs.
 * Reference: Section 8, "Calibrated Prescriptions — Dawn Shift, Dry, No Planned Event"
 */
export const PRESCRIPTION_LOCATIONS = {
  MYSORE_ROAD:  { id: "MYSORE_ROAD",  label: "Mysore Road",    corridorId: "MYSORE_ROAD",    tier: 1 },
  MEKHRI:       { id: "MEKHRI",       label: "Mekhri Circle",  corridorId: "BELLARY_ROAD_1", tier: 1 },
  ORR_NORTH:    { id: "ORR_NORTH",    label: "ORR North",      corridorId: "ORR_NORTH_1",    tier: 3 },
};

export const PRESCRIPTION_LOCATION_ORDER = ["MYSORE_ROAD", "MEKHRI", "ORR_NORTH"];

/**
 * computePrescription()
 * Returns the system-recommended unit allocation for a single location × resource type,
 * adjusted for the active shift window, weather state, and planned events.
 *
 * Logic:
 *   base = BASE_PRESCRIPTIONS_DAWN_DRY value
 *   × weather multiplier (partial — resources, not just incidents)
 *   × event multipliers for affected windows
 *   × window demand weight (lower allocation during lull windows)
 *   Clamped to integer, minimum 0.
 *
 * @param {string}   locationId    — key of PRESCRIPTION_LOCATIONS
 * @param {string}   resourceType  — "INTERCEPTORS" | "WARDENS" | "BARRICADES"
 * @param {string}   windowId      — active shift window
 * @param {string}   weatherState
 * @param {string[]} activeEvents
 * @returns {number} recommendedUnits (integer)
 */
export function computePrescription(
  locationId,
  resourceType,
  windowId,
  weatherState,
  activeEvents
) {
  // Base value from locked data model (Dawn + Dry + No Events)
  const baseValues = BASE_PRESCRIPTIONS_DAWN_DRY[locationId];
  if (!baseValues) return 0;
  let base = baseValues[resourceType] ?? 0;

  // Step 1 — Window demand weight
  // The base prescription is calibrated for Dawn Peak.
  // Other windows scale proportionally to their risk weight.
  const windowData = SHIFT_WINDOWS[windowId];
  const dawnWeight = SHIFT_WINDOWS.DAWN_PEAK.riskWeight;  // 0.30
  const windowWeight = windowData?.riskWeight ?? dawnWeight;
  const windowScalar = windowWeight / dawnWeight;         // 1.0 at dawn, lower at lull
  base *= windowScalar;

  // Step 2 — Weather multiplier
  // Resource demand scales with incident demand, but not 1:1.
  // We apply the square root of the weather multiplier to avoid over-prescribing.
  // Rationale: doubling incidents does not require doubling resources — triage helps.
  const weatherMult = WEATHER_STATES[weatherState]?.incidentMultiplier ?? 1.0;
  base *= Math.sqrt(weatherMult);

  // Step 3 — Event demand uplift
  // Only apply uplift for events that affect this window AND
  // that require this resource type specifically.
  const location = PRESCRIPTION_LOCATIONS[locationId];
  for (const eventId of activeEvents) {
    const mapping = EVENT_WINDOW_MAPPING[eventId];
    if (!mapping) continue;
    if (!mapping.affectedWindows.includes(windowId)) continue;

    // Route uplift to the correct resource type
    // VIP/Protest/PublicEvent → Barricades primarily; Procession → Wardens
    // Construction → Wardens; Tree Fall → Barricades
    const eventResourceEmphasis = getEventResourceEmphasis(eventId);
    const emphasisMult = eventResourceEmphasis[resourceType] ?? 0;
    base += base * emphasisMult * mapping.demandMultiplier;
  }

  // Step 4 — Clamp to integer, minimum 0
  return Math.max(0, Math.round(base));
}

/**
 * getEventResourceEmphasis()
 * Returns the weight each event type places on each resource type.
 * Used to route demand uplift to the correct resource category.
 *
 * @param {string} eventId — key of EVENT_WINDOW_MAPPING
 * @returns {Object} { INTERCEPTORS: number, WARDENS: number, BARRICADES: number }
 */
function getEventResourceEmphasis(eventId) {
  const emphasisMap = {
    VIP_MOVEMENT:     { INTERCEPTORS: 0.1, WARDENS: 0.3, BARRICADES: 0.9 },
    PUBLIC_EVENT:     { INTERCEPTORS: 0.2, WARDENS: 0.5, BARRICADES: 0.8 },
    PROCESSION:       { INTERCEPTORS: 0.1, WARDENS: 0.8, BARRICADES: 0.6 },
    PROTEST:          { INTERCEPTORS: 0.1, WARDENS: 0.4, BARRICADES: 0.9 },
    CONSTRUCTION_T1:  { INTERCEPTORS: 0.2, WARDENS: 0.9, BARRICADES: 0.6 },
    TREE_FALL:        { INTERCEPTORS: 0.5, WARDENS: 0.3, BARRICADES: 0.7 },
  };
  return emphasisMap[eventId] ?? { INTERCEPTORS: 0.3, WARDENS: 0.3, BARRICADES: 0.2 };
}

/**
 * computeAllPrescriptions()
 * Returns the full prescription matrix: { [locationId]: { [resourceType]: units } }
 *
 * @param {string}   windowId
 * @param {string}   weatherState
 * @param {string[]} activeEvents
 * @returns {Object} prescriptionMatrix
 */
export function computeAllPrescriptions(windowId, weatherState, activeEvents) {
  const matrix = {};
  for (const locationId of PRESCRIPTION_LOCATION_ORDER) {
    matrix[locationId] = {};
    for (const resourceType of RESOURCE_TYPE_ORDER) {
      matrix[locationId][resourceType] = computePrescription(
        locationId,
        resourceType,
        windowId,
        weatherState,
        activeEvents
      );
    }
    // Compute location total
    matrix[locationId]._total = RESOURCE_TYPE_ORDER.reduce(
      (sum, rt) => sum + matrix[locationId][rt], 0
    );
  }
  return matrix;
}

/**
 * computePrescriptionTotal()
 * Returns the total units prescribed across all locations.
 *
 * @param {Object} prescriptionMatrix — output of computeAllPrescriptions()
 * @returns {number}
 */
export function computePrescriptionTotal(prescriptionMatrix) {
  return PRESCRIPTION_LOCATION_ORDER.reduce(
    (sum, locationId) => sum + (prescriptionMatrix[locationId]?._total ?? 0),
    0
  );
}

/**
 * computeReserveUnits()
 * Returns units available for mobile response after static outpost prescription.
 *
 * @param {Object} prescriptionMatrix
 * @returns {number}
 */
export function computeReserveUnits(prescriptionMatrix) {
  return Math.max(0, TOTAL_FLEET - computePrescriptionTotal(prescriptionMatrix));
}


// ============================================================================
// LAYER 3 — GAP ANALYSIS
// Computes the difference between prescription and actual commander allocation.
// This is the primary decision-support signal shown in the Deployment Planner.
// Reference: Section 9, "Missing 2: No Demand Signal" — fix specification
// ============================================================================

/**
 * computeGap()
 * Returns the signed gap between allocated and prescribed units.
 * Positive = over-allocated (wasteful). Negative = under-allocated (risky).
 *
 * @param {number} allocated
 * @param {number} prescribed
 * @returns {number} gap (allocated - prescribed)
 */
export function computeGap(allocated, prescribed) {
  return allocated - prescribed;
}

/**
 * getGapSeverity()
 * Classifies the gap for UI highlighting.
 * Reference: Section 9, "Recommended UI Architecture" — amber >2, red >5
 *
 * @param {number} gap         — computeGap() output
 * @param {number} prescribed  — to compute percentage
 * @returns {"ok"|"amber"|"red"}
 */
export function getGapSeverity(gap, prescribed) {
  const shortfall = -gap; // positive means under-allocated
  if (shortfall <= 0) return "ok";
  if (shortfall <= 2) return "amber";
  return "red";
}

/**
 * computeAllocationMatrix()
 * Merges prescriptions with actual allocations to produce a comparison matrix.
 * This is the data structure behind each row in the Deployment Planner.
 *
 * @param {Object} prescriptionMatrix — from computeAllPrescriptions()
 * @param {Object} allocationMatrix   — { [locationId]: { [resourceType]: units } }
 * @returns {Object} comparisonMatrix keyed the same way, with gap and severity
 */
export function computeAllocationMatrix(prescriptionMatrix, allocationMatrix) {
  const comparison = {};
  for (const locationId of PRESCRIPTION_LOCATION_ORDER) {
    comparison[locationId] = {};
    let locationAllocTotal = 0;
    let locationPrescTotal = 0;

    for (const resourceType of RESOURCE_TYPE_ORDER) {
      const prescribed  = prescriptionMatrix[locationId]?.[resourceType] ?? 0;
      const allocated   = allocationMatrix[locationId]?.[resourceType] ?? 0;
      const gap         = computeGap(allocated, prescribed);
      const severity    = getGapSeverity(gap, prescribed);
      const deviationPct = prescribed > 0
        ? Math.abs(gap) / prescribed
        : (allocated > 0 ? 1 : 0);

      comparison[locationId][resourceType] = {
        prescribed,
        allocated,
        gap,
        severity,
        deviationPct,
        exceedsDeviationThreshold: deviationPct > DEVIATION_TRIGGER_PERCENT,
      };

      locationAllocTotal += allocated;
      locationPrescTotal += prescribed;
    }

    const locationGap = computeGap(locationAllocTotal, locationPrescTotal);
    comparison[locationId]._totals = {
      prescribed: locationPrescTotal,
      allocated:  locationAllocTotal,
      gap:        locationGap,
      severity:   getGapSeverity(locationGap, locationPrescTotal),
    };
  }
  return comparison;
}

/**
 * computeTotalAllocated()
 * Returns the total units allocated by the commander across all locations.
 *
 * @param {Object} allocationMatrix
 * @returns {number}
 */
export function computeTotalAllocated(allocationMatrix) {
  let total = 0;
  for (const locationId of PRESCRIPTION_LOCATION_ORDER) {
    for (const resourceType of RESOURCE_TYPE_ORDER) {
      total += allocationMatrix[locationId]?.[resourceType] ?? 0;
    }
  }
  return total;
}

/**
 * computeFleetRemaining()
 * How many units are unallocated (available for reserve / mobile response).
 *
 * @param {Object} allocationMatrix
 * @returns {number}
 */
export function computeFleetRemaining(allocationMatrix) {
  return Math.max(0, TOTAL_FLEET - computeTotalAllocated(allocationMatrix));
}


// ============================================================================
// LAYER 4 — EVENT-CONTEXT-AWARE READINESS SCORE
// The critical formula that prevents "Optimal during critical shortfall".
// This is the fix for GAP 1 identified in Section 6 of the spec.
// Reference: Section 8, "The Readiness Formula" — 3-step implementation
// ============================================================================

/**
 * computeWindowRequirements()
 * Computes the total resource units required per shift window,
 * after applying event severity modifiers.
 *
 * This is Step 2 of the readiness formula:
 *   New Required = Base Required × (1 + ClosureProbability × DemandMultiplier)
 *
 * @param {string}   windowId
 * @param {Object}   prescriptionMatrix  — base prescriptions (no event modifier yet)
 * @param {string[]} activeEvents
 * @returns {number} totalRequired
 */
export function computeWindowRequirements(windowId, prescriptionMatrix, activeEvents) {
  // Base: sum all prescribed units across all locations for this window context
  // The prescription matrix is already window-adjusted, so we sum all resource types
  let baseRequired = PRESCRIPTION_LOCATION_ORDER.reduce((sum, locationId) => {
    return sum + RESOURCE_TYPE_ORDER.reduce(
      (s, rt) => s + (prescriptionMatrix[locationId]?.[rt] ?? 0), 0
    );
  }, 0);

  // Apply event severity modifiers for events affecting this window
  for (const eventId of activeEvents) {
    const mapping = EVENT_WINDOW_MAPPING[eventId];
    if (!mapping) continue;
    if (!mapping.affectedWindows.includes(windowId)) continue;
    // Formula from spec: New Required = Base Required × (1 + ClosureProb × DemandMult)
    baseRequired *= (1 + mapping.closureProbability * mapping.demandMultiplier);
  }

  return Math.round(baseRequired);
}

/**
 * computeWindowAllocated()
 * Returns the total resource units allocated by commander for this window context.
 * (All units on the slider are per-shift — this sums them for the window.)
 *
 * @param {Object} allocationMatrix
 * @returns {number}
 */
export function computeWindowAllocated(allocationMatrix) {
  return computeTotalAllocated(allocationMatrix);
}

/**
 * computeReadinessScore()
 * Implements the full 3-step readiness formula from Section 8.
 *
 * Step 1 — Base Coverage Score:
 *   For each window W: Coverage(W) = min(Allocated(W) / Required(W), 1.0)
 *   Base Score = Σ [Coverage(W) × Weight(W)] × 100
 *
 * Step 2 — Event Severity Modifier applied inside computeWindowRequirements()
 *
 * Step 3 — Alert Status determination (Rule 1 override + Rule 2 thresholds)
 *
 * @param {Object}   prescriptionMatrix  — from computeAllPrescriptions()
 * @param {Object}   allocationMatrix    — commander's actual allocations
 * @param {string}   activeWindowId      — which shift is being planned
 * @param {string[]} activeEvents        — active planned events
 * @returns {Object} { score, alertStatus, rule1Triggered, shortfallDetails }
 */
export function computeReadinessScore(
  prescriptionMatrix,
  allocationMatrix,
  activeWindowId,
  activeEvents
) {
  // --- Step 1: Base Coverage Score ---
  // We compute coverage for the active window only (the one being planned).
  // The commander is allocating for one shift at a time.
  const required = computeWindowRequirements(activeWindowId, prescriptionMatrix, activeEvents);
  const allocated = computeWindowAllocated(allocationMatrix);
  const coverage = required > 0 ? Math.min(allocated / required, 1.0) : 1.0;
  const windowWeight = SHIFT_WINDOWS[activeWindowId]?.riskWeight ?? 0.2;

  // For a single-window view, the base score is simply the coverage percentage
  const baseScore = Math.round(coverage * 100);

  // --- Step 3 Rule 1: Event-Context Override ---
  // "IF any window with active planned event (closure prob >40%) has shortfall >5 units
  //  → CRITICAL GAP (overrides all other scores)"
  const shortfall = required - allocated;
  let rule1Triggered = false;
  let rule1Detail = null;

  for (const eventId of activeEvents) {
    const mapping = EVENT_WINDOW_MAPPING[eventId];
    if (!mapping) continue;
    if (!mapping.affectedWindows.includes(activeWindowId)) continue;
    if (mapping.closureProbability > HIGH_RISK_CLOSURE_PROBABILITY_THRESHOLD) {
      if (shortfall > CRITICAL_SHORTFALL_THRESHOLD) {
        rule1Triggered = true;
        rule1Detail = {
          eventId,
          closureProbability: mapping.closureProbability,
          shortfall,
          threshold: CRITICAL_SHORTFALL_THRESHOLD,
        };
        break; // First violation is enough to trigger
      }
    }
  }

  // --- Step 3 Rule 2: Threshold-based Alert Status ---
  let alertStatus;
  if (rule1Triggered) {
    alertStatus = "CRITICAL_GAP";
  } else {
    // Standard threshold ladder
    if (baseScore >= 90)      alertStatus = "OPTIMAL";
    else if (baseScore >= 75) alertStatus = "ADVISORY";
    else if (baseScore >= 60) alertStatus = "WARNING";
    else                      alertStatus = "CRITICAL_GAP";
  }

  const threshold = READINESS_THRESHOLDS[alertStatus];

  return {
    score:          baseScore,
    alertStatus,
    alertLabel:     threshold?.label ?? alertStatus,
    alertColor:     threshold?.color ?? "#FF3B30",
    rule1Triggered,
    rule1Detail,
    required,
    allocated,
    shortfall: Math.max(0, shortfall),
    surplus:   Math.max(0, -shortfall),
  };
}


// ============================================================================
// LAYER 5 — FEEDBACK LOGGER TRIGGER LOGIC
// Determines whether the deviation modal must fire before shift can be finalised.
// Reference: Section 8, "Feedback Logger — Exact Trigger Logic"
//            Section 7, Layer 5 — "The Feedback Logger"
// ============================================================================

/**
 * shouldTriggerFeedbackLogger()
 * Returns true if the commander's allocations require a deviation log entry
 * before the shift plan can be finalised.
 *
 * Trigger conditions (either is sufficient):
 *   (a) Any resource type deviates >20% from system prescription
 *   (b) Any high-risk event window (closure prob >40%) has shortfall >5 units
 *
 * @param {Object}   comparisonMatrix  — output of computeAllocationMatrix()
 * @param {Object}   readinessResult   — output of computeReadinessScore()
 * @param {string[]} activeEvents
 * @param {string}   activeWindowId
 * @returns {Object} { shouldTrigger, triggerReasons: [{type, detail}] }
 */
export function shouldTriggerFeedbackLogger(
  comparisonMatrix,
  readinessResult,
  activeEvents,
  activeWindowId
) {
  const triggerReasons = [];

  // --- Condition A: >20% deviation on any resource row ---
  for (const locationId of PRESCRIPTION_LOCATION_ORDER) {
    for (const resourceType of RESOURCE_TYPE_ORDER) {
      const cell = comparisonMatrix[locationId]?.[resourceType];
      if (!cell) continue;
      if (cell.exceedsDeviationThreshold) {
        triggerReasons.push({
          type: "DEVIATION",
          locationId,
          resourceType,
          prescribed: cell.prescribed,
          allocated:  cell.allocated,
          gap:        cell.gap,
          deviationPct: cell.deviationPct,
        });
      }
    }
  }

  // --- Condition B: High-risk event shortfall >5 units ---
  if (readinessResult.rule1Triggered) {
    triggerReasons.push({
      type: "HIGH_RISK_EVENT_SHORTFALL",
      eventId:   readinessResult.rule1Detail?.eventId,
      shortfall: readinessResult.shortfall,
      threshold: CRITICAL_SHORTFALL_THRESHOLD,
    });
  }

  return {
    shouldTrigger: triggerReasons.length > 0,
    triggerReasons,
  };
}

/**
 * buildFeedbackLogEntry()
 * Constructs the auto-captured fields for a feedback log entry.
 * The commander only inputs: deviationReason (required) and note (optional).
 * Everything else is auto-captured here.
 *
 * @param {Object} params
 * @param {string}   params.commanderId
 * @param {string}   params.station
 * @param {string}   params.shiftDate         — ISO date string
 * @param {string}   params.activeWindowId
 * @param {string}   params.weatherState
 * @param {string[]} params.activeEvents
 * @param {Object}   params.prescriptionMatrix
 * @param {Object}   params.allocationMatrix
 * @param {Object}   params.readinessResult
 * @param {Object}   params.comparisonMatrix
 * @param {string}   params.deviationReason    — commander input (required)
 * @param {string}   params.deviationNote      — commander input (optional, max 200 chars)
 * @returns {Object} feedbackLogEntry
 */
export function buildFeedbackLogEntry({
  commanderId,
  station,
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
}) {
  // Validate note length (200 char max per spec)
  const sanitisedNote = (deviationNote ?? "").slice(0, 200);

  return {
    // Auto-captured — system fields
    logId:            `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    createdAt:        new Date().toISOString(),
    commanderId:      commanderId ?? "UNKNOWN",
    station:          station ?? "UNKNOWN",
    shiftDate:        shiftDate,
    shiftWindowId:    activeWindowId,
    shiftWindowLabel: SHIFT_WINDOWS[activeWindowId]?.label ?? activeWindowId,
    weatherState,
    activeEvents,

    // System recommendation (full matrix snapshot)
    systemPrescription: JSON.parse(JSON.stringify(prescriptionMatrix)),

    // Commander's actual allocation (full matrix snapshot)
    actualAllocation: JSON.parse(JSON.stringify(allocationMatrix)),

    // Comparison summary
    comparisonSummary: {
      readinessScore: readinessResult.score,
      alertStatus:    readinessResult.alertStatus,
      required:       readinessResult.required,
      allocated:      readinessResult.allocated,
      shortfall:      readinessResult.shortfall,
    },

    // Commander-provided fields
    deviationReason,
    deviationNote: sanitisedNote,

    // Outcome fields — populated LATER from incident data (not at log creation)
    // These fields are intentionally null at creation time.
    outcome: {
      eventsHandled:           null,
      roadClosures:            null,
      medianResolutionMinutes: null,
      corridorBreakdown:       null,
      populatedAt:             null,
    },

    // Schema version — for future migration handling
    schemaVersion: "1.0",
  };
}


// ============================================================================
// UTILITY FUNCTIONS
// Shared helpers used across all layers and UI components.
// ============================================================================

/**
 * getDefaultAllocationMatrix()
 * Returns an allocation matrix pre-seeded with the prescription values.
 * Used to initialise the Deployment Planner sliders on first load.
 *
 * @param {Object} prescriptionMatrix — from computeAllPrescriptions()
 * @returns {Object} allocationMatrix
 */
export function getDefaultAllocationMatrix(prescriptionMatrix) {
  const defaults = {};
  for (const locationId of PRESCRIPTION_LOCATION_ORDER) {
    defaults[locationId] = {};
    for (const resourceType of RESOURCE_TYPE_ORDER) {
      defaults[locationId][resourceType] =
        prescriptionMatrix[locationId]?.[resourceType] ?? 0;
    }
  }
  return defaults;
}

/**
 * formatGap()
 * Returns a human-readable gap string: "+3", "-5", "±0"
 *
 * @param {number} gap
 * @returns {string}
 */
export function formatGap(gap) {
  if (gap === 0) return "±0";
  return gap > 0 ? `+${gap}` : `${gap}`;
}

/**
 * formatDeviation()
 * Returns a percentage deviation string: "25%" or "0%"
 *
 * @param {number} deviationPct — decimal, e.g. 0.25 for 25%
 * @returns {string}
 */
export function formatDeviation(deviationPct) {
  return `${Math.round(deviationPct * 100)}%`;
}

/**
 * isHighRiskEvent()
 * Returns true if the event has a closure probability above the threshold.
 * Used to determine whether Rule 1 of the readiness formula can trigger.
 *
 * @param {string} eventId
 * @returns {boolean}
 */
export function isHighRiskEvent(eventId) {
  const mapping = EVENT_WINDOW_MAPPING[eventId];
  return mapping?.isHighRisk ?? false;
}

/**
 * getActiveEventWindowConflicts()
 * Returns which active events conflict with which shift windows.
 * Used in the Situation Awareness tab to flag overlapping events.
 *
 * @param {string[]} activeEvents
 * @returns {Object} { [windowId]: [eventId, ...] }
 */
export function getActiveEventWindowConflicts(activeEvents) {
  const conflicts = {};
  for (const windowId of SHIFT_WINDOW_ORDER) {
    conflicts[windowId] = [];
  }
  for (const eventId of activeEvents) {
    const mapping = EVENT_WINDOW_MAPPING[eventId];
    if (!mapping) continue;
    for (const windowId of mapping.affectedWindows) {
      if (conflicts[windowId]) {
        conflicts[windowId].push(eventId);
      }
    }
  }
  return conflicts;
}

/**
 * getNorthStarProgress()
 * Returns the current progress toward the North Star metric.
 * The baseline is 0%; the 12-month target is 80%.
 *
 * @param {number} coveredEvents  — planned events with pre-positioned resources
 * @param {number} totalPlanned   — total known planned events in the period
 * @returns {Object} { rate, label, phaseGateMet }
 */
export function getNorthStarProgress(coveredEvents, totalPlanned) {
  if (totalPlanned === 0) return { rate: 0, label: "0%", phaseGateMet: false };
  const rate = coveredEvents / totalPlanned;
  return {
    rate,
    label:         `${Math.round(rate * 100)}%`,
    phaseGateMet:  rate >= 0.60,  // Phase 3 gate threshold
    targetMet:     rate >= 0.80,  // 12-month North Star target
  };
}

/**
 * getPlanningContextSummary()
 * Returns a human-readable summary of the current planning context.
 * Displayed in the dashboard header.
 *
 * @param {string}   windowId
 * @param {string}   weatherState
 * @param {string[]} activeEvents
 * @param {number}   month
 * @param {number}   dayOfWeek
 * @returns {string}
 */
export function getPlanningContextSummary(windowId, weatherState, activeEvents, month, dayOfWeek) {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const parts = [
    SHIFT_WINDOWS[windowId]?.label ?? windowId,
    `${dayNames[dayOfWeek]} ${monthNames[month]}`,
    WEATHER_STATES[weatherState]?.label ?? weatherState,
  ];
  if (activeEvents.length > 0) {
    parts.push(`${activeEvents.length} planned event${activeEvents.length > 1 ? "s" : ""} active`);
  }
  return parts.join(" · ");
}
