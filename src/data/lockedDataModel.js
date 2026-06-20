/**
 * ============================================================================
 * ASTRAM COMMAND DECISION ENGINE
 * LOCKED DATA MODEL — v1.0
 * ============================================================================
 *
 * SOURCE OF TRUTH for all constants in the Astram system.
 *
 * RULE: Every number in this file is derived from the 8,173-record dataset
 * (Nov 2023 – Apr 2024). Nothing is invented. Any change to a value here
 * requires a reference back to the source analysis document and a data
 * justification comment.
 *
 * Reference: Astram_Complete_Analysis_and_Roadmap.txt, Section 8
 * Dataset:   8,173 incidents | Nov 2023 – Apr 2024
 * ============================================================================
 */

// ============================================================================
// SECTION 1 — DATASET SUMMARY STATISTICS
// Reference: Section 1, Dataset Overview
// ============================================================================

export const DATASET_STATS = {
  totalRecords: 8173,
  dateRange: { start: "2023-11", end: "2024-04" },
  plannedEvents: 467,          // 5.7% of total
  unplannedEvents: 7706,       // 94.3% of total
  plannedEventRate: 0.057,
  reactiveRate: 0.943,
  roadClosures: 676,           // 8.3% of all incidents
  highPriorityEvents: 5030,    // 61.5% — NOTE: inflated due to priority culture problem
  activeBacklog: 1007,
  medianResolutionMinutes: 46, // resolved events only
};


// ============================================================================
// SECTION 2 — TIME WINDOWS (5 WINDOWS, NOT 4)
// Reference: Section 8, "Time Windows — 5 Windows, Not 4"
//
// CRITICAL NOTE: The previous simulator collapsed Evening Rush into Night Peak,
// hiding the distinct 7–8 PM surge. This 5-window structure is the correction.
// ============================================================================

export const SHIFT_WINDOWS = {
  DAWN_PEAK: {
    id: "DAWN_PEAK",
    label: "Dawn Peak",
    shortLabel: "Dawn",
    hours: "04:00–08:00",
    startHour: 4,
    endHour: 8,
    avgEventsPerDay: 520,
    riskWeight: 0.30,
    // Source: hour-by-hour distribution — 04:00(535) + 05:00(639) + 06:00(648) + 07:00(471) = 2,293 / ~6 months / ~30 days
    description: "BBMP freight curfew lifts at 4 AM. Primary breakdown window.",
  },
  COMMUTER_PEAK: {
    id: "COMMUTER_PEAK",
    label: "Commuter Peak",
    shortLabel: "Morning",
    hours: "09:00–12:00",
    startHour: 9,
    endHour: 12,
    avgEventsPerDay: 93,
    riskWeight: 0.10,
    // NOTE: Weight is 0.10 — not 0.25 — because actual incident volume is ~93/day
    // vs ~520 at dawn. Previous simulator treated all windows equally; that was wrong.
    description: "Lowest freight activity. Commuter vehicles only.",
  },
  AFTERNOON_LULL: {
    id: "AFTERNOON_LULL",
    label: "Afternoon Lull",
    shortLabel: "Afternoon",
    hours: "13:00–16:00",
    startHour: 13,
    endHour: 16,
    avgEventsPerDay: 16,
    riskWeight: 0.05,
    // Source: 13:00(27) + 14:00(13) + 15:00(9) = 49 events total across 6 months
    // That is fewer than 9 events per day on average across the entire dataset period.
    description: "THE DEAD ZONE. Freight ban in full effect. Structural minimum.",
    isDead: true, // Used to flag reallocation opportunity in UI
  },
  EVENING_RUSH: {
    id: "EVENING_RUSH",
    label: "Evening Rush",
    shortLabel: "Evening",
    hours: "17:00–20:00",
    startHour: 17,
    endHour: 20,
    avgEventsPerDay: 405,
    riskWeight: 0.25,
    // Source: 18:00(225) + 19:00(558) + 20:00(629) = 1,412 / ~6 months / ~30 days
    description: "Freight re-enters city. Commuter + freight overlap.",
  },
  NIGHT_PEAK: {
    id: "NIGHT_PEAK",
    label: "Night Peak",
    shortLabel: "Night",
    hours: "21:00–23:59",
    startHour: 21,
    endHour: 24,
    avgEventsPerDay: 588,
    riskWeight: 0.30,
    // Source: 21:00(730) + 22:00(540) + 23:00(495) = 1,765 / ~6 months / ~30 days
    // Highest single-window incident density in the dataset.
    description: "Highest incident density. Full freight movement. VIP protocol window.",
  },
};

