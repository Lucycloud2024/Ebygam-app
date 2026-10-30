import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Database, Globe, Lock, RefreshCw, Server, ShieldCheck } from 'lucide-react';

interface PrecommitStage {
  stage: string;
  name: string;
  passed: boolean;
  checks: string[];
}

interface PrecommitResponse {
  allPassed: boolean;
  checkedAt: string;
  stages: PrecommitStage[];
}

type ArchNodeId = 'client-storefront' | 'client-telemetry' | 'tier2-express' | 'tier2-payment' | 'tier2-firestore';

const ARCH_NODE_DETAILS: Record<
  ArchNodeId,
  {
    tier: string;
    title: string;
    protocol: string;
    responsibilities: string[];
    codeArtifacts: string[];
  }
> = {
  'client-storefront': {
    tier: 'Tier 1 — Client Presentation Layer',
    title: 'Responsive React 19 Storefront & Auth Portal',
    protocol: 'HTTPS + Firebase Auth SDK (Google Popup & Verified Email/Password)',
    responsibilities: [
      'Renders Ebygam Solar catalog with 7 verified local product assets and zero-broken-image fallbacks.',
      'Provides Sign In and Create Account views plus customer delivery profile management.',
      'Manages cart state, variant selection (500W–650W, 5–15kWh, 1.2–5kW, 16"–22"), and responsive checkout.',
    ],
    codeArtifacts: ['src/App.tsx', 'src/components/AuthViews.tsx', 'src/components/ProductDetailModal.tsx'],
  },
  'client-telemetry': {
    tier: 'Tier 1 — Client Presentation Layer',
    title: 'Energy Hub Telemetry & Interactive Controls',
    protocol: 'REST GET /api/telemetry/live + Firestore Preset Sync',
    responsibilities: [
      'Streams daylight PV generation curves for 500W–550W, 550W–600W, and 600W–650W N-Type modules.',
      'Simulates 5kWh/10kWh/15kWh LiFePO4 battery state-of-charge and backup runtime.',
      'Tracks hybrid inverter grid-tie vs. off-grid usage split, toggleable efficiency reports, and 16"–22" fan speed sliders.',
    ],
    codeArtifacts: ['src/components/EnergyDashboard.tsx', 'src/data/catalog.ts'],
  },
  'tier2-express': {
    tier: 'Tier 2 — Application & API Server Layer',
    title: 'Express.js Application Server (Port 3000)',
    protocol: 'JSON REST API (/api/health, /api/telemetry/live, /api/precommit/status)',
    responsibilities: [
      'Serves authoritative solar irradiance, cell thermal modeling, and inverter load efficiency curves.',
      'Executes live stage-by-stage pre-commit verification checks across schemas, rules, and disk assets.',
      'Mounts Vite middleware in development and static SPA bundle in production.',
    ],
    codeArtifacts: ['server.ts', 'scripts/precommit-check.ts'],
  },
  'tier2-payment': {
    tier: 'Tier 2 — Application & Payment Verification Layer',
    title: 'Secure Payment Gateway & HMAC Signing Engine',
    protocol: 'POST /api/payments/initialize & POST /api/payments/verify',
    responsibilities: [
      'Computes order totals strictly from server-side SKU prices to prevent client-side price tampering.',
      'Enforces Luhn card checksum validation, expiry/CVV checks, and single-settlement idempotency guards.',
      'Issues HMAC-SHA256 hex verification digests stored immutably on every Firestore order document.',
    ],
    codeArtifacts: ['server.ts', 'src/components/CartAndCheckoutDrawer.tsx'],
  },
  'tier2-firestore': {
    tier: 'Tier 2 — Persistent Database & Identity Layer',
    title: 'Firebase Auth & Zero-Trust Firestore Enterprise DB',
    protocol: 'TLS gRPC / WebChannel with ANTLR4-Verified Security Rules',
    responsibilities: [
      'Isolates customer PII in split-collection /users/{uid}/private/contact with strict owner-only gates.',
      'Stores orders (/users/{uid}/orders/{orderId}) and bounded subcollection line items (/items/{itemId}).',
      'Enforces terminal state locks, server timestamps (request.time), and 14/14 Dirty Dozen payload defenses.',
    ],
    codeArtifacts: ['firebase-blueprint.json', 'firestore.rules', 'firestore.rules.test.ts', 'security_spec.md'],
  },
};

