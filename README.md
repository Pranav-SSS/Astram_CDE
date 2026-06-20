# ASTRAM — Command Decision Engine
### A data-driven traffic management system for Bengaluru's Urban Traffic Authority

> **Built at Flipkart GridLock 2.0 · June 2026**
> Dataset: 8,173 incidents · November 2023 – April 2024 · 46 fields · 6 corridors

---

## The Anti-Hype Statement

This project does not use a black-box AI model. Here is why, stated plainly.

When we audited the 8,173-record ASTRAM dataset, we found two structural problems that make any current ML approach counterproductive:

**Problem 1 — The junction field is 30.7% complete.** Junction-level hotspot detection is one of the most valuable things a spatial model could do. But you cannot train a reliable spatial model on a field that is empty 70% of the time. An ML model trained on this data would learn the shape of the missing data, not the shape of the traffic problem.

**Problem 2 — 100% of corridor events are marked High Priority.** This is not an exaggeration. Every single corridor event in the dataset carries the highest severity classification. A model trained on this data would learn that everything is equally urgent — which is mathematically identical to learning that nothing is urgent. Applying ML to priority-inflated data does not produce intelligence. It produces automated priority inflation.

The correct response to both problems is to fix the data first, not to build a model on top of broken data and call it AI. That is what this project does.

What we built instead: a deterministic, rule-based Command Decision Engine whose every parameter is derived from the dataset and whose every output is falsifiable. The system is designed to generate the clean, structured training data — via the Feedback Logger — that will make a legitimate supervised learning model possible in 12 months. We are not avoiding ML. We are doing the work that makes ML meaningful.

---

## What It Does

The ASTRAM CDE is a pre-shift deployment planning tool for traffic commanders. In 5 minutes before a shift starts, a commander can:

- See the **demand surface** — a heat map of expected incident density by corridor and shift window
- Review **data-calibrated prescriptions** for how many towing units, wardens, and barricade teams to stage at each static outpost
- Adjust allocations via sliders and see **live gap analysis** against the prescription
- Watch a **live readiness ring** update as allocations change
- Finalise the shift plan, which either saves cleanly or triggers the **Mandatory Deviation Log** — the mechanism that generates RLHF training data

---

## Architecture — The 5-Layer Command Decision Engine

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — DEMAND SURFACE                                        │
│  Corridor × Window heat map. Stacks historical baseline,         │
│  month/season multipliers, weather state (Dry / Rain / Monsoon), │
│  and event overlays calibrated to actual timing data.            │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2 — RESOURCE PRESCRIPTION ENGINE                          │
│  For each hot cell: outputs resource type, quantity, and staging  │
│  junction. Derived from historical resolution data, not rules.    │
│  Example: "Vehicle breakdown, Mysore Road, 5AM →                 │
│  1 towing unit at Toll Gate Mysore Road by 03:45."               │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3 — CONSTRAINT SOLVER                                     │
│  Total fleet: 50 units. When prescriptions exceed fleet,          │
│  the solver applies a priority hierarchy: planned events first,   │
│  chronic hotspots second, severity tiers third, residual          │
│  coverage fourth. Anything below threshold → Deviation Log.       │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4 — EVENT CALENDAR ENGINE                                  │
│  Directly attacks the 94.3% reactive rate. When a permit is      │
│  entered: identifies affected corridors, computes resource uplift  │
│  from historical closure probability, generates 48-hour           │
│  pre-deployment trigger. VIP movements: always Dawn + Night Peak. │
│  NOT Commuter Peak. This was the central error in the previous    │
│  simulator — fixed here with actual timing data.                  │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5 — FEEDBACK LOGGER                                        │
│  The system that builds its successor. Every shift that deviates  │
│  >20% from prescription requires a structured log entry:          │
│  reason, context, outcome. After 12 months, this log is the       │
│  training dataset for the RLHF model. The tacit knowledge of      │
│  experienced Bengaluru commanders, encoded as structured data.     │
│  No vendor can sell this. No competitor can replicate it.         │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Data Behind Every Number