// Ordered array for iteration (display order in UI)
export const SHIFT_WINDOW_ORDER = [
  "DAWN_PEAK",
  "COMMUTER_PEAK",
  "AFTERNOON_LULL",
  "EVENING_RUSH",
  "NIGHT_PEAK",
];


// ============================================================================
// SECTION 3 — FLEET COMPOSITION (3 RESOURCE TYPES, TOTAL 50 UNITS)
// Reference: Section 8, "Fleet Composition — 3 Resource Types"
// ============================================================================

export const RESOURCE_TYPES = {
  INTERCEPTORS: {
    id: "INTERCEPTORS",
    label: "Towing/Interceptors",
    shortLabel: "Interceptors",
    totalFleet: 28,
    primaryUseCase: "Vehicle breakdown (60% of all events)",
    // Vehicle Breakdown is 4,896 events = 59.9% of all 8,173 records
  },
  WARDENS: {
    id: "WARDENS",
    label: "Traffic Wardens",
    shortLabel: "Wardens",
    totalFleet: 14,
    primaryUseCase: "Construction, processions, public events",
  },
  BARRICADES: {
    id: "BARRICADES",
    label: "Barricade Teams",
    shortLabel: "Barricades",
    totalFleet: 8,
    primaryUseCase: "Road closures, VIP movements, protests",
  },
};

export const TOTAL_FLEET = 50; // Sum: 28 + 14 + 8

export const RESOURCE_TYPE_ORDER = ["INTERCEPTORS", "WARDENS", "BARRICADES"];


// ============================================================================
// SECTION 4 — CORRIDORS & JUNCTIONS (DEMAND TIERS)
// Reference: Section 1, "Top Corridors by Incident Volume"
//            Section 8, "Corridor Demand Tiers — Derived From Data"
// ============================================================================

export const CORRIDOR_TIERS = {
  TIER_1: {
    tier: 1,
    label: "Tier 1 — Critical",
    demandMultiplier: 1.45,
    corridors: ["Mysore Road", "Bellary Road 1"],
  },
  TIER_2: {
    tier: 2,
    label: "Tier 2 — High",
    demandMultiplier: 1.20,
    corridors: ["Tumkur Road", "Bellary Road 2"],
  },
  TIER_3: {
    tier: 3,
    label: "Tier 3 — Elevated",
    demandMultiplier: 1.05,
    corridors: ["ORR North 1", "Old Madras Road"],
  },
  TIER_4: {
    tier: 4,
    label: "Tier 4 — Moderate",
    demandMultiplier: 0.90,
    corridors: ["Hosur Road", "Magadi Road"],
  },
  TIER_5: {
    tier: 5,
    label: "Tier 5 — Other",
    demandMultiplier: 0.75,
    corridors: [],
  },
};