export function ArchitectureView() {
  const [selectedNode, setSelectedNode] = useState<ArchNodeId>('tier2-express');
  const [precommit, setPrecommit] = useState<PrecommitResponse | null>(null);
  const [runningCheck, setRunningCheck] = useState(false);

  const runLivePrecommit = useCallback(async () => {
    setRunningCheck(true);
    try {
      const res = await fetch('/api/precommit/status');
      if (res.ok) {
        const json = (await res.json()) as PrecommitResponse;
        setPrecommit(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunningCheck(false);
    }
  }, []);

  useEffect(() => {
    void runLivePrecommit();
  }, [runLivePrecommit]);

  const activeDetail = ARCH_NODE_DETAILS[selectedNode];

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-sky-700">
            System Engineering Blueprint · Two-Tier Web Architecture
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Ebygam Solar Architectural Diagram & Pre-Commit Gate
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">
            Click any architectural node in Tier 1 or Tier 2 below to inspect its communication protocol, data invariants, and verified pre-commit checks.
          </p>
        </div>

        <button
          type="button"
          disabled={runningCheck}
          onClick={() => void runLivePrecommit()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${runningCheck ? 'animate-spin' : ''}`} />
          <span>{runningCheck ? 'Running Checks...' : 'Run Pre-Commit Check'}</span>
        </button>
      </div>

      {/* Interactive Two-Tier Architectural Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-6">
          {/* TIER 1 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800">
                Tier 1 · Client Presentation Tier (Browser SPA — React 19 + Tailwind CSS)
              </span>
              <span className="text-xs font-mono text-slate-500">Viewport Responsive</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedNode('client-storefront')}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  selectedNode === 'client-storefront'
                    ? 'bg-white border-sky-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 text-sky-700 font-semibold text-sm">
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>Storefront, Cart & Auth UI</span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Catalog grid, Sign Up / Sign In portal, variant configurators, and slide-over cart drawer.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNode('client-telemetry')}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  selectedNode === 'client-telemetry'
                    ? 'bg-white border-sky-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 text-sky-700 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Energy Hub Telemetry Console</span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Real-time PV wattage curve, LiFePO4 SoC gauge, grid-tie vs. off-grid stats & fan speed slider.
                </p>
              </button>
            </div>
          </div>

          {/* Transport Connector */}
          <div className="py-2 flex flex-col items-center justify-center">
            <div className="h-5 w-px bg-sky-400" />
            <div className="px-4 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] font-mono text-sky-800 text-center">
              HTTPS JSON REST (/api/*) &bull; Firebase Verified JWT Bearer &amp; Atomic Batch Writes
            </div>
            <div className="h-5 w-px bg-sky-400" />
          </div>

          {/* TIER 2 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800">
                Tier 2 · Application Server & Persistent Database Tier
              </span>
              <span className="text-xs font-mono text-slate-500">Port 3000 + Firestore Enterprise</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setSelectedNode('tier2-express')}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  selectedNode === 'tier2-express'
                    ? 'bg-white border-sky-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Server className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Express API</span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Irradiance simulation, efficiency curve engine & live pre-commit runner.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNode('tier2-payment')}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  selectedNode === 'tier2-payment'
                    ? 'bg-white border-sky-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Lock className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Payment Gateway</span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Server-authoritative pricing, Luhn validation & HMAC-SHA256 receipt signing.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNode('tier2-firestore')}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  selectedNode === 'tier2-firestore'
                    ? 'bg-white border-sky-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Database className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Firestore + Auth</span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Zero-trust ABAC security rules, PII split isolation & subcollection line items.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Selected Node Inspector */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <p className="text-xs font-medium text-sky-700">{activeDetail.tier}</p>
          <h2 className="text-lg font-bold text-slate-900">{activeDetail.title}</h2>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-[11px] text-slate-500">Transport & Security Contract</p>
            <p className="text-xs font-mono text-slate-800 mt-0.5">{activeDetail.protocol}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Core Responsibilities</p>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              {activeDetail.responsibilities.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-sky-600 font-bold">&bull;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-700 mb-1.5">Verified Modules</p>
            <p className="text-xs font-mono text-slate-500">
              {activeDetail.codeArtifacts.join(' · ')}
            </p>
          </div>
        </div>
      </div>

      {/* Stage-by-Stage Pre-Commit Verification Report */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Stage-by-Stage Pre-Commit Verification Pipeline
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated gate validating schema invariants, ANTLR4 security rules, payment cryptography, and local assets
            </p>
          </div>
          {precommit && (
            <span className="text-xs font-mono tabular-nums text-sky-700 font-semibold">
              {precommit.allPassed ? 'ALL STAGES PASSED' : 'ATTENTION REQUIRED'} ·{' '}
              {new Date(precommit.checkedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(precommit?.stages || []).map((st) => (
            <div key={st.stage} className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-sky-700">{st.stage}</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{st.passed ? 'Passed' : 'Failed'}</span>
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">{st.name}</h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {st.checks.map((chk) => (
                  <li key={chk} className="flex items-start gap-2">
                    <span className="text-slate-400">&middot;</span>
                    <span>{chk}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
