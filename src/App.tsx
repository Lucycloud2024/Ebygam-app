/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { ArrowRight, Check, Search, SlidersHorizontal } from 'lucide-react';
import {
  EBYGAM_PRODUCTS,
  ProductCategory,
  ProductVariant,
  SolarProduct,
} from './data/catalog';
import { auth, ensureUserProfileDocument } from './lib/firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ActiveRoute, Header } from './components/Header';
import { ResilientProductImage } from './components/ResilientProductImage';
import { ProductDetailModal } from './components/ProductDetailModal';
import { EnergyDashboard } from './components/EnergyDashboard';
import { ArchitectureView } from './components/ArchitectureView';
import { AuthViews } from './components/AuthViews';
import { CartAndCheckoutDrawer, CartItem } from './components/CartAndCheckoutDrawer';
import { OrdersView } from './components/OrdersView';

const CATEGORY_FILTERS: Array<{ id: 'all' | ProductCategory; label: string }> = [
  { id: 'all', label: 'All Hardware' },
  { id: 'solar-panels', label: 'Solar Panels' },
  { id: 'solar-batteries', label: 'Solar Batteries' },
  { id: 'solar-inverters', label: 'Hybrid Inverters' },
  { id: 'solar-generators', label: 'Solar Generators' },
  { id: 'solar-fans', label: 'Rechargeable Fans' },
];