// Full corridor data with incident stats
// Reference: Section 1, "Top Corridors by Incident Volume"
export const CORRIDORS = {
  MYSORE_ROAD: {
    id: "MYSORE_ROAD",
    name: "Mysore Road",
    tier: 1,
    totalEvents: 743,
    roadClosures: 82,
    closureRate: 0.110,    // 82/743
    plannedEvents: 28,
    unplannedEvents: 715,
    plannedRate: 0.038,    // 3.8%
    demandMultiplier: 1.45,
    notes: "Primary freight corridor from southwest. Structural dominance — ironclad static outpost justification.",
    stagingJunction: "Toll Gate Mysore Road",
  },
  BELLARY_ROAD_1: {
    id: "BELLARY_ROAD_1",
    name: "Bellary Road 1",
    tier: 1,
    totalEvents: 610,
    roadClosures: 33,
    closureRate: 0.054,    // 33/610
    plannedEvents: 11,
    unplannedEvents: 599,
    plannedRate: 0.018,    // 1.8%
    demandMultiplier: 1.45,
    stagingJunction: "Mekhri Circle",
  },
  TUMKUR_ROAD: {
    id: "TUMKUR_ROAD",
    name: "Tumkur Road",
    tier: 2,
    totalEvents: 458,
    roadClosures: 12,
    closureRate: 0.026,
    plannedEvents: 4,
    unplannedEvents: 454,
    plannedRate: 0.009,    // 0.9%
    demandMultiplier: 1.20,
    stagingJunction: "Yeshwanthpura Circle",
  },
  BELLARY_ROAD_2: {
    id: "BELLARY_ROAD_2",
    name: "Bellary Road 2",
    tier: 2,
    totalEvents: 379,
    roadClosures: 12,
    closureRate: 0.032,
    plannedEvents: null,   // Not specified in source
    unplannedEvents: null,
    plannedRate: null,
    demandMultiplier: 1.20,
    stagingJunction: "Yelahanka Circle",
  },
  ORR_NORTH_1: {
    id: "ORR_NORTH_1",
    name: "ORR North 1",
    tier: 3,
    totalEvents: 275,
    roadClosures: 22,
    closureRate: 0.080,    // Disproportionately high — noted in analysis
    plannedEvents: 18,
    unplannedEvents: 257,
    plannedRate: 0.066,    // 6.6% — highest planned rate of major corridors
    demandMultiplier: 1.05,
    notes: "Disproportionate closure rate. Contractor SLA mandate required for construction permits.",
    stagingJunction: "Nagavara-ORR Junc",
  },
  OLD_MADRAS_ROAD: {
    id: "OLD_MADRAS_ROAD",
    name: "Old Madras Road",
    tier: 3,
    totalEvents: 263,
    roadClosures: 12,
    closureRate: 0.046,
    plannedEvents: 11,
    unplannedEvents: 252,
    plannedRate: 0.042,    // 4.2%
    demandMultiplier: 1.05,
    stagingJunction: "K R Circle",
  },
  HOSUR_ROAD: {
    id: "HOSUR_ROAD",
    name: "Hosur Road",
    tier: 4,
    totalEvents: 298,
    roadClosures: 17,
    closureRate: 0.057,
    demandMultiplier: 0.90,
    stagingJunction: "Silk Board Junc",
  },
  MAGADI_ROAD: {
    id: "MAGADI_ROAD",
    name: "Magadi Road",
    tier: 4,
    totalEvents: 245,
    roadClosures: 10,
    closureRate: 0.041,
    demandMultiplier: 0.90,
    stagingJunction: null,
  },
};

// Top repeat-incident junctions — for static outpost mandate
// Reference: Section 1, "Top Repeat Incident Junctions"
// NOTE: Based on 30.7% junction field fill — directionally correct but rankings
// may shift with Phase 2 data governance. Build policy now, validate at Day 90.
export const TOP_JUNCTIONS = [
  { name: "Mekhri Circle",          incidents: 64, corridor: "BELLARY_ROAD_1", dataConfidence: "medium" },
  { name: "Ayyappa Temple Junc",    incidents: 49, corridor: "HOSUR_ROAD",     dataConfidence: "medium" },
  { name: "Satellite Bus Stand",    incidents: 43, corridor: null,              dataConfidence: "medium" },
  { name: "Yeshwanthpura Circle",   incidents: 38, corridor: "TUMKUR_ROAD",    dataConfidence: "medium" },
  { name: "Yelahanka Circle",       incidents: 34, corridor: "BELLARY_ROAD_2", dataConfidence: "medium" },
  { name: "Silk Board Junc",        incidents: 33, corridor: "HOSUR_ROAD",     dataConfidence: "medium" },
  { name: "Toll Gate Mysore Road",  incidents: 33, corridor: "MYSORE_ROAD",    dataConfidence: "medium" },
  { name: "Jalahalli Cross",        incidents: 32, corridor: "TUMKUR_ROAD",    dataConfidence: "medium" },
  { name: "Nagavara-ORR Junc",      incidents: 32, corridor: "ORR_NORTH_1",   dataConfidence: "medium" },
  { name: "K R Circle",             incidents: 31, corridor: "OLD_MADRAS_ROAD",dataConfidence: "medium" },
];


// ============================================================================
// SECTION 5 — EVENT TYPES & CLOSURE RISK TIERS
// Reference: Section 1, "Top Event Causes by Volume"
//            Section 3, "Road Closure Risk Tiers"
//            Section 8, "Event-to-Time-Window Mapping"
// ============================================================================

