import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { BatteryCharging, Check, Fan, Pause, Play, Save, Sun, Zap } from 'lucide-react';
import {
  BatteryCapacityOption,
  EBYGAM_PRODUCTS,
  FanSizeOption,
  InverterOutputOption,
  PanelRangeOption,
  ProductVariant,
  SolarProduct,
} from '../data/catalog';
import { loadTelemetryPreset, saveTelemetryPreset } from '../lib/firebase';

interface LiveTelemetryPayload {
  timestamp: string;
  panel: {
    panelRange: string;
    nominalPanelWatts: number;
    arrayCount: number;
    singlePanelLiveWatts: number;
    totalArrayLiveWatts: number;
    irradianceWm2: number;
    cellTempC: number;
    dailyYieldKwh: number;
  };
  battery: {
    batteryCapacity: string;
    nominalKwh: number;
    voltageV: number;
    cycleRating: number;
  };
  inverter: {
    inverterOutput: string;
    ratedKw: number;
    gridTiePercent: number;
    offGridPercent: number;
    gridFrequencyHz: number;
    transferTimeMs: number;
    efficiencyCurve: Array<{
      loadPercent: number;
      dcToAcPercent: number;
      mpptPercent: number;
      thdPercent: number;
    }>;
  };
  fan: {
    fanSize: string;
    fanSpeed: number;
    powerDrawW: number;
    airflowCfm: number;
  };
  hourlyCurve: Array<{ hour: string; watts: number }>;
}

interface EnergyDashboardProps {
  user: User | null;
  onQuickAddVariant: (product: SolarProduct, variant: ProductVariant, quantity: number) => void;
  onRequireSignIn: () => void;
}

