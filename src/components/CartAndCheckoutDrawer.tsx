import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Landmark,
  Lock,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { BLUEPRINT_CONSTRAINTS, ProductVariant, SolarProduct, sanitizeText } from '../data/catalog';
import {
  createVerifiedOrderBatch,
  getUserPrivateContact,
  saveUserPrivateContact,
} from '../lib/firebase';
import { ResilientProductImage } from './ResilientProductImage';

export interface CartItem {
  product: SolarProduct;
  variant: ProductVariant;
  quantity: number;
}

interface CartAndCheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (variantId: string, delta: number) => void;
  onRemoveItem: (variantId: string) => void;
  onClearCart: () => void;
  user: User | null;
  onRequireAuth: () => void;
  onViewOrders: () => void;
}

type CheckoutStep = 'cart' | 'shipping' | 'payment' | 'receipt';

interface PaymentIntentResponse {
  intentId: string;
  amountUsd: number;
  itemCount: number;
  currency: string;
  challengeSig: string;
  expiresAt: string;
}

export function CartAndCheckoutDrawer({
  open,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  user,
  onRequireAuth,
  onViewOrders,
}: CartAndCheckoutDrawerProps) {
  const [step, setStep] = useState<CheckoutStep>('cart');

  // Shipping fields
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [city, setCity] = useState('');

  // Payment Gateway state
  const [intent, setIntent] = useState<PaymentIntentResponse | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [transferReference, setTransferReference] = useState('');

  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Confirmed Receipt state
  const [receipt, setReceipt] = useState<{
    orderId: string;
    paymentRef: string;
    verificationDigest: string;
    amountUsd: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setErrorMsg(null);
      if (step === 'receipt') {
        setStep('cart');
      }
    }
  }, [open, step]);

  // Pre-populate customer shipping info from Firestore private contact
  useEffect(() => {
    let cancelled = false;
    async function prefillContact() {
      if (!user || !user.emailVerified || !open) return;
      setRecipientName((prev) => prev || user.displayName || '');
      try {
        const contact = await getUserPrivateContact(user.uid);
        if (contact && !cancelled) {
          setPhone((prev) => prev || contact.phone);
          setShippingAddress((prev) => prev || contact.shippingAddress);
          setCity((prev) => prev || contact.city);
        }
      } catch {
        // Ignore prefill errors
      }
    }
    void prefillContact();
    return () => {
      cancelled = true;
    };
  }, [user, open]);

  if (!open) return null;

  const subtotalUsd = items.reduce(
    (sum, entry) => sum + entry.variant.priceUsd * entry.quantity,
    0
  );
  const totalUnits = items.reduce((sum, entry) => sum + entry.quantity, 0);

  const handleProceedToShipping = () => {
    setErrorMsg(null);
    if (!user) {
      onClose();
      onRequireAuth();
      return;
    }
    if (!user.emailVerified) {
      setErrorMsg(
        'Please verify your email address in the Account tab (or sign in with Google) before placing an order.'
      );
      return;
    }
    setStep('shipping');
  };

  const handleInitializePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);

    const cleanPhone = sanitizeText(phone, BLUEPRINT_CONSTRAINTS.PHONE_MAX);
    const cleanAddress = sanitizeText(shippingAddress, BLUEPRINT_CONSTRAINTS.ADDRESS_MAX);
    const cleanCity = sanitizeText(city, BLUEPRINT_CONSTRAINTS.CITY_MAX);

    if (cleanPhone.length < 5 || cleanAddress.length < 3 || cleanCity.length < 2) {
      setErrorMsg('Please enter a valid phone number, street delivery address, and city.');
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          shippingCity: cleanCity,
          items: items.map((it) => ({
            variantId: it.variant.id,
            quantity: it.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not initialize payment intent.');
      }
      setIntent(data as PaymentIntentResponse);
      setStep('payment');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize payment gateway.');
    } finally {
      setProcessing(false);
    }
  };

  const formatCardInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiryInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const fillTestCard = () => {
    setPaymentMethod('card');
    setCardNumber('4532 0151 1283 0366');
    setExpiry('08/29');
    setCvv('418');
    setErrorMsg(null);
  };

  const handleCompletePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !intent) return;
    setErrorMsg(null);
    setProcessing(true);

    try {
      // 1. Server-side Payment Verification & HMAC Signing
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: intent.intentId,
          userId: user.uid,
          challengeSig: intent.challengeSig,
          paymentMethod,
          cardDetails:
            paymentMethod === 'card'
              ? { cardNumber, expiry, cvv }
              : undefined,
          transferReference:
            paymentMethod === 'bank_transfer' ? transferReference : undefined,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Payment verification failed.');
      }

      // 2. Persist Customer Isolated Delivery PII
      await saveUserPrivateContact(user.uid, {
        email: user.email || 'customer@ebygamsolar.com',
        phone,
        shippingAddress,
        city,
      });

      // 3. Atomic Firestore Batch Write (Order + OrderItem subcollection)
      const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const summaryText = items
        .map((i) => `${i.product.name} (${i.variant.specValue} x${i.quantity})`)
        .join(', ')
        .slice(0, BLUEPRINT_CONSTRAINTS.SUMMARY_MAX);

      await createVerifiedOrderBatch(
        user,
        {
          orderId,
          itemCount: intent.itemCount,
          summaryText,
          subtotalUsd: verifyData.amountUsd,
          paymentMethod,
          paymentRef: verifyData.paymentRef,
          verificationDigest: verifyData.verificationDigest,
          shippingCity: city,
        },
        items.map((entry, idx) => ({
          itemId: `item_${idx + 1}_${entry.variant.id.replace(/[^a-zA-Z0-9_-]/g, '')}`,
          productId: entry.product.id,
          productName: entry.product.name,
          selectedSpec: entry.variant.specValue,
          unitPriceUsd: entry.variant.priceUsd,
          quantity: entry.quantity,
        }))
      );

      setReceipt({
        orderId,
        paymentRef: verifyData.paymentRef,
        verificationDigest: verifyData.verificationDigest,
        amountUsd: verifyData.amountUsd,
      });
      onClearCart();
      setStep('receipt');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Cart and Secure Checkout"
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex justify-end"
    >
      <div className="bg-white w-full max-w-lg h-full flex flex-col border-l border-slate-200 shadow-2xl">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {step !== 'cart' && step !== 'receipt' && (
              <button
                type="button"
                onClick={() => setStep(step === 'payment' ? 'shipping' : 'cart')}
                aria-label="Go back"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {step === 'cart' && `Shopping Cart (${totalUnits})`}
                {step === 'shipping' && 'Delivery Destination'}
                {step === 'payment' && 'Ebygam Secure Payment Gateway'}
                {step === 'receipt' && 'Order Confirmed'}
              </h2>
              <p className="text-xs text-slate-500">
                {step === 'cart' && 'Free nationwide solar logistics on orders above $1,500'}
                {step === 'shipping' && 'Step 1 of 2 · Verified dispatch details'}
                {step === 'payment' && 'Step 2 of 2 · 256-bit HMAC-verified checkout'}
                {step === 'receipt' && 'Persisted to your Ebygam Solar account'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart drawer"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
              {errorMsg}
            </div>
          )}

          {step === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Your solar cart is empty</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    Explore Ebygam Solar panels, LiFePO4 batteries, hybrid inverters, generators, and DC fans to build your system.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((entry) => (
                    <div
                      key={entry.variant.id}
                      className="flex gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <ResilientProductImage
                        src={entry.product.imageUrl}
                        alt={entry.product.name}
                        categoryLabel={entry.product.categoryLabel}
                        className="w-20 h-20 rounded-lg border border-slate-200 shrink-0 bg-white"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {entry.product.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Spec: <span className="font-mono text-slate-700">{entry.variant.label}</span>
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="inline-flex items-center border border-slate-300 bg-white rounded-md">
                            <button
                              type="button"
                              aria-label="Decrease item quantity"
                              onClick={() => onUpdateQuantity(entry.variant.id, -1)}
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-mono tabular-nums font-semibold">
                              {entry.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase item quantity"
                              onClick={() => onUpdateQuantity(entry.variant.id, 1)}
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                              ${(entry.variant.priceUsd * entry.quantity).toLocaleString()}
                            </span>
                            <button
                              type="button"
                              aria-label="Remove item"
                              onClick={() => onRemoveItem(entry.variant.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'shipping' && (
            <form id="shipping-form" onSubmit={handleInitializePayment} className="space-y-4">
              <div>
                <label htmlFor="chk-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Recipient Full Name
                </label>
                <input
                  id="chk-name"
                  type="text"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Adaeze Nwosu"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label htmlFor="chk-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Active Phone Number
                </label>
                <input
                  id="chk-phone"
                  type="tel"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.PHONE_MAX}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 803 123 4567"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label htmlFor="chk-address" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Delivery Street Address
                </label>
                <input
                  id="chk-address"
                  type="text"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.ADDRESS_MAX}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="18 Herbert Macaulay Way"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label htmlFor="chk-city" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  City & State
                </label>
                <input
                  id="chk-city"
                  type="text"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.CITY_MAX}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Abuja, FCT"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>
            </form>
          )}

          {step === 'payment' && intent && (
            <form id="payment-form" onSubmit={handleCompletePayment} className="space-y-5">
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between">
                <div>
                  <p className="text-xs text-sky-800 font-medium">Locked Tier-2 Payment Intent</p>
                  <p className="text-xs font-mono text-slate-600 mt-0.5">{intent.intentId}</p>
                </div>
                <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                  ${intent.amountUsd.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Payment Channel
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-sky-600 bg-sky-50/70 text-sky-800'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-sky-600" />
                    <span>Debit / Credit Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-sky-600 bg-sky-50/70 text-sky-800'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <Landmark className="w-4 h-4 text-sky-600" />
                    <span>Bank Transfer</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'card' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="card-num" className="text-xs font-semibold text-slate-700">
                      Card Number (Luhn-Verified)
                    </label>
                    <button
                      type="button"
                      onClick={fillTestCard}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                    >
                      Autofill Test Card
                    </button>
                  </div>
                  <input
                    id="card-num"
                    type="text"
                    inputMode="numeric"
                    required
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardInput(e.target.value))}
                    placeholder="4532 0151 1283 0366"
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="card-exp" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Expiry (MM/YY)
                      </label>
                      <input
                        id="card-exp"
                        type="text"
                        required
                        value={expiry}
                        onChange={(e) => setExpiry(formatExpiryInput(e.target.value))}
                        placeholder="08/29"
                        className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                      />
                    </div>
                    <div>
                      <label htmlFor="card-cvv" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Security Code (CVV)
                      </label>
                      <input
                        id="card-cvv"
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="418"
                        className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <p className="font-semibold text-slate-900">Ebygam Solar Dedicated Escrow Account</p>
                    <p className="text-slate-600">
                      Bank: <span className="font-medium text-slate-800">First Clean Energy Commercial Bank</span>
                    </p>
                    <p className="text-slate-600">
                      Account Number: <span className="font-mono font-semibold text-slate-900">0149882310</span>
                    </p>
                    <p className="text-slate-600">
                      Amount: <span className="font-mono font-semibold text-sky-700">${intent.amountUsd.toLocaleString()} USD</span>
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="bank-ref" className="text-xs font-semibold text-slate-700">
                        Transfer Session / Reference ID
                      </label>
                      <button
                        type="button"
                        onClick={() => setTransferReference(`TRF_${Date.now().toString().slice(-8)}`)}
                        className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                      >
                        Generate Instant Ref
                      </button>
                    </div>
                    <input
                      id="bank-ref"
                      type="text"
                      required
                      value={transferReference}
                      onChange={(e) => setTransferReference(e.target.value)}
                      placeholder="TRF_94820114"
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Verified server-side by Tier 2 HMAC-SHA256 gateway prior to Firestore commit.</span>
              </p>
            </form>
          )}

          {step === 'receipt' && receipt && (
            <div className="py-8 space-y-6">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-medium text-sky-700">Payment Verified & Stored</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  Order #{receipt.orderId} Confirmed
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Your Ebygam Solar equipment order is preparing for dispatch.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid</span>
                  <span className="font-mono font-bold text-slate-900">
                    ${receipt.amountUsd.toLocaleString()} USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gateway Reference</span>
                  <span className="font-mono text-slate-800">{receipt.paymentRef}</span>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-1">HMAC-SHA256 Verification Digest</span>
                  <span className="font-mono text-[11px] text-slate-700 break-all">
                    {receipt.verificationDigest}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          {step === 'cart' && items.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-slate-600">Subtotal</span>
                <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                  ${subtotalUsd.toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={handleProceedToShipping}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
              >
                {user ? 'Proceed to Secure Checkout' : 'Sign In to Checkout'}
              </button>
            </div>
          )}

          {step === 'shipping' && (
            <button
              type="submit"
              form="shipping-form"
              disabled={processing}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {processing ? 'Locking Server Price...' : `Continue to Payment · $${subtotalUsd.toLocaleString()}`}
            </button>
          )}

          {step === 'payment' && intent && (
            <button
              type="submit"
              form="payment-form"
              disabled={processing}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {processing ? 'Verifying Transaction...' : `Pay $${intent.amountUsd.toLocaleString()} USD Securely`}
            </button>
          )}

          {step === 'receipt' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewOrders();
              }}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
            >
              View Order History
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