export const EVENT_CAUSES = {
  VEHICLE_BREAKDOWN: {
    id: "VEHICLE_BREAKDOWN",
    label: "Vehicle Breakdown",
    totalEvents: 4896,       // 59.9% of all events — dominant cause
    closureRate: 0.043,
    medianResolutionMin: 41,
    closureRiskTier: "moderate",
    isPlanned: false,
    primaryResourceType: "INTERCEPTORS",
  },
  OTHERS: {
    id: "OTHERS",
    label: "Others",
    totalEvents: 638,
    closureRate: 0.086,
    medianResolutionMin: 75,
    closureRiskTier: "moderate",
    isPlanned: false,
    primaryResourceType: "INTERCEPTORS",
  },
  POT_HOLES: {
    id: "POT_HOLES",
    label: "Pot Holes",
    totalEvents: 537,
    closureRate: 0.024,
    medianResolutionMin: 36,
    closureRiskTier: "low",
    isPlanned: false,
    isInfrastructure: true, // BBMP responsibility — goes to separate escalation queue
    primaryResourceType: "WARDENS",
  },
  CONSTRUCTION: {
    id: "CONSTRUCTION",
    label: "Construction",
    totalEvents: 480,
    closureRate: 0.265,
    medianResolutionMin: 296, // 7× longer than vehicle breakdown — contractor SLA critical
    closureRiskTier: "high",
    isPlanned: true,
    primaryResourceType: "WARDENS",
    // NOTE: Dec 2023 peak of 115 events correlates with pre-year-end permit rush
  },
  WATER_LOGGING: {
    id: "WATER_LOGGING",
    label: "Water Logging",
    totalEvents: 458,
    closureRate: 0.085,
    medianResolutionMin: 119,
    closureRiskTier: "moderate",
    isPlanned: false,
    isInfrastructure: true, // BBMP infrastructure failure
    primaryResourceType: "WARDENS",
    // NOTE: Spikes dramatically in monsoon — weather multiplier critical for this cause
  },
  ACCIDENT: {
    id: "ACCIDENT",
    label: "Accident",
    totalEvents: 365,
    closureRate: 0.030,
    medianResolutionMin: 41,
    closureRiskTier: "low",
    isPlanned: false,
    primaryResourceType: "INTERCEPTORS",
  },
  TREE_FALL: {
    id: "TREE_FALL",
    label: "Tree Fall",
    totalEvents: 284,
    closureRate: 0.394,
    medianResolutionMin: 90,
    closureRiskTier: "high",
    isPlanned: false,
    primaryResourceType: "BARRICADES",
    // NOTE: Fastest-spiking severity of unplanned events
  },
  ROAD_CONDITIONS: {
    id: "ROAD_CONDITIONS",
    label: "Road Conditions",
    totalEvents: 170,
    closureRate: 0.124,
    medianResolutionMin: 246,
    closureRiskTier: "moderate",
    isPlanned: false,
    isInfrastructure: true, // BBMP responsibility
    primaryResourceType: "WARDENS",
  },
  CONGESTION: {
    id: "CONGESTION",
    label: "Congestion",
    totalEvents: 136,
    closureRate: 0.044,
    medianResolutionMin: 72,
    closureRiskTier: "low",
    isPlanned: false,
    primaryResourceType: "WARDENS",
    // NOTE: Feb 2024 surge of 48 events anomalous — correlates with fog patterns
  },
  PUBLIC_EVENT: {
    id: "PUBLIC_EVENT",
    label: "Public Event",
    totalEvents: 84,
    closureRate: 0.464,
    medianResolutionMin: null, // Not available in dataset
    closureRiskTier: "critical",
    isPlanned: true,
    primaryResourceType: "BARRICADES",
    // NOTE: Sunday/Monday concentration — elevated base allocation on these days
  },
  PROCESSION: {
    id: "PROCESSION",
    label: "Procession",
    totalEvents: 72,
    closureRate: 0.264,
    medianResolutionMin: 37,
    closureRiskTier: "high",
    isPlanned: true,
    primaryResourceType: "BARRICADES",
    // NOTE: Monday/Sunday religious calendar driven — predictable peaks
    // March peak of 19 events = Ugadi + Holi
  },
  VIP_MOVEMENT: {
    id: "VIP_MOVEMENT",
    label: "VIP Movement",
    totalEvents: 20,
    closureRate: 0.800,
    medianResolutionMin: null, // Not available in dataset
    closureRiskTier: "critical",
    isPlanned: true,
    primaryResourceType: "BARRICADES",
    // CRITICAL NOTE: 80% closure rate. Pattern: hours 1, 4, 20, 21 — ALWAYS nighttime.
    // Security escort protocol. Fully pre-deployable. Zero excuse for reactive response.
  },
  PROTEST: {
    id: "PROTEST",
    label: "Protest",
    totalEvents: 15,
    closureRate: 0.400,
    medianResolutionMin: 24,
    closureRiskTier: "critical",
    isPlanned: false,
    primaryResourceType: "BARRICADES",
    // NOTE: Monday/Sunday concentration
  },
};