export function EnergyDashboard({
  user,
  onQuickAddVariant,
  onRequireSignIn,
}: EnergyDashboardProps) {
  const [panelRange, setPanelRange] = useState<PanelRangeOption>('550W-600W');
  const [batteryCapacity, setBatteryCapacity] = useState<BatteryCapacityOption>('10kWh');
  const [inverterOutput, setInverterOutput] = useState<InverterOutputOption>('3.5kW');
  const [fanSize, setFanSize] = useState<FanSizeOption>('20in-22in');
  const [fanSpeed, setFanSpeed] = useState<number>(3);
  const [gridTiePercent, setGridTiePercent] = useState<number>(30);
  const [batterySocPercent, setBatterySocPercent] = useState<number>(82);
  const [activeHomeLoadW, setActiveHomeLoadW] = useState<number>(850);
  const [showEfficiencyReport, setShowEfficiencyReport] = useState<boolean>(true);
  const [streaming, setStreaming] = useState<boolean>(true);

  const [telemetry, setTelemetry] = useState<LiveTelemetryPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingPreset, setSavingPreset] = useState<boolean>(false);
  const [presetSavedMsg, setPresetSavedMsg] = useState<string | null>(null);

  // Hydrate saved user telemetry preset from Firestore when signed in
  useEffect(() => {
    let cancelled = false;
    async function hydratePreset() {
      if (!user || !user.emailVerified) return;
      try {
        const saved = await loadTelemetryPreset(user.uid);
        if (saved && !cancelled) {
          setPanelRange(saved.panelRange);
          setBatteryCapacity(saved.batteryCapacity);
          setInverterOutput(saved.inverterOutput);
          setFanSize(saved.fanSize);
          setFanSpeed(saved.fanSpeed);
          setGridTiePercent(saved.gridTiePercent);
        }
      } catch (err) {
        console.error(err);
      }
    }
    void hydratePreset();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const fetchLiveTelemetry = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        panelRange,
        batteryCapacity,
        inverterOutput,
        fanSize,
        fanSpeed: String(fanSpeed),
        gridTiePercent: String(gridTiePercent),
      });
      const res = await fetch(`/api/telemetry/live?${qs.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as LiveTelemetryPayload;
        setTelemetry(data);
      }
    } catch (err) {
      console.error('Live telemetry fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [panelRange, batteryCapacity, inverterOutput, fanSize, fanSpeed, gridTiePercent]);

  useEffect(() => {
    void fetchLiveTelemetry();
    if (!streaming) return;
    const timer = window.setInterval(() => {
      void fetchLiveTelemetry();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [fetchLiveTelemetry, streaming]);

  const handleSavePreset = async () => {
    if (!user) {
      onRequireSignIn();
      return;
    }
    if (!user.emailVerified) {
      setPresetSavedMsg('Verify your email first to save presets to Firestore.');
      return;
    }
    setSavingPreset(true);
    setPresetSavedMsg(null);
    try {
      await saveTelemetryPreset(user, {
        panelRange,
        batteryCapacity,
        inverterOutput,
        fanSize,
        fanSpeed,
        gridTiePercent,
      });
      setPresetSavedMsg('Preset saved to Firestore');
      setTimeout(() => setPresetSavedMsg(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPreset(false);
    }
  };

  const handleAddConfiguredSystem = () => {
    const panelProd = EBYGAM_PRODUCTS.find((p) => p.id === 'ebygam-topcon-panel');
    const batProd = EBYGAM_PRODUCTS.find((p) => p.id === 'ebygam-lifepo4-battery');
    const invProd = EBYGAM_PRODUCTS.find((p) => p.id === 'ebygam-smart-hybrid-inverter');
    const fanProd = EBYGAM_PRODUCTS.find((p) => p.id === 'ebygam-breeze-solar-fan');

    if (panelProd) {
      const v = panelProd.variants.find((x) => x.specValue === panelRange) || panelProd.variants[1];
      onQuickAddVariant(panelProd, v, telemetry?.panel.arrayCount || 4);
    }
    if (batProd) {
      const v = batProd.variants.find((x) => x.specValue === batteryCapacity) || batProd.variants[1];
      onQuickAddVariant(batProd, v, 1);
    }
    if (invProd) {
      const v = invProd.variants.find((x) => x.specValue === inverterOutput) || invProd.variants[1];
      onQuickAddVariant(invProd, v, 1);
    }
    if (fanProd) {
      const v = fanProd.variants.find((x) => x.specValue === fanSize) || fanProd.variants[0];
      onQuickAddVariant(fanProd, v, 1);
    }
  };

  const nominalBatteryKwh =
    batteryCapacity === '15kWh' ? 15 : batteryCapacity === '5kWh' ? 5 : 10;
  const remainingBatteryKwh = Number(((nominalBatteryKwh * batterySocPercent) / 100).toFixed(2));
  const totalCombinedLoadW = activeHomeLoadW + (telemetry?.fan.powerDrawW || 20);
  const backupHours = Number(((remainingBatteryKwh * 1000) / Math.max(100, totalCombinedLoadW)).toFixed(1));

  const dailyTotalUsageKwh = Number(((totalCombinedLoadW * 24) / 1000).toFixed(1));
  const offGridKwh = Number(((dailyTotalUsageKwh * (100 - gridTiePercent)) / 100).toFixed(1));
  const gridTieKwh = Number((dailyTotalUsageKwh - offGridKwh).toFixed(1));

  const maxHourlyWatts = Math.max(
    1000,
    ...(telemetry?.hourlyCurve.map((pt) => pt.watts) || [3500])
  );

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header & Workspace Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-sky-700">
            Ebygam Solar Energy Hub · Real-Time Generation & Load Telemetry
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 [text-wrap:balance]">
            Live Solar Power, Storage & Hybrid Inverter Console
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">
            Configure solar panel wattage ranges, LiFePO4 battery banks, hybrid inverter output ratings, and DC rechargeable fan speeds to inspect real-time energy metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setStreaming((s) => !s)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {streaming ? <Pause className="w-3.5 h-3.5 text-sky-600" /> : <Play className="w-3.5 h-3.5 text-sky-600" />}
            <span>{streaming ? 'Live Telemetry Active' : 'Stream Paused'}</span>
          </button>

          <button
            type="button"
            disabled={savingPreset}
            onClick={() => void handleSavePreset()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {presetSavedMsg ? <Check className="w-3.5 h-3.5 text-sky-600" /> : <Save className="w-3.5 h-3.5 text-sky-600" />}
            <span>{presetSavedMsg || (savingPreset ? 'Saving...' : 'Save Preset')}</span>
          </button>

          <button
            type="button"
            onClick={handleAddConfiguredSystem}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Add Configured Bundle to Cart</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Live PV Array Output</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-sky-700 mt-1">
            {loading ? '—' : `${(telemetry?.panel.totalArrayLiveWatts || 0).toLocaleString()} W`}
          </p>
          <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            {telemetry?.panel.arrayCount || 6}× {panelRange} modules
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Remaining Battery Energy</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {remainingBatteryKwh} kWh
          </p>
          <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            {batterySocPercent}% of {batteryCapacity} · {backupHours} hrs autonomy
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Off-Grid Solar Self-Sufficiency</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {100 - gridTiePercent}%
          </p>
          <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            {offGridKwh} kWh off-grid · {gridTieKwh} kWh grid-tie
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">DC Fan Draw & Airflow</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {telemetry?.fan.powerDrawW || 19} W · {telemetry?.fan.airflowCfm || 980} CFM
          </p>
          <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            {fanSize === '20in-22in' ? '20"–22"' : '16"–18"'} blade · Speed {fanSpeed}/5
          </p>
        </div>
      </div>

      {/* Main 2-Column Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Module 1: Solar Panel Real-Time Power Generation */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Sun className="w-5 h-5 text-sky-600 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Solar Panel Real-Time Power Generation
                  </h2>
                  <p className="text-xs text-slate-500">
                    Irradiance {telemetry?.panel.irradianceWm2 || 905} W/m² · Cell Temp {telemetry?.panel.cellTempC || 34.2}°C · Est. {telemetry?.panel.dailyYieldKwh || 18.9} kWh/day
                  </p>
                </div>
              </div>

              {/* Segmented Power Range Filter */}
              <div className="inline-flex p-1 bg-slate-100 rounded-lg self-start">
                {(['500W-550W', '550W-600W', '600W-650W'] as PanelRangeOption[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setPanelRange(range)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      panelRange === range
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Hourly Solar Generation Bar/Curve Chart */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-xs font-medium text-slate-600">
                  Daylight PV Generation Curve (06:00 – 18:00)
                </span>
                <span className="text-xs font-mono tabular-nums text-sky-700 font-semibold">
                  Single Module Live: {telemetry?.panel.singlePanelLiveWatts || 515} W / {telemetry?.panel.nominalPanelWatts || 590} W rated
                </span>
              </div>

              <div className="h-48 flex items-end gap-2 pt-4 pb-2 px-2 bg-slate-50 rounded-lg border border-slate-200">
                {(telemetry?.hourlyCurve || []).map((pt) => {
                  const heightPct = Math.max(4, Math.round((pt.watts / maxHourlyWatts) * 100));
                  return (
                    <div key={pt.hour} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono tabular-nums text-slate-700 mb-1">
                        {pt.watts}W
                      </span>
                      <div className="w-full bg-sky-100 rounded-t relative overflow-hidden" style={{ height: `${heightPct}%` }}>
                        <div className="absolute inset-0 bg-sky-600 opacity-85 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-slate-500 mt-1.5">
                        {pt.hour.slice(0, 2)}h
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>N-Type ToPCon 22.64% cell conversion efficiency</span>
            <span className="font-mono tabular-nums">
              Updated {telemetry ? new Date(telemetry.timestamp).toLocaleTimeString() : 'Live'}
            </span>
          </div>
        </div>

        {/* Module 2: LiFePO4 Battery Capacity & Remaining Charge Indicator */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BatteryCharging className="w-5 h-5 text-sky-600 shrink-0" />
                <h2 className="text-base font-bold text-slate-900">LiFePO4 Battery Storage</h2>
              </div>

              <div className="inline-flex p-1 bg-slate-100 rounded-lg">
                {(['5kWh', '10kWh', '15kWh'] as BatteryCapacityOption[]).map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setBatteryCapacity(cap)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      batteryCapacity === cap
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </div>

            {/* Remaining Charge Visual Segmented Indicator */}
            <div className="mt-5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">Remaining Charge Indicator</span>
                <span className="text-lg font-bold font-mono tabular-nums text-sky-700">
                  {batterySocPercent}% ({remainingBatteryKwh} / {nominalBatteryKwh} kWh)
                </span>
              </div>

              <div className="grid grid-cols-10 gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                {Array.from({ length: 10 }).map((_, index) => {
                  const threshold = (index + 1) * 10;
                  const filled = batterySocPercent >= threshold - 4;
                  return (
                    <div
                      key={threshold}
                      className={`h-8 rounded transition-colors ${
                        filled ? 'bg-sky-600' : 'bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Status:{' '}
                <strong className="text-slate-800">
                  {batterySocPercent >= 60
                    ? 'Optimal Reserve'
                    : batterySocPercent >= 30
                    ? 'Moderate Reserve'
                    : 'Low Reserve — Recharge Recommended'}
                </strong>{' '}
                · Bus Voltage 51.8V DC
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="hub-soc-range" className="font-medium text-slate-700">
                    State of Charge (%)
                  </label>
                  <span className="font-mono tabular-nums text-slate-900">{batterySocPercent}%</span>
                </div>
                <input
                  id="hub-soc-range"
                  type="range"
                  min={10}
                  max={100}
                  value={batterySocPercent}
                  onChange={(e) => setBatterySocPercent(Number(e.target.value))}
                  className="w-full ebygam-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="hub-load-range" className="font-medium text-slate-700">
                    Simulated Appliance Load (W)
                  </label>
                  <span className="font-mono tabular-nums text-slate-900">{activeHomeLoadW} W</span>
                </div>
                <input
                  id="hub-load-range"
                  type="range"
                  min={150}
                  max={3500}
                  step={50}
                  value={activeHomeLoadW}
                  onChange={(e) => setActiveHomeLoadW(Number(e.target.value))}
                  className="w-full ebygam-slider"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">Estimated Backup Runtime</span>
            <span className="font-mono tabular-nums font-bold text-slate-900">
              {backupHours} hours @ {totalCombinedLoadW}W total draw
            </span>
          </div>
        </div>
      </div>

      {/* Bottom 2-Column Row: Hybrid Inverter + Solar Rechargeable Fan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Module 3: Hybrid Inverter Grid-Tie vs. Off-Grid & Toggleable Efficiency Report */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-sky-600 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Hybrid Inverter & Output Power Telemetry
                </h2>
                <p className="text-xs text-slate-500">
                  Grid-tie vs. off-grid tracking · Pure sine 50.02 Hz · &lt;10 ms UPS transfer
                </p>
              </div>
            </div>

            <div className="inline-flex p-1 bg-slate-100 rounded-lg self-start">
              {(['1.2kW', '3.5kW', '5kW'] as InverterOutputOption[]).map((out) => (
                <button
                  key={out}
                  type="button"
                  onClick={() => setInverterOutput(out)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    inverterOutput === out
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {out}
                </button>
              ))}
            </div>
          </div>

          {/* Grid-Tie vs Off-Grid Usage Stats */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-800">
                Grid-Tie vs. Off-Grid Daily Usage Distribution
              </span>
              <span className="font-mono tabular-nums text-slate-700">
                Off-Grid Solar/Battery: <strong>{100 - gridTiePercent}% ({offGridKwh} kWh)</strong> · Grid-Tie Import: <strong>{gridTiePercent}% ({gridTieKwh} kWh)</strong>
              </span>
            </div>

            <div className="w-full h-4 rounded-full bg-slate-200 overflow-hidden flex">
              <div
                className="h-full bg-sky-600 transition-all duration-150"
                style={{ width: `${100 - gridTiePercent}%` }}
                title={`Off-Grid Solar: ${100 - gridTiePercent}%`}
              />
              <div
                className="h-full bg-slate-400 transition-all duration-150"
                style={{ width: `${gridTiePercent}%` }}
                title={`Grid-Tie Utility: ${gridTiePercent}%`}
              />
            </div>

            <div className="flex items-center gap-4">
              <label htmlFor="grid-tie-slider" className="text-xs text-slate-600 whitespace-nowrap">
                Adjust Grid-Tie Share:
              </label>
              <input
                id="grid-tie-slider"
                type="range"
                min={0}
                max={100}
                value={gridTiePercent}
                onChange={(e) => setGridTiePercent(Number(e.target.value))}
                className="w-full ebygam-slider"
              />
            </div>
          </div>

          {/* Toggleable Efficiency Report */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Inverter Conversion Efficiency Report ({inverterOutput} Rated)
                </h3>
                <p className="text-xs text-slate-500">
                  DC-to-AC conversion, MPPT tracking accuracy & harmonic distortion across load bands
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showEfficiencyReport}
                onClick={() => setShowEfficiencyReport((prev) => !prev)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  showEfficiencyReport
                    ? 'bg-sky-50 border-sky-200 text-sky-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {showEfficiencyReport ? 'Hide Efficiency Report' : 'Show Efficiency Report'}
              </button>
            </div>

            {showEfficiencyReport && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 font-medium">Load Factor</th>
                      <th className="py-2 font-medium text-right">Output Load</th>
                      <th className="py-2 font-medium text-right">DC-to-AC Efficiency</th>
                      <th className="py-2 font-medium text-right">MPPT Tracking</th>
                      <th className="py-2 font-medium text-right">Waveform THD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {(telemetry?.inverter.efficiencyCurve || [
                      { loadPercent: 25, dcToAcPercent: 95.2, mpptPercent: 99.1, thdPercent: 2.4 },
                      { loadPercent: 50, dcToAcPercent: 97.1, mpptPercent: 99.6, thdPercent: 1.7 },
                      { loadPercent: 75, dcToAcPercent: 96.7, mpptPercent: 99.5, thdPercent: 1.9 },
                      { loadPercent: 100, dcToAcPercent: 95.9, mpptPercent: 99.2, thdPercent: 2.3 },
                    ]).map((row) => {
                      const ratedWatts =
                        inverterOutput === '5kW' ? 5000 : inverterOutput === '1.2kW' ? 1200 : 3500;
                      return (
                        <tr key={row.loadPercent} className="hover:bg-slate-50">
                          <td className="py-2.5 font-semibold text-slate-800">{row.loadPercent}% Rated</td>
                          <td className="py-2.5 text-right text-slate-600">
                            {Math.round((ratedWatts * row.loadPercent) / 100)} W
                          </td>
                          <td className="py-2.5 text-right font-semibold text-sky-700">
                            {row.dcToAcPercent}%
                          </td>
                          <td className="py-2.5 text-right text-slate-700">{row.mpptPercent}%</td>
                          <td className="py-2.5 text-right text-slate-600">&lt; {row.thdPercent}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Module 4: Solar Rechargeable Fan Size & Speed Control Slider */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Fan className="w-5 h-5 text-sky-600 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">DC Solar Rechargeable Fan</h2>
                  <p className="text-xs text-slate-500">Brushless DC motor & cordless battery pack</p>
                </div>
              </div>

              <div className="inline-flex p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: '16in-18in', label: '16" – 18"' },
                    { id: '20in-22in', label: '20" – 22"' },
                  ] as Array<{ id: FanSizeOption; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFanSize(opt.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      fanSize === opt.id
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="hub-fan-slider" className="text-xs font-semibold text-slate-700">
                  Fan Speed Control Slider
                </label>
                <span className="text-sm font-bold font-mono tabular-nums text-sky-700">
                  Speed {fanSpeed} / 5 ({620 + fanSpeed * 165} RPM)
                </span>
              </div>
              <input
                id="hub-fan-slider"
                type="range"
                min={1}
                max={5}
                step={1}
                value={fanSpeed}
                onChange={(e) => setFanSpeed(Number(e.target.value))}
                className="w-full ebygam-slider"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                <span>1 · Sleep</span>
                <span>2 · Eco</span>
                <span>3 · Breeze</span>
                <span>4 · Boost</span>
                <span>5 · Turbo</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Airflow Delivery</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {telemetry?.fan.airflowCfm || 980} CFM
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Power Consumption</p>
                <p className="text-lg font-bold font-mono tabular-nums text-sky-700 mt-0.5">
                  {telemetry?.fan.powerDrawW || 19} W
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Internal Battery Pack</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {Number(
                    ((fanSize === '20in-22in' ? 190 : 140) / (telemetry?.fan.powerDrawW || 19)).toFixed(1)
                  )}{' '}
                  hrs
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Acoustic Output</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {28 + fanSpeed * 4} dBA
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Includes dedicated solar charging panel + 2 LED bulbs</span>
            <span className="font-semibold text-sky-700">Remote Controlled</span>
          </div>
        </div>
      </div>
    </section>
  );
}
