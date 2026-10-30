export type ProductCategory =
  | 'solar-panels'
  | 'solar-batteries'
  | 'solar-inverters'
  | 'solar-generators'
  | 'solar-fans';

export type PanelRangeOption = '500W-550W' | '550W-600W' | '600W-650W';
export type BatteryCapacityOption = '5kWh' | '10kWh' | '15kWh';
export type InverterOutputOption = '1.2kW' | '3.5kW' | '5kW';
export type FanSizeOption = '16in-18in' | '20in-22in';

export interface ProductVariant {
  id: string;
  label: string;
  specValue: string;
  priceUsd: number;
  highlightMetric: string;
}

export interface SolarProduct {
  id: string;
  name: string;
  category: ProductCategory;
  categoryLabel: string;
  imageUrl: string;
  shortSummary: string;
  warrantyYears: number;
  efficiencyLabel: string;
  variantLabel: string;
  variants: ProductVariant[];
  technicalSpecs: Array<{ label: string; value: string }>;
  telemetryKind: 'panel' | 'battery' | 'inverter' | 'generator' | 'fan';
}

// Strict Blueprint Validation Constants (synced verbatim with firebase-blueprint.json & firestore.rules)
export const BLUEPRINT_CONSTRAINTS = {
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  HEX_REGEX: /^[a-fA-F0-9]+$/,
  UID_MAX: 128,
  SHORT_ID_MAX: 64,
  DISPLAY_NAME_MAX: 80,
  EMAIL_MAX: 120,
  PHONE_MIN: 5,
  PHONE_MAX: 30,
  ADDRESS_MIN: 3,
  ADDRESS_MAX: 200,
  CITY_MIN: 2,
  CITY_MAX: 80,
  SUMMARY_MAX: 240,
  PRODUCT_NAME_MAX: 120,
  SELECTED_SPEC_MAX: 80,
  MAX_ORDER_ITEMS: 50,
} as const;

