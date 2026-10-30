# Ebygam Solar — Two-Tier Clean Energy E-Commerce & Live Telemetry Platform

**Ebygam Solar** is a responsive two-tier solar e-commerce web application and real-time hardware telemetry platform built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Express.js**, and **Firebase (Authentication & Cloud Firestore Enterprise)**.

Designed with a disciplined **Sky Blue, White, and Cool Grey** visual system, Ebygam Solar enables residential and commercial customers to configure, simulate, and purchase solar hardware with cryptographic payment verification and owner-isolated cloud persistence.

---

## 1. Two-Tier System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     TIER 1 · CLIENT PRESENTATION LAYER                       │
│                   React 19 + TypeScript + Tailwind CSS v4                    │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                  │
│  │  Storefront & Variant    │  │  Energy Hub Live         │                  │
│  │  Configurator Modal      │  │  Telemetry Console       │                  │
│  └──────────────────────────┘  └──────────────────────────┘                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                  │
│  │  Sign Up / Sign In &     │  │  Slide-Over Cart &       │                  │
│  │  Delivery Profile Portal │  │  Encrypted Checkout UI   │                  │
│  └──────────────────────────┘  └──────────────────────────┘                  │
└──────────────────────┬─────────────────────────────────┬─────────────────────┘
                       │ HTTPS JSON REST (/api/*)        │ TLS WebChannel +
                       │ Server-Authoritative Pricing    │ Verified Auth JWT
                       ▼                                 ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────────┐
│  TIER 2A · APPLICATION API SERVER    │  │  TIER 2B · IDENTITY & DATA LAYER   │
│        Express.js (Port 3000)        │  │   Firebase Auth & Firestore DB     │
│                                      │  │                                    │
│  • GET  /api/health                  │  │  • /users/{userId}                 │
│  • GET  /api/telemetry/live          │  │  • /users/{userId}/private/contact │
│  • POST /api/payments/initialize     │  │  • /users/{userId}/orders/{ordId}  │
│  • POST /api/payments/verify         │  │    └─ /items/{itemId}              │
│  • GET  /api/precommit/status        │  │  • /users/{userId}/telemetryConfigs│
└──────────────────────────────────────┘  └────────────────────────────────────┘
```

---

## 2. Core Features & Hardware Telemetry Specifications

### E-Commerce Catalog & Uploaded Hardware Assets
All seven product listings use local verified hardware imagery with resilient fallback rendering:
- **Solar Panels (`Ebygam N-Type ToPCon Bifacial Solar Panel`)**:
  - Selectable wattage tiers: **`500W–550W`**, **`550W–600W`** (590W flagship), and **`600W–650W`**.
  - **Real-Time Power Generation Dashboard**: Streams live array wattage (`W`), single-module output, solar irradiance (`W/m²`), cell temperature (`°C`), and a `06:00–18:00` daylight generation curve.
- **Solar Batteries (`Ebygam PowerVault LiFePO4 Lithium Battery`)**:
  - Selectable storage capacities: **`5kWh`**, **`10kWh`**, and **`15kWh`**.
  - **Remaining Charge Indicators**: Segmented 10-cell State-of-Charge (`SoC %`) gauge, usable `kWh` readout, `51.8V` bus telemetry, and interactive appliance load autonomy calculator.
- **Hybrid Inverters (`SmartGrid Single-Phase` & `MPPT 100A Pure Sine`)**:
  - Selectable AC output ratings: **`1.2kW`**, **`3.5kW`**, and **`5kW`**.
  - **Grid-Tie vs. Off-Grid Usage Tracker**: Interactive split bar tracking daily off-grid solar/battery `kWh` autonomy versus utility grid import.
  - **Toggleable Efficiency Reports**: Switchable load table reporting DC-to-AC conversion efficiency, MPPT tracking efficiency, and harmonic distortion (`< 3% THD`) across `25%`, `50%`, `75%`, and `100%` load factors.
- **Solar Generators (`Titan Pro Rolling Station` & `Nomad Generator + Folding Array Kit`)**:
  - Selectable continuous output ratings: **`1.2kW`**, **`3.5kW`**, and **`5kW`** with toggleable inverter stage efficiency reports.
- **Solar Rechargeable Fans (`Ebygam Breeze DC Pedestal Fan Kit`)**:
  - Selectable blade diameter ranges: **`16"–18"`** and **`20"–22"`**.
  - **Speed Control Sliders**: 5-stage interactive speed slider (`Sleep` to `Turbo`) dynamically calculating `RPM`, airflow (`CFM`), brushless DC wattage draw (`W`), acoustic level (`dBA`), and cordless battery runtime.

### Customer Accounts & Authentication
- Dedicated **Sign In** and **Create Account** views supporting:
  - **One-Click Google Sign-In** (`signInWithPopup`) for immediate verified identity.
  - **Email & Password Registration / Login** with automatic verification link dispatch and inline Firebase Console setup guidance if Email/Password has not yet been toggled on in the project console.
- **Split-Collection PII Isolation**: Customer contact and shipping addresses are isolated in `/users/{uid}/private/contact`, separate from `/users/{uid}` profile metadata.

### Secure Payment Gateway
1. **Intent Initialization (`POST /api/payments/initialize`)**: Computes cart totals strictly from authoritative server-side variant prices and signs a tamper-proof challenge token.
2. **Gateway Verification (`POST /api/payments/verify`)**: Enforces Luhn checksum validation, expiry/CVV format checks (or bank transfer confirmation references), idempotency protection, and issues an `HMAC-SHA256` hex `verificationDigest`.
3. **Atomic Persistence**: Commits the verified `Order` header and bounded `/items/{itemId}` subcollection documents in a single Firestore atomic batch write.

---

## 3. Environment Configuration

Copy `.env.example` to `.env` if customizing server secrets locally:

```bash
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="http://localhost:3000"
PAYMENT_HMAC_SECRET="ebygam_solar_tier2_hmac_secret"
STRIPE_SECRET_KEY=""
```

---

## 4. Development, Pre-Commit Gate & Production Build

Install dependencies:

```bash
npm install
```

Run the **Stage-by-Stage Pre-Commit Verification Gate** (validates `README.md`, `firebase-blueprint.json`, ESLint ANTLR4 Firestore rules grammar, 14/14 Dirty Dozen security assertions, all 7 product image assets, and TypeScript compilation):

```bash
npm run precommit
```

Run individual security checks:

```bash
npm run rules:lint
npm run rules:test
npm run lint
```

Start the full-stack Two-Tier Express + Vite server on port `3000`:

```bash
npm run dev
```

Build the production client bundle and start the server:

```bash
npm run build
npm start
```

---

## 5. Project Structure

```text
├── README.md                        # System documentation & runbook
├── server.ts                        # Tier 2 Express API, payment HMAC engine & telemetry API
├── firebase-blueprint.json          # Entity & Firestore path schema blueprint
├── firestore.rules                  # Zero-trust Firestore security rules
├── firestore.rules.test.ts          # 14-assertion Dirty Dozen & authorized flow test runner
├── security_spec.md                 # Data invariants, adversarial payloads & Red Team report
├── scripts/
│   └── precommit-check.ts           # Automated multi-stage pre-commit verification script
├── public/assets/aistudio/          # Verified Ebygam Solar product photography assets
└── src/
    ├── App.tsx                      # Storefront, route shell, filtering & cart state
    ├── index.css                    # Tailwind CSS v4 typography & Sky Blue slider theme
    ├── data/catalog.ts              # Product catalog, variant specs & blueprint constraints
    ├── lib/firebase.ts              # Firebase SDK init, error handler & atomic DB helpers
    └── components/
        ├── Header.tsx               # 3-zone responsive navigation bar
        ├── AuthViews.tsx            # Sign In, Create Account & customer delivery profile
        ├── ProductDetailModal.tsx   # Product configurator & inline telemetry previews
        ├── EnergyDashboard.tsx      # Full-screen real-time solar, battery, inverter & fan hub
        ├── CartAndCheckoutDrawer.tsx# Slide-over cart & 2-step HMAC payment gateway
        ├── OrdersView.tsx           # Real-time Firestore order history & cancellation
        ├── ArchitectureView.tsx     # Interactive two-tier diagram & live pre-commit runner
        ├── ResilientProductImage.tsx# Resilient image frame with schematic fallback
        └── ErrorBoundary.tsx        # Structured runtime & Firestore error boundary
```