export default function App() {
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>('catalog');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');
  const [user, setUser] = useState<User | null>(null);

  // Catalog filtering & variant state per card
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<Record<string, number>>({
    'ebygam-topcon-panel': 1, // 550W-600W default
    'ebygam-lifepo4-battery': 1, // 10kWh default
    'ebygam-smart-hybrid-inverter': 1, // 3.5kW default
    'ebygam-mppt-100a-inverter': 1, // 3.5kW default
    'ebygam-titan-solar-generator': 1,
    'ebygam-nomad-generator-bundle': 1,
    'ebygam-breeze-solar-fan': 1,
  });

  // Modals & Cart state
  const [inspectedProduct, setInspectedProduct] = useState<SolarProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [recentlyAddedVariantId, setRecentlyAddedVariantId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.emailVerified) {
        void ensureUserProfileDocument(firebaseUser).catch((err) => console.error(err));
      }
    });
    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return EBYGAM_PRODUCTS.filter((p) => {
      const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        p.shortSummary.toLowerCase().includes(q) ||
        p.variants.some((v) => v.label.toLowerCase().includes(q))
      );
    });
  }, [categoryFilter, searchQuery]);

  const totalCartCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems]
  );

  const handleAddToCart = (product: SolarProduct, variant: ProductVariant, quantity = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((it) => it.variant.id === variant.id);
      if (existing) {
        return prev.map((it) =>
          it.variant.id === variant.id
            ? { ...it, quantity: Math.min(50, it.quantity + quantity) }
            : it
        );
      }
      return [...prev, { product, variant, quantity }];
    });
    setRecentlyAddedVariantId(variant.id);
    setTimeout(() => {
      setRecentlyAddedVariantId((cur) => (cur === variant.id ? null : cur));
    }, 1300);
  };

  const handleUpdateCartQty = (variantId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((it) =>
          it.variant.id === variantId ? { ...it, quantity: it.quantity + delta } : it
        )
        .filter((it) => it.quantity > 0)
    );
  };

  const handleRemoveCartItem = (variantId: string) => {
    setCartItems((prev) => prev.filter((it) => it.variant.id !== variantId));
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-white text-slate-900">
        <Header
          activeRoute={activeRoute}
          onNavigate={setActiveRoute}
          cartCount={totalCartCount}
          onOpenCart={() => setCartOpen(true)}
          user={user}
        />

        <main className="flex-1">
          {activeRoute === 'catalog' && (
            <>
              {/* Section 1: Storefront Hero */}
              <section className="bg-gradient-to-b from-sky-50/75 via-slate-50/50 to-white border-b border-slate-200">
                <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 lg:py-16 space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                    {/* Left Copy Column */}
                    <div className="lg:col-span-7 flex flex-col justify-center">
                      <p className="text-xs sm:text-sm font-medium text-sky-700">
                        Ebygam Solar · Residential &amp; Commercial Clean Energy Systems
                      </p>
                      <h1 className="mt-3 text-[clamp(2.2rem,3.8vw,3.5rem)] font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
                        Engineered solar power built for uninterrupted independence.
                      </h1>
                      <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                        Shop N-Type ToPCon solar panels, floor-standing LiFePO4 battery banks, single-phase hybrid inverters, rolling solar generators, and brushless DC rechargeable fans—backed by real-time power telemetry.
                      </p>

                      <div className="mt-8 flex flex-wrap items-center gap-3.5">
                        <a
                          href="#hardware-catalog"
                          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>Shop Solar Hardware</span>
                          <ArrowRight className="w-4 h-4" />
                        </a>

                        <button
                          type="button"
                          onClick={() => setActiveRoute('dashboard')}
                          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <span>Live Power Dashboard</span>
                        </button>

                        {!user && (
                          <button
                            type="button"
                            onClick={() => {
                              setAuthInitialMode('signup');
                              setActiveRoute('auth');
                            }}
                            className="px-4 py-3 text-sm font-medium text-sky-700 hover:text-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Create Account &rarr;
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right Featured Hardware Showcase */}
                    <div className="lg:col-span-5">
                      <div className="h-full bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                        <ResilientProductImage
                          src="/assets/aistudio/WhatsApp_Image_2026-10-30_at_10.16.17_AM__1__41de2a9a.jpeg"
                          alt="Ebygam Nomad Generator & Folding Array Kit"
                          categoryLabel="Solar Generators"
                          className="aspect-[4/3] rounded-lg border border-slate-100"
                        />
                        <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs text-slate-500">
                              Featured Off-Grid Bundle · 1.2kW to 5kW
                            </p>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">
                              Ebygam Nomad Generator &amp; Folding Solar Array
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setInspectedProduct(
                                EBYGAM_PRODUCTS.find(
                                  (p) => p.id === 'ebygam-nomad-generator-bundle'
                                ) || EBYGAM_PRODUCTS[0]
                              )
                            }
                            className="px-3.5 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Configure
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full-Width 4-Column Quantitative Specification Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-slate-200/80">
                    <div>
                      <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                        500W – 650W
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        N-Type ToPCon panels · 22.64% cell efficiency
                      </p>
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                        5 / 10 / 15 kWh
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        LiFePO4 storage banks · 6,000+ deep cycles
                      </p>
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                        1.2 / 3.5 / 5 kW
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Hybrid pure-sine inverters · &lt;10 ms UPS transfer
                      </p>
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                        16&Prime; – 22&Prime; DC
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Solar rechargeable pedestal fans + LED kit
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Featured Ebygam Solar Product Catalog */}
              <section id="hardware-catalog" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-14 space-y-8">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                      Ebygam Solar Hardware Collection
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Select wattage, storage capacity, or blade diameter directly on any product or open its live telemetry configurator.
                    </p>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full lg:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      aria-label="Search solar products"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search panels, batteries, fans..."
                      className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-sky-600"
                    />
                  </div>
                </div>

                {/* Interactive Segmented Category Filter Bar */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {CATEGORY_FILTERS.map((cat) => {
                    const active = categoryFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-white text-sky-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* 3-Column Uniform Product Grid */}
                {filteredProducts.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-sm font-semibold text-slate-800">
                      No matching Ebygam Solar hardware found
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try clearing your search term or selecting All Hardware.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter('all');
                        setSearchQuery('');
                      }}
                      className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {filteredProducts.map((product) => {
                      const variantIdx = selectedVariantByProduct[product.id] ?? 0;
                      const currentVariant = product.variants[variantIdx] || product.variants[0];
                      const isJustAdded = recentlyAddedVariantId === currentVariant.id;

                      return (
                        <article
                          key={product.id}
                          className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5"
                        >
                          <div
                            onClick={() => setInspectedProduct(product)}
                            className="cursor-pointer"
                          >
                            <ResilientProductImage
                              src={product.imageUrl}
                              alt={product.name}
                              categoryLabel={product.categoryLabel}
                              className="aspect-[4/3] border-b border-slate-100"
                            />
                          </div>

                          <div className="p-5 flex-1 flex flex-col justify-between space-y-5">
                            <div className="space-y-2.5">
                              {/* Unboxed Zero-Pill Metadata */}
                              <p className="text-xs text-slate-500">
                                <span>{product.categoryLabel}</span>
                                <span aria-hidden="true"> &middot; </span>
                                <span>{product.warrantyYears}-Yr Warranty</span>
                                <span aria-hidden="true"> &middot; </span>
                                <span>{product.efficiencyLabel}</span>
                              </p>

                              <h3
                                onClick={() => setInspectedProduct(product)}
                                className="text-base font-bold text-slate-900 leading-snug hover:text-sky-700 transition-colors cursor-pointer"
                              >
                                {product.name}
                              </h3>

                              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                {product.shortSummary}
                              </p>

                              {/* Inline Interactive Variant Selector */}
                              <div className="pt-2">
                                <span className="block text-[11px] font-medium text-slate-500 mb-1.5">
                                  {product.variantLabel}:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {product.variants.map((v, idx) => (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() =>
                                        setSelectedVariantByProduct((prev) => ({
                                          ...prev,
                                          [product.id]: idx,
                                        }))
                                      }
                                      className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                                        idx === variantIdx
                                          ? 'border-sky-600 bg-sky-50 text-sky-800 font-semibold'
                                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                                      }`}
                                    >
                                      {v.specValue}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Price & Action Baseline */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                              <div>
                                <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                                  ${currentVariant.priceUsd.toLocaleString()}
                                </span>
                                <p className="text-[11px] text-slate-500 truncate max-w-[140px]">
                                  {currentVariant.highlightMetric}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  aria-label={`Configure and view telemetry for ${product.name}`}
                                  onClick={() => setInspectedProduct(product)}
                                  className="p-2.5 text-slate-600 hover:text-sky-700 bg-slate-100 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                  title="Specs & Telemetry"
                                >
                                  <SlidersHorizontal className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleAddToCart(product, currentVariant, 1)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  {isJustAdded ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Added</span>
                                    </>
                                  ) : (
                                    <span>Add to Cart</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Section 3: Field Proof & Telemetry Callout */}
              <section className="bg-slate-50 border-t border-slate-200">
                <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div className="lg:col-span-7 space-y-3">
                    <p className="text-xs font-medium text-sky-700">
                      Verified Commercial Deployment · Cold-Chain &amp; Residential Backup
                    </p>
                    <blockquote className="text-lg sm:text-xl font-semibold text-slate-900 leading-relaxed">
                      &ldquo;Transitioning our facility from dual diesel generators to Ebygam Solar 590W N-Type arrays, 15kWh LiFePO4 battery cabinets, and 5kW SmartGrid hybrid inverters cut monthly fuel spend by 84% across 11 months with zero cold-storage transfer drops.&rdquo;
                    </blockquote>
                    <p className="text-xs text-slate-600 pt-1">
                      Engr. Tunde Adebayo &middot; Director of Operations, Meridian Diagnostics &amp; Cold-Chain
                    </p>
                  </div>

                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <h3 className="text-base font-bold text-slate-900">
                      Test your load in the Live Energy Hub
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Simulate real-time solar generation (500W–650W), battery remaining charge (5–15kWh), fan speed airflow sliders (16&Prime;–22&Prime;), and hybrid inverter efficiency curves before checkout.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveRoute('dashboard')}
                        className="px-4 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Open Energy Hub
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRoute('architecture')}
                        className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        View Two-Tier Architecture
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeRoute === 'dashboard' && (
            <EnergyDashboard
              user={user}
              onQuickAddVariant={(prod, variant, qty) => {
                handleAddToCart(prod, variant, qty);
                setCartOpen(true);
              }}
              onRequireSignIn={() => {
                setAuthInitialMode('signin');
                setActiveRoute('auth');
              }}
            />
          )}

          {activeRoute === 'architecture' && <ArchitectureView />}

          {activeRoute === 'orders' && (
            <OrdersView
              user={user}
              onNavigateAuth={() => {
                setAuthInitialMode('signin');
                setActiveRoute('auth');
              }}
              onNavigateCatalog={() => setActiveRoute('catalog')}
            />
          )}

          {activeRoute === 'auth' && (
            <AuthViews
              user={user}
              initialMode={authInitialMode}
              onAuthSuccess={() => setActiveRoute('catalog')}
            />
          )}
        </main>

        {/* Quiet Clean Footer */}
        <footer className="bg-white border-t border-slate-200">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              <span className="font-bold text-slate-900">Ebygam Solar</span> &middot; Clean Energy Storefront &amp; Telemetry Platform &middot; &copy; {new Date().getFullYear()} Ebygam Solar.
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={() => setActiveRoute('catalog')}
                className="hover:text-slate-900 transition-colors cursor-pointer"
              >
                Catalog
              </button>
              <button
                type="button"
                onClick={() => setActiveRoute('dashboard')}
                className="hover:text-slate-900 transition-colors cursor-pointer"
              >
                Energy Hub
              </button>
              <button
                type="button"
                onClick={() => setActiveRoute('architecture')}
                className="hover:text-slate-900 transition-colors cursor-pointer"
              >
                Architecture
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthInitialMode('signup');
                  setActiveRoute('auth');
                }}
                className="hover:text-slate-900 transition-colors cursor-pointer"
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthInitialMode('signin');
                  setActiveRoute('auth');
                }}
                className="hover:text-slate-900 transition-colors cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        </footer>

        {/* Product Detail & Interactive Telemetry Modal */}
        <ProductDetailModal
          product={inspectedProduct}
          onClose={() => setInspectedProduct(null)}
          onAddToCart={handleAddToCart}
          onOpenTelemetryHub={() => setActiveRoute('dashboard')}
        />

        {/* Slide-Over Cart & Secure Payment Gateway Drawer */}
        <CartAndCheckoutDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          items={cartItems}
          onUpdateQuantity={handleUpdateCartQty}
          onRemoveItem={handleRemoveCartItem}
          onClearCart={() => setCartItems([])}
          user={user}
          onRequireAuth={() => {
            setAuthInitialMode('signin');
            setActiveRoute('auth');
          }}
          onViewOrders={() => setActiveRoute('orders')}
        />
      </div>
    </ErrorBoundary>
  );
}