Nothing in this system is invented. Every parameter traces back to a specific finding in the dataset.

| Parameter | Value | Source |
|-----------|-------|--------|
| Dead zone avg events/day | 9 | Hours 13:00–16:00 across 6 months: 49 total |
| Dawn Peak avg events/day | 520 | Hours 04:00–08:00 sum / 180 days |
| Night Peak avg events/day | 588 | Hours 21:00–24:00, highest single-window density |
| VIP Movement closure rate | 80% | 20 events, 16 road closures |
| VIP Movement time windows | Dawn + Night ONLY | Hours 01, 04, 20, 21 in actual data |
| Heavy Monsoon multiplier | 2.1× | March 2024: 1,931 events vs Nov baseline 972 |
| Mysore Road events | 743 | Primary freight corridor, SW approach |
| Mekhri Circle incidents | 64 | #1 repeat-incident junction |
| Infrastructure backlog | 1,007 events (12.3%) | 358 potholes + 195 water logging + 102 tree falls + … |
| Junction field completeness | 30.7% | 2,510 / 8,173 records |
| Priority inflation rate | 100% High Priority | Every single corridor event |
| Median resolution time | 46 minutes | Resolved events only |

---

## The Four Problems — Briefly

The system addresses four distinct problems that are usually conflated into one:

| # | Problem | Owner | Solvable Without Code? |
|---|---------|-------|------------------------|
| A | **Temporal Mismatch** — wrong shift coverage | Operations | Yes — policy memo, 30 days |
| B | **Spatial Mismatch** — dynamic patrol on chronic hotspots | Operations + Policy | Yes — static outpost mandate, 30–60 days |
| C | **Event Blindness** — planned events get no advance deployment | Policy + Technology | Partially — permit-to-deployment trigger |
| D | **Systemic Learning Failure** — 8,173 incidents, zero structural learning | Technology + Leadership | No — requires 12–18 months of clean feedback data |

**The Phase 1 and Phase 2 policy documents in `/docs` address Problems A and B without any code. They are ready for signature.**

---

## How to Run — Judges, Start Here

### Option 1: Zero-Setup Standalone Artifact (Recommended)

The fastest path to the live system — no Node.js, no terminal, no build step required.

1. Locate `astram_cde_dashboard.html` at the repository root.
2. Because modern browsers restrict external script execution on local `file://` URLs, serve it with a one-line local server:

   ```bash
   python3 -m http.server 8000
   ```

3. Open `http://localhost:8000` in any modern browser and select `astram_cde_dashboard.html`.

That is it. The full Command Decision Engine runs entirely in-browser.

### Option 2: Local Installation & Development

For technical reviewers wishing to inspect the enterprise React + Vite architecture and verify the live builds:

1. Clone the repository and navigate to the project root:

   ```bash
   git clone https://github.com/[your-org]/astram-cde
   cd astram-cde
   ```

2. Install dependencies (configured with the Tailwind CSS v4 Vite framework):

   ```bash
   npm install
   ```

3. Run the Vite development server:

   ```bash
   npm run dev
   ```

4. Open the local address shown in your terminal — typically `http://localhost:5173` — in any standard browser.

### Suggested 5-Minute Demo Sequence

1. Set **Shift → Night Peak**, **Weather → Heavy Monsoon**, toggle **VIP Movement** ON
2. Watch the readiness ring drop to **Critical Gap** — Rule 1 override fires (VIP active + shortfall > 5 units)
3. Drag the Mysore Road **Barricades** slider up — watch the ring recover in real time
4. Click **Finalise Shift Plan** — the Mandatory Deviation Log modal fires
5. Select a deviation reason, submit — the plan logs with a timestamp

Switch to the **Situation Awareness** tab to see the demand heat map update live as you change weather and event context.

---

## Project Structure

