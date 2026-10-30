import { useMemo, useState } from 'react';
import { BarChart3, Check, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { ProductVariant, SolarProduct } from '../data/catalog';
import { ResilientProductImage } from './ResilientProductImage';

interface ProductDetailModalProps {
  product: SolarProduct | null;
  onClose: () => void;
  onAddToCart: (product: SolarProduct, variant: ProductVariant, quantity: number) => void;
  onOpenTelemetryHub: () => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  onOpenTelemetryHub,
}: ProductDetailModalProps) {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Interactive domain-specific telemetry controls inside PDP
  const [fanSpeed, setFanSpeed] = useState(3);
  const [batteryChargePct, setBatteryChargePct] = useState(84);
  const [gridTieSharePct, setGridTieSharePct] = useState(32);
  const [showEfficiencyReport, setShowEfficiencyReport] = useState(true);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const activeVariant = useMemo(() => {
    if (!product) return null;
    return product.variants[selectedVariantIdx] || product.variants[0];
  }, [product, selectedVariantIdx]);

  if (!product || !activeVariant) return null;

  const handleAdd = () => {
    onAddToCart(product, activeVariant, quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1400);
  };

  // Computed live preview figures based on selected variant
  const panelNominalW =
    activeVariant.specValue === '600W-650W'
      ? 635
      : activeVariant.specValue === '500W-550W'
      ? 530
      : 590;
  const panelLiveWatts = Math.round(panelNominalW * 0.89);

  const batteryNominalKwh =
    activeVariant.specValue === '15kWh' ? 15 : activeVariant.specValue === '5kWh' ? 5 : 10;
  const batteryRemainingKwh = Number(((batteryNominalKwh * batteryChargePct) / 100).toFixed(2));
  const batteryRuntimeHrs = Number((batteryRemainingKwh / 0.65).toFixed(1));

  const fanIsLarge = activeVariant.specValue === '20in-22in';
  const fanDrawW = Math.round((fanIsLarge ? 9 : 6) + fanSpeed * (fanIsLarge ? 4.8 : 3.4));
  const fanAirflowCfm = Math.round((fanIsLarge ? 1150 : 820) * (0.42 + fanSpeed * 0.145));
  const fanRuntimeHrs = Number(((fanIsLarge ? 190 : 140) / fanDrawW).toFixed(1));

  const inverterKw =
    activeVariant.specValue === '5kW' ? 5.0 : activeVariant.specValue === '1.2kW' ? 1.2 : 3.5;
  const peakEff = inverterKw === 5.0 ? 97.6 : inverterKw === 3.5 ? 97.1 : 95.8;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-[1040px] w-full max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">
            {product.categoryLabel} · {product.warrantyYears}-Year Warranty · {product.efficiencyLabel}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product configurator"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-8 items-start">
          {/* Sticky Product Gallery Left */}
          <div className="lg:col-span-6 lg:sticky lg:top-20 space-y-5">
            <ResilientProductImage
              src={product.imageUrl}
              alt={product.name}
              categoryLabel={product.categoryLabel}
              className="aspect-[4/3] rounded-xl border border-slate-200"
            />

            <div className="grid grid-cols-2 gap-3 pt-2">
              {product.technicalSpecs.map((spec) => (
                <div key={spec.label} className="py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[11px] text-slate-500">{spec.label}</p>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5">{spec.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contiguous Purchase & Live Telemetry Module Right */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 leading-snug [text-wrap:balance]">
                {product.name}
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{product.shortSummary}</p>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
                  ${activeVariant.priceUsd.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">
                  In Stock · {activeVariant.highlightMetric}
                </span>
              </div>
            </div>

            {/* Variant Range Selector */}
            <div className="pt-4 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-2.5">
                Select {product.variantLabel}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {product.variants.map((variant, idx) => {
                  const selected = idx === selectedVariantIdx;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantIdx(idx)}
                      className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                        selected
                          ? 'border-sky-600 bg-sky-50/70 text-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold whitespace-nowrap truncate">{variant.label}</div>
                      <div className="text-xs font-mono tabular-nums text-sky-700 mt-0.5">
                        ${variant.priceUsd.toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Hardware-Specific Telemetry Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              {product.telemetryKind === 'panel' && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Real-Time Generation Preview ({activeVariant.specValue})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTelemetryHub();
                      }}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                    >
                      Open Live Dashboard &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-slate-500">Live Output</p>
                      <p className="text-sm font-bold font-mono tabular-nums text-sky-700 mt-0.5">
                        {panelLiveWatts} W
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-slate-500">Irradiance</p>
                      <p className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                        915 W/m²
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-slate-500">Daily Harvest</p>
                      <p className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                        {((panelNominalW * 5.3) / 1000).toFixed(2)} kWh
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {product.telemetryKind === 'battery' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Remaining Charge Indicator ({activeVariant.specValue})
                    </span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-sky-700">
                      {batteryChargePct}% SoC · {batteryRemainingKwh} kWh
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-600 transition-transform duration-150 origin-left"
                      style={{ transform: `scaleX(${batteryChargePct / 100})` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label htmlFor="pdp-soc-slider" className="text-xs text-slate-600 whitespace-nowrap">
                      Simulate State of Charge:
                    </label>
                    <input
                      id="pdp-soc-slider"
                      type="range"
                      min={10}
                      max={100}
                      value={batteryChargePct}
                      onChange={(e) => setBatteryChargePct(Number(e.target.value))}
                      className="w-full ebygam-slider"
                    />
                  </div>
                  <p className="text-xs text-slate-600 font-mono tabular-nums">
                    Estimated autonomy @ 650W home load: <strong className="text-slate-900">{batteryRuntimeHrs} hrs</strong>
                  </p>
                </div>
              )}

              {product.telemetryKind === 'fan' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Interactive Speed Control Slider ({activeVariant.label})
                    </span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-sky-700">
                      Level {fanSpeed} / 5
                    </span>
                  </div>
                  <input
                    aria-label="Fan speed level"
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={fanSpeed}
                    onChange={(e) => setFanSpeed(Number(e.target.value))}
                    className="w-full ebygam-slider"
                  />
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <p className="text-[11px] text-slate-500">Airflow</p>
                      <p className="text-xs font-bold font-mono tabular-nums text-slate-900">
                        {fanAirflowCfm} CFM
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <p className="text-[11px] text-slate-500">Motor Draw</p>
                      <p className="text-xs font-bold font-mono tabular-nums text-sky-700">
                        {fanDrawW} W
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <p className="text-[11px] text-slate-500">Cordless Run</p>
                      <p className="text-xs font-bold font-mono tabular-nums text-slate-900">
                        {fanRuntimeHrs} hrs
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(product.telemetryKind === 'inverter' || product.telemetryKind === 'generator') && (
                <div className="space-y-3">
                  {product.telemetryKind === 'inverter' && (
                    <div className="space-y-2 pb-3 border-b border-slate-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">Grid-Tie vs. Off-Grid Usage Split</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          {gridTieSharePct}% Grid-Tie · {100 - gridTieSharePct}% Off-Grid Solar
                        </span>
                      </div>
                      <input
                        aria-label="Grid-tie versus off-grid usage ratio"
                        type="range"
                        min={0}
                        max={100}
                        value={gridTieSharePct}
                        onChange={(e) => setGridTieSharePct(Number(e.target.value))}
                        className="w-full ebygam-slider"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-sky-600" />
                      Output Efficiency Report ({activeVariant.specValue})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEfficiencyReport((prev) => !prev)}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                    >
                      {showEfficiencyReport ? 'Hide Report' : 'Show Report'}
                    </button>
                  </div>

                  {showEfficiencyReport && (
                    <div className="grid grid-cols-4 gap-2 text-center pt-1">
                      {[
                        { load: '25%', eff: (peakEff - 1.9).toFixed(1) },
                        { load: '50%', eff: peakEff.toFixed(1) },
                        { load: '75%', eff: (peakEff - 0.4).toFixed(1) },
                        { load: '100%', eff: (peakEff - 1.2).toFixed(1) },
                      ].map((row) => (
                        <div key={row.load} className="bg-white border border-slate-200 rounded-lg p-2">
                          <p className="text-[11px] text-slate-500">{row.load} Load</p>
                          <p className="text-xs font-bold font-mono tabular-nums text-sky-700 mt-0.5">
                            {row.eff}%
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quantity & Primary Add-to-Cart Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="inline-flex items-center justify-between border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold font-mono tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {addedFeedback ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Cart</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      Add to Cart · ${(activeVariant.priceUsd * quantity).toLocaleString()}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