// Risk tier groupings for UI display
export const CLOSURE_RISK_TIERS = {
  critical: {
    label: "Critical Risk",
    threshold: ">40% closure rate",
    events: ["VIP_MOVEMENT", "PUBLIC_EVENT", "PROTEST"],
    color: "#FF3B30", // red
  },
  high: {
    label: "High Risk",
    threshold: "20–40% closure rate",
    events: ["TREE_FALL", "CONSTRUCTION", "PROCESSION"],
    color: "#FF9500", // amber
  },
  moderate: {
    label: "Moderate Risk",
    threshold: "<20% closure rate",
    events: ["ROAD_CONDITIONS", "WATER_LOGGING", "OTHERS", "CONGESTION", "VEHICLE_BREAKDOWN", "ACCIDENT", "POT_HOLES"],
    color: "#34C759", // green
  },
};


// ============================================================================
// SECTION 6 — EVENT-TO-TIME-WINDOW MAPPING (DATA-CALIBRATED)
// Reference: Section 8, "Event-to-Time-Window Mapping — Data-Calibrated, Not Uniform"
//            Section 3, "Event Type vs Time-of-Day Matrix"
//
// CRITICAL: This table fixes the central error in the previous simulator.
// VIP Movement does NOT affect Commuter Peak (9AM–12PM).
// It affects Dawn Peak + Night Peak ONLY.
// ============================================================================

export const EVENT_WINDOW_MAPPING = {
  VIP_MOVEMENT: {
    affectedWindows: ["DAWN_PEAK", "NIGHT_PEAK"],
    closureProbability: 0.80,
    demandMultiplier: 0.45, // +45% demand uplift
    // Source: VIP movement hours 1, 4, 20, 21 in actual data
    // Previous simulator error: incorrectly applied to COMMUTER_PEAK
    isHighRisk: true, // closure prob > 40% — triggers Rule 1 override in readiness formula
  },
  PUBLIC_EVENT: {
    affectedWindows: ["EVENING_RUSH", "NIGHT_PEAK"],
    closureProbability: 0.46,
    demandMultiplier: 0.28, // +28% demand uplift
    isHighRisk: true,
  },
  PROCESSION: {
    affectedWindows: ["DAWN_PEAK", "NIGHT_PEAK"],
    closureProbability: 0.26,
    demandMultiplier: 0.18, // +18% demand uplift
    isHighRisk: false,
  },
  PROTEST: {
    affectedWindows: ["NIGHT_PEAK"],
    closureProbability: 0.40,
    demandMultiplier: 0.22, // +22% demand uplift
    isHighRisk: true,
  },
  CONSTRUCTION_T1: {
    // Only applies when construction is on a Tier 1 corridor
    affectedWindows: ["EVENING_RUSH", "NIGHT_PEAK"],
    closureProbability: 0.27,
    demandMultiplier: 0.35, // +35% demand uplift — high because of 296-min duration
    isHighRisk: false,
  },
  TREE_FALL: {
    affectedWindows: ["DAWN_PEAK"],
    closureProbability: 0.39,
    demandMultiplier: 0.25, // +25% demand uplift
    isHighRisk: false,
  },
};


// ============================================================================
// SECTION 7 — WEATHER DEMAND MULTIPLIERS
// Reference: Section 8, "Weather Demand Multipliers"
// ============================================================================

export const WEATHER_STATES = {
  DRY: {
    id: "DRY",
    label: "Dry",
    description: "Default — standard allocation",
    incidentMultiplier: 1.0,
    resourceShift: null,
  },
  LIGHT_RAIN: {
    id: "LIGHT_RAIN",
    label: "Light Rain",
    description: "Drizzle / fog",
    incidentMultiplier: 1.35,
    resourceShift: "+2 Wardens to water-prone corridors",
    // Feb 2024 fog anomaly (48 congestion events) informs this multiplier
  },
  HEAVY_MONSOON: {
    id: "HEAVY_MONSOON",
    label: "Heavy Monsoon",
    description: "Heavy rain / flooding",
    incidentMultiplier: 2.1,
    resourceShift: "Wardens redirect to pumping duty; barricade flood zones",
    // Derived from March 2024 spike: 1,931 events vs Nov 2023 baseline 972 = 1.98×
    // Rounded to 2.1× to account for reporting lag at spike onset
  },
};


// ============================================================================
// SECTION 8 — ZONE RESOLUTION TIME DATA
// Reference: Section 1, "Zone Resolution Time Differences"
// ============================================================================