export const EBYGAM_PRODUCTS: SolarProduct[] = [
  {
    id: 'ebygam-topcon-panel',
    name: 'Ebygam N-Type ToPCon Bifacial Solar Panel',
    category: 'solar-panels',
    categoryLabel: 'Solar Panels',
    imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-30_at_11.02.28_AM_e7fb09c3.jpeg',
    shortSummary:
      'High-density N-Type ToPCon monocrystalline solar module engineered for low-irradiance morning harvest and 30-year linear output stability.',
    warrantyYears: 30,
    efficiencyLabel: '22.64% Efficiency',
    variantLabel: 'Power Output Range',
    telemetryKind: 'panel',
    variants: [
      {
        id: 'panel-500-550',
        label: '500W – 550W',
        specValue: '500W-550W',
        priceUsd: 215,
        highlightMetric: '2.75 kWh avg daily yield',
      },
      {
        id: 'panel-550-600',
        label: '550W – 600W (590W Rated)',
        specValue: '550W-600W',
        priceUsd: 245,
        highlightMetric: '3.15 kWh avg daily yield',
      },
      {
        id: 'panel-600-650',
        label: '600W – 650W',
        specValue: '600W-650W',
        priceUsd: 285,
        highlightMetric: '3.48 kWh avg daily yield',
      },
    ],
    technicalSpecs: [
      { label: 'Cell Architecture', value: 'N-Type ToPCon 144 Half-Cut' },
      { label: 'Conversion Efficiency', value: '22.64%' },
      { label: 'Linear Performance Warranty', value: '30 Years' },
      { label: 'Junction Protection', value: 'IP68 Rated · MC4 Connectors' },
    ],
  },
  {
    id: 'ebygam-lifepo4-battery',
    name: 'Ebygam PowerVault LiFePO4 Lithium Battery',
    category: 'solar-batteries',
    categoryLabel: 'Solar Batteries',
    imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-30_at_10.16.18_AM_87329b1a.jpeg',
    shortSummary:
      'Floor-standing Lithium Iron Phosphate (LiFePO4) deep-cycle storage cabinet with integrated smart BMS telemetry screen and heavy-duty side handles.',
    warrantyYears: 10,
    efficiencyLabel: '98% Round-Trip',
    variantLabel: 'Storage Capacity',
    telemetryKind: 'battery',
    variants: [
      {
        id: 'bat-5kwh',
        label: '5kWh Bank',
        specValue: '5kWh',
        priceUsd: 1190,
        highlightMetric: '5,120 Wh nominal · 100Ah @ 51.2V',
      },
      {
        id: 'bat-10kwh',
        label: '10kWh Bank',
        specValue: '10kWh',
        priceUsd: 2180,
        highlightMetric: '10,240 Wh nominal · 200Ah @ 51.2V',
      },
      {
        id: 'bat-15kwh',
        label: '15kWh Bank',
        specValue: '15kWh',
        priceUsd: 3090,
        highlightMetric: '15,360 Wh nominal · 300Ah @ 51.2V',
      },
    ],
    technicalSpecs: [
      { label: 'Chemistry', value: 'Automotive-Grade Prismatic LiFePO4' },
      { label: 'Cycle Life', value: '6,000+ Cycles @ 80% DoD' },
      { label: 'BMS Protection', value: 'Over-charge, Thermal & Short-Circuit' },
      { label: 'Communication', value: 'CAN / RS485 Smart Inverter Sync' },
    ],
  },
  {
    id: 'ebygam-smart-hybrid-inverter',
    name: 'Ebygam SmartGrid Single-Phase Hybrid Inverter',
    category: 'solar-inverters',
    categoryLabel: 'Hybrid Inverters',
    imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-30_at_10.16.17_AM__3__0a4b589f.jpeg',
    shortSummary:
      'Intelligent wall-mounted hybrid solar inverter featuring a graphical clear display, seamless grid-tie export control, and sub-10ms off-grid backup transfer.',
    warrantyYears: 5,
    efficiencyLabel: '97.6% Peak Efficiency',
    variantLabel: 'AC Output Power',
    telemetryKind: 'inverter',
    variants: [
      {
        id: 'inv-smart-1-2kw',
        label: '1.2kW Output',
        specValue: '1.2kW',
        priceUsd: 460,
        highlightMetric: 'Essential lighting, fans & workstation load',
      },
      {
        id: 'inv-smart-3-5kw',
        label: '3.5kW Output',
        specValue: '3.5kW',
        priceUsd: 780,
        highlightMetric: 'Full residential refrigeration & AC load',
      },
      {
        id: 'inv-smart-5kw',
        label: '5kW Output',
        specValue: '5kW',
        priceUsd: 1120,
        highlightMetric: 'Heavy residential & commercial hybrid load',
      },
    ],
    technicalSpecs: [
      { label: 'Phase Topology', value: 'Single Phase · Pure Sine Wave' },
      { label: 'Operating Modes', value: 'Grid-Tie, Off-Grid & Hybrid Priority' },
      { label: 'Transfer Time', value: '< 10 ms Uninterruptible UPS Grade' },
      { label: 'Control Interface', value: 'High-Contrast Graphical Clear LCD' },
    ],
  },
  {
    id: 'ebygam-mppt-100a-inverter',
    name: 'Ebygam MPPT 100A Pure Sine Hybrid Inverter',
    category: 'solar-inverters',
    categoryLabel: 'Hybrid Inverters',
    imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-30_at_10.16.16_AM_9ef80db8.jpeg',
    shortSummary:
      'High-voltage PV input (40–500VDC) hybrid inverter with integrated 100A MPPT solar charge controller, 4-stage LED status indicators, and tactile navigation keys.',
    warrantyYears: 5,
    efficiencyLabel: '96.8% Euro Efficiency',
    variantLabel: 'AC Output Power',
    telemetryKind: 'inverter',
    variants: [
      {
        id: 'inv-mppt-1-2kw',
        label: '1.2kW Output (24V)',
        specValue: '1.2kW',
        priceUsd: 420,
        highlightMetric: '80A MPPT · 220–240 VAC pure sine',
      },
      {
        id: 'inv-mppt-3-5kw',
        label: '3.5kW Output (3600W Rated)',
        specValue: '3.5kW',
        priceUsd: 695,
        highlightMetric: '100A MPPT · 40–500VDC PV input',
      },
      {
        id: 'inv-mppt-5kw',
        label: '5kW Output (48V)',
        specValue: '5kW',
        priceUsd: 990,
        highlightMetric: '100A MPPT · Dual AC load support',
      },
    ],
    technicalSpecs: [
      { label: 'PV Input Voltage', value: '40 ~ 500 VDC Wide MPPT Window' },
      { label: 'AC Output Voltage', value: '208 / 220 / 230 / 240 VAC' },
      { label: 'Solar Controller', value: '100A MPPT Integrated' },
      { label: 'Chassis Dimensions', value: '490 × 306 × 115 mm' },
    ],
  },
  {
    id: 'ebygam-titan-solar-generator',
    name: 'Ebygam Titan Pro Rolling Solar Generator',
    category: 'solar-generators',
    categoryLabel: 'Solar Generators',
    imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-30_at_10.16.17_AM__2__0ca75b52.jpeg',
    shortSummary:
      'All-in-one wheeled portable solar generator station with weather-sealed AC sockets, real-time digital SoC readout, reinforced corner bumpers, and rear trolley handle.',
    warrantyYears: 5,
    efficiencyLabel: '95.4% Inverter Stage',
    variantLabel: 'Continuous Output Power',
    telemetryKind: 'generator',
    variants: [
      {
        id: 'gen-titan-1-2kw',
        label: '1.2kW Station',
        specValue: '1.2kW',
        priceUsd: 890,
        highlightMetric: '2.4kW surge · 4× AC outlets',
      },
      {
        id: 'gen-titan-3-5kw',
        label: '3.5kW Station',
        specValue: '3.5kW',
        priceUsd: 1790,
        highlightMetric: '7.0kW surge · Whole-room backup',
      },
      {
        id: 'gen-titan-5kw',
        label: '5kW Station',
        specValue: '5kW',
        priceUsd: 2590,
        highlightMetric: '10kW surge · Heavy appliance ready',
      },
    ],
    technicalSpecs: [
      { label: 'Mobility', value: '360° Heavy-Duty Swivel Lock Casters' },
      { label: 'Display', value: 'Smart Wattage, SoC % & Runtime Remaining' },
      { label: 'Output Ports', value: 'Pure Sine AC, USB-C PD 100W, 12V DC' },
      { label: 'Acoustic Profile', value: 'Zero-Fume Silent Indoor Operation' },
    ],
  },
  {
    id: 'ebygam-nomad-generator-bundle',
    name: 'Ebygam Nomad Generator & Folding Array Kit',
    category: 'solar-generators',
    categoryLabel: 'Solar Generators',
    imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-30_at_10.16.17_AM__1__41de2a9a.jpeg',
    shortSummary:
      'Complete off-grid mobile power kit pairing the Ebygam wheeled LiFePO4 generator with a collapsible 4-panel monocrystalline solar charging blanket.',
    warrantyYears: 5,
    efficiencyLabel: '95.8% MPPT Harvest',
    variantLabel: 'Continuous Output Power',
    telemetryKind: 'generator',
    variants: [
      {
        id: 'gen-nomad-1-2kw',
        label: '1.2kW Kit + 400W Folding Array',
        specValue: '1.2kW',
        priceUsd: 1180,
        highlightMetric: '3.5 hr full solar recharge',
      },
      {
        id: 'gen-nomad-3-5kw',
        label: '3.5kW Kit + 800W Folding Array',
        specValue: '3.5kW',
        priceUsd: 2150,
        highlightMetric: '4.2 hr full solar recharge',
      },
      {
        id: 'gen-nomad-5kw',
        label: '5kW Kit + 1200W Folding Array',
        specValue: '5kW',
        priceUsd: 2980,
        highlightMetric: '4.5 hr full solar recharge',
      },
    ],
    technicalSpecs: [
      { label: 'Included Array', value: 'Foldable 4-Section Kickstand Solar Panel' },
      { label: 'Transport', value: 'Telescopic Pull Handle + Swivel Wheels' },
      { label: 'Battery Core', value: 'Internal LiFePO4 4,000+ Cycle Pack' },
      { label: 'Weather Rating', value: 'IP65 Laminated ETFE Solar Blanket' },
    ],
  },
  {
    id: 'ebygam-breeze-solar-fan',
    name: 'Ebygam Breeze DC Solar Rechargeable Fan Kit',
    category: 'solar-fans',
    categoryLabel: 'Rechargeable Fans',
    imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-30_at_10.16.17_AM_6f338201.jpeg',
    shortSummary:
      'Whisper-quiet brushless DC standing solar rechargeable fan bundled with a dedicated solar panel, 2 external LED bulbs, built-in night lamp, and wireless remote.',
    warrantyYears: 2,
    efficiencyLabel: 'Brushless 18W DC Motor',
    variantLabel: 'Blade Diameter Range',
    telemetryKind: 'fan',
    variants: [
      {
        id: 'fan-16-18',
        label: '16" – 18" Pedestal Kit',
        specValue: '16in-18in',
        priceUsd: 95,
        highlightMetric: 'Up to 18 hrs cordless cooling',
      },
      {
        id: 'fan-20-22',
        label: '20" – 22" High-Velocity Kit',
        specValue: '20in-22in',
        priceUsd: 128,
        highlightMetric: 'High-CFM wide room oscillation',
      },
    ],
    technicalSpecs: [
      { label: 'Included Accessories', value: 'Solar Panel + 2× LED Bulbs + IR Remote' },
      { label: 'Speed Control', value: 'Variable Stepless / 5-Stage Digital Slider' },
      { label: 'Dual Charging', value: 'DC Solar Panel Port + AC Wall Adapter' },
      { label: 'Auxiliary Features', value: 'Integrated Column LED Light + USB Phone Port' },
    ],
  },
];

export function sanitizeText(input: string, maxLen: number): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}