```
ASTRAM_CDE_Source_Code/
│
├── astram_cde_dashboard.html                 ← THE DEMO: open this to run the engine offline
├── README.md                                 ← Submission summary (this file)
├── Astram_Complete_Analysis_and_Roadmap.txt  ← Full methodology & analytical foundation
│
├── src/                                      ← Modular React architecture (production build)
│   ├── data/
│   │   └── lockedDataModel.js                ← All constants sourced from 8,173 records. Nothing invented.
│   ├── logic/
│   │   └── engineLogic.js                    ← Pure functions, no side effects, independently testable
│   └── components/
│       ├── AstramDashboard.jsx               ← Root component + shared state
│       ├── AstramCDE.jsx                     ← Single-file self-contained MVP
│       ├── SituationAwarenessTab.jsx         ← Tab 1: Demand heat map
│       ├── DeploymentPlannerTab.jsx          ← Tab 2: Resource allocation + gap analysis
│       ├── FeedbackLoggerModal.jsx           ← Layer 5: RLHF training data capture
│       └── NorthStarBanner.jsx               ← Persistent North Star metric strip
│
├── data/
│   └── Astram_event_data_anonymized.csv      ← Source dataset (8,173 records, 46 fields, anonymised)
│
└── docs/                                     ← Policy documents ready for signature
    ├── astram_phase1_policy_memo.docx        ← Dead zone suspension + static outpost directive
    ├── astram_phase2_it_ticket.docx          ← Mandatory field enforcement (IT change request)
    └── astram_bbmp_interagency_sla.docx      ← Infrastructure backlog inter-agency SLA
```

---

## The North Star Metric

**Planned Event Coverage Rate**: the percentage of known planned events where resources were pre-positioned before the event started.

| | |
|---|---|
| **Current baseline** | ~0% |
| **Phase 3 gate (Day 90)** | 60% |
| **12-month target** | 80% |

This metric is not inflatable: a pre-deployment either happened or it did not. It is directly measurable from existing data. It connects all four phases of the implementation roadmap. It is the single number that "transitioning from reactive to predictive traffic management" actually means in this context.

---

## The 24-Month Roadmap

| Phase | Timeline | Deliverable | Gate |
|-------|----------|-------------|------|
| **Phase 1** | Days 0–30 | Dead zone suspension memo + static outpost mandates | Dawn/Night Peak coverage ≥ 90% |
| **Phase 2** | Days 30–60 | App enforcement: Close button gated, dropdowns replace free text | Junction ≥ 85%, Reason Breakdown ≥ 80% |
| **Phase 3** | Days 60–90 | Permit-to-deployment trigger + BBMP infrastructure SLA | Planned Event Coverage ≥ 60% |
| **Phase 4 MVP** | Month 6 | CDE live in field; Feedback Logger operational | Log completion ≥ 90% of shifts |
| **Phase 4 V2** | Month 12 | Rule-based demand forecast validated | ±20% accuracy for 80% of corridor-hour cells |
| **Phase 4 V3** | Month 18–24 | RLHF model trained on 12 months of commander deviation logs | ML outperforms rule-based by ≥ 15% |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Standalone demo | Single-file HTML artifact — no bundler required |
| Data model | Vanilla JS (`lockedDataModel.js`) — all constants sourced from dataset |
| Business logic | Pure functions (`engineLogic.js`) — no side effects, independently testable |
| Policy documents | `.docx` — three documents ready for signature |
| Dataset | CSV, 8,173 records, 46 fields, anonymised |

No database. No external API. No ML model. Everything runs in the browser on deterministic logic derived from the dataset. This is intentional: field commanders at 4 AM need a tool that works offline, loads in seconds, and gives them a decision-ready number in under 5 minutes.

---

## Team

Built by Pranav SSS at Flipkart GridLock 2.0, June 2026.

---

*Dataset source: Bengaluru Urban Traffic Authority, anonymised.*