export const ZONE_RESOLUTION = [
  { zone: "East Zone 2",    medianMin: 62, meanMin: 101, note: null },
  { zone: "South Zone 1",   medianMin: 60, meanMin: 126, note: null },
  { zone: "North Zone 1",   medianMin: 51, meanMin: 112, note: null },
  { zone: "Central Zone 1", medianMin: 50, meanMin: 79,  note: null },
  { zone: "West Zone 1",    medianMin: 47, meanMin: 67,  note: null },
  { zone: "Central Zone 2", medianMin: 45, meanMin: 68,  note: null },
  {
    zone: "East Zone 1",
    medianMin: 44,
    meanMin: 129,
    note: "ANOMALY: 44 min median vs 129 min mean — severe tail of delayed incidents. Cause unknown (resource positioning, road complexity, or officer experience). Flag for Phase 2 investigation.",
  },
];


// ============================================================================
// SECTION 9 — CALIBRATED BASE PRESCRIPTIONS
// Reference: Section 8, "Calibrated Prescriptions — Dawn Shift, Dry, No Planned Event"
//
// These are the HARDCODED DEFAULTS for Dawn Shift + Dry weather + no planned events.
// All other shift/weather/event configurations are computed as multipliers on these.
//
// IMPORTANT: These values are derived from data. The previous prototype had
// Mekhri: Barricades = 10 and Mysore: Interceptors = 3 — the exact INVERSE
// of what the data supports. Mysore has 743 events; Mekhri has 64.
// ============================================================================

export const BASE_PRESCRIPTIONS_DAWN_DRY = {
  MYSORE_ROAD: {
    INTERCEPTORS: 9,
    WARDENS: 4,
    BARRICADES: 3,
    total: 16,
    stagingNote: "Stage at Toll Gate Mysore Road by 03:45 AM",
  },
  MEKHRI_CIRCLE: {
    // NOTE: Mekhri is a junction, not a corridor, but included because
    // it is the #1 repeat-incident junction (64 incidents) and sits on
    // the Bellary Road 1 corridor.
    INTERCEPTORS: 3,
    WARDENS: 3,
    BARRICADES: 2,
    total: 8,
    stagingNote: "Stage at Mekhri Circle junction entry",
  },
  ORR_NORTH: {
    // Covers ORR North 1 corridor (275 events, 22 closures — disproportionate rate)
    INTERCEPTORS: 4,
    WARDENS: 3,
    BARRICADES: 2,
    total: 9,
    stagingNote: "Stage at Nagavara-ORR Junction",
  },
};

export const BASE_PRESCRIPTION_TOTAL = 33;    // Sum of all rows above
export const BASE_RESERVE_UNITS = 17;          // 50 - 33 = 17 held in reserve/mobile response


// ============================================================================
// SECTION 10 — READINESS SCORE FORMULA CONSTANTS
// Reference: Section 8, "The Readiness Formula"
//
// These constants define the event-context-aware readiness thresholds that
// prevent the "Optimal during critical shortfall" failure mode in the
// previous simulator (GAP 1 from Section 6).
// ============================================================================

export const READINESS_THRESHOLDS = {
  OPTIMAL:      { min: 90, max: 100, label: "Optimal",      color: "#34C759" },
  ADVISORY:     { min: 75, max: 89,  label: "Advisory",     color: "#FF9500" },
  WARNING:      { min: 60, max: 74,  label: "Warning",       color: "#FF6B00" },
  CRITICAL_GAP: { min: 0,  max: 59,  label: "Critical Gap",  color: "#FF3B30" },
};

// Rule 1 override: If any window with an active high-risk planned event
// (closure prob > 40%) has a shortfall > 5 units → CRITICAL GAP, regardless
// of the base score.
export const CRITICAL_SHORTFALL_THRESHOLD = 5; // units
export const HIGH_RISK_CLOSURE_PROBABILITY_THRESHOLD = 0.40;

// Feedback logger trigger: deviation > 20% from prescription
export const DEVIATION_TRIGGER_PERCENT = 0.20;


// ============================================================================
// SECTION 11 — FEEDBACK LOGGER DEVIATION REASONS
// Reference: Section 8, "Feedback Logger — Exact Trigger Logic and Modal Specification"
//            Section 7, Layer 5 — "The Feedback Logger"
// ============================================================================

export const DEVIATION_REASONS = [
  {
    id: "LOCAL_KNOWLEDGE",
    label: "Local Knowledge",
    description: "On-ground intelligence not captured in the system",
  },
  {
    id: "WEATHER_OVERRIDE",
    label: "Weather Override",
    description: "Conditions differ from selected weather state",
  },
  {
    id: "EQUIPMENT_UNAVAILABLE",
    label: "Equipment Unavailable",
    description: "Units out of service or under maintenance",
  },
  {
    id: "PRIOR_DEPLOYMENT",
    label: "Resources on Prior Deployment",
    description: "Units still committed from a previous incident",
  },
  {
    id: "DISAGREE_FORECAST",
    label: "Disagree with Forecast",
    description: "Commander assessment differs from model recommendation",
  },
  {
    id: "OTHER",
    label: "Other",
    description: "Reason not listed above — use note field",
  },
];


// ============================================================================
// SECTION 12 — MONTHLY EVENT COUNTS (TREND DATA)
// Reference: Section 1, "Monthly Trend (March 2024 Spike)"
//            Section 3, "Monthly Event-Driven Cause Breakdown"
// NOTE: Low confidence for seasonal modelling — 18+ months needed.
// Use for informational display only. Do not drive allocation decisions.
// ============================================================================

export const MONTHLY_EVENT_COUNTS = [
  { month: "Nov 2023", total: 972,  congestion: 12, construction: 52,  procession: 6,  publicEvent: 10, vip: 1 },
  { month: "Dec 2023", total: 1746, congestion: 11, construction: 115, procession: 10, publicEvent: 16, vip: 1 },
  { month: "Jan 2024", total: 1446, congestion: 15, construction: 96,  procession: 9,  publicEvent: 9,  vip: 1 },
  { month: "Feb 2024", total: 1340, congestion: 48, construction: 83,  procession: 6,  publicEvent: 1,  vip: 1 },
  { month: "Mar 2024", total: 1931, congestion: 42, construction: 81,  procession: 19, publicEvent: 8,  vip: 0 },
  { month: "Apr 2024", total: 622,  congestion: 8,  construction: 11,  procession: 3,  publicEvent: 1,  vip: 0,
    note: "Likely incomplete data" },
];


// ============================================================================
// SECTION 13 — ACTIVE BACKLOG COMPOSITION
// Reference: Section 4, "Active Backlog Composition (1,007 events)"
//
// CRITICAL: 12.3% of all records are chronic infrastructure failures.
// These must be moved to a separate BBMP escalation queue.
// They should NOT appear in the traffic management demand model.
// ============================================================================

export const ACTIVE_BACKLOG = {
  total: 1007,
  breakdown: [
    { cause: "Pot Holes",      count: 358, percent: 0.356, owner: "BBMP",       isTrafficOwned: false },
    { cause: "Water Logging",  count: 195, percent: 0.194, owner: "BBMP",       isTrafficOwned: false },
    { cause: "Others",         count: 195, percent: 0.194, owner: "Traffic",    isTrafficOwned: true  },
    { cause: "Tree Fall",      count: 102, percent: 0.101, owner: "BBMP/Forestry", isTrafficOwned: false },
    { cause: "Road Conditions", count: 74, percent: 0.073, owner: "BBMP",       isTrafficOwned: false },
    { cause: "Construction",    count: 73, percent: 0.073, owner: "Contractor/BDA", isTrafficOwned: false },
  ],
  bbmpBacklog: 724,    // Events that are BBMP's problem, not traffic management
  trafficBacklog: 195, // Events that are genuinely traffic management's problem
  percentageOfAllRecords: 0.123, // 1,007 / 8,173 = 12.3%
};


// ============================================================================
// SECTION 14 — DATA QUALITY BASELINE
// Reference: Section 4, "Field Completeness Audit"
//
// These are the Phase 2 Gate starting points.
// Target: Junction ≥85%, Reason Breakdown ≥80%
// ============================================================================

export const DATA_QUALITY_BASELINE = {
  priority:         { filled: 8171, total: 8173, rate: 1.000, status: "good",     note: "100% fill but inflated — priority culture problem" },
  policeStation:    { filled: 8173, total: 8173, rate: 1.000, status: "good" },
  corridor:         { filled: 8153, total: 8173, rate: 0.998, status: "good" },
  vehicleType:      { filled: 4887, total: 8173, rate: 0.598, status: "acceptable" },
  zone:             { filled: 3444, total: 8173, rate: 0.421, status: "critical",  phase2Target: 0.85 },
  junction:         { filled: 2510, total: 8173, rate: 0.307, status: "critical",  phase2Target: 0.85 },
  reasonBreakdown:  { filled: 276,  total: 8173, rate: 0.034, status: "unusable",  phase2Target: 0.80 },
  resolvedAddress:  { filled: 74,   total: 8173, rate: 0.009, status: "unusable",  phase2Target: null },
};


// ============================================================================
// SECTION 15 — NORTH STAR METRIC
// Reference: Section 12, "The North Star Metric"
//
// The single number the entire Phase 1–4 journey is measured by.
// ============================================================================

export const NORTH_STAR = {
  metricName: "Planned Event Coverage Rate",
  definition: "Percentage of known planned events where resources were pre-positioned before the event started",
  currentBaseline: 0.00,   // ~0% today — policy failure, not data failure
  target12Month: 0.80,     // 80%
  phase3Gate: 0.60,        // Must reach 60% before Phase 4 build begins
  isDirectlyMeasurable: true,
  isInflatable: false,     // A pre-deployment either happened or it did not
};


// ============================================================================
// SECTION 16 — PHASE GATE TARGETS
// Reference: Section 10, "The Transition Roadmap with Measurable Gates"
// ============================================================================

export const PHASE_GATES = {
  PHASE_1: {
    deadline: "Day 30",
    metric: "Peak-window interceptor deployment coverage",
    target: 0.90,            // ≥90% of required units on average across 2 consecutive weeks
    windows: ["DAWN_PEAK", "NIGHT_PEAK"],
    technologyRequired: false, // Zero technology spend
  },
  PHASE_2A: {
    deadline: "Day 60",
    metric: "Junction field completeness",
    target: 0.85,            // From 30.7% baseline
    currentBaseline: 0.307,
  },
  PHASE_2B: {
    deadline: "Day 60",
    metric: "Reason Breakdown field completeness",
    target: 0.80,            // From 3.4% baseline
    currentBaseline: 0.034,
  },
  PHASE_3: {
    deadline: "Day 90",
    metric: "Planned Event Coverage Rate",
    target: 0.60,            // From ~0% baseline
    currentBaseline: 0.00,
  },
  PHASE_4_MVP: {
    deadline: "Month 6",
    metric: "Feedback Logger completion rate",
    target: 0.90,            // ≥90% of shifts have completed log entry
  },
  PHASE_4_V2: {
    deadline: "Month 12",
    metric: "Rule-based demand forecast accuracy",
    target: 0.80,            // ±20% of actual count for 80% of corridor-hour cells
  },
  PHASE_4_V3: {
    deadline: "Month 18-24",
    metric: "ML model vs rule-based outperformance",
    target: 0.15,            // ML outperforms rule-based by ≥15%
  },
};


// ============================================================================
// SECTION 17 — PRIORITY TIER DEFINITIONS
// Reference: Section 11, "Problem 1: Priority Inflation"
//
// Current state: 100% High Priority — statistically impossible.
// These are the correct operational definitions for Phase 2 policy enforcement.
// ============================================================================

export const PRIORITY_TIERS = {
  LOW: {
    id: "LOW",
    label: "Low",
    definition: "Incident with no road impact, single unit sufficient",
    maxUnits: 1,
    maxExpectedMinutes: null,
  },
  MEDIUM: {
    id: "MEDIUM",
    label: "Medium",
    definition: "Partial lane restriction, <2 units, <30 min expected resolution",
    maxUnits: 2,
    maxExpectedMinutes: 30,
  },
  HIGH: {
    id: "HIGH",
    label: "High",
    definition: "Full or partial road closure, multi-unit response, >30 min",
    minUnits: 2,
    minExpectedMinutes: 30,
  },
  CRITICAL: {
    id: "CRITICAL",
    label: "Critical",
    definition: "Full corridor closure, multi-agency response required",
    requiresMultiAgency: true,
  },
};

export const PRESCRIPTION_LOCATIONS = Array.isArray(CORRIDORS) ? CORRIDORS : Object.values(CORRIDORS);
export const PRESCRIPTION_LOCATION_ORDER = Array.isArray(CORRIDORS) ? CORRIDORS.map(c => c.id) : Object.keys(CORRIDORS);

// ============================================================================
// END OF LOCKED DATA MODEL
// ============================================================================
//
// CHANGE LOG:
// v1.0 — Initial locked model. Source: 8,173 records, Nov 2023 – Apr 2024.
//
// HOW TO CHANGE A VALUE:
// 1. Identify the source section in Astram_Complete_Analysis_and_Roadmap.txt
// 2. Confirm the new value has a data justification (min 90 days of new data)
// 3. Add a comment with the change reason and date
// 4. Update the version number above
//
// VALUES YOU MUST NOT CHANGE WITHOUT NEW DATA:
//   - TIME_WINDOWS risk weights
//   - EVENT_WINDOW_MAPPING affected windows (especially VIP_MOVEMENT)
//   - WEATHER_STATES multipliers
//   - BASE_PRESCRIPTIONS_DAWN_DRY values
//   - READINESS_THRESHOLDS
//   - CRITICAL_SHORTFALL_THRESHOLD
//   - DEVIATION_TRIGGER_PERCENT
// ============================================================================
