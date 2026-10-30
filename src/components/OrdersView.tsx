import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ChevronDown, ChevronUp, Package, ShieldCheck, XCircle } from 'lucide-react';
import {
  OperationType,
  OrderLineItemRecord,
  OrderRecord,
  cancelCustomerOrder,
  db,
  fetchOrderLineItems,
  handleFirestoreError,
} from '../lib/firebase';

interface OrdersViewProps {
  user: User | null;
  onNavigateAuth: () => void;
  onNavigateCatalog: () => void;
}

export function OrdersView({ user, onNavigateAuth, onNavigateCatalog }: OrdersViewProps) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [lineItemsByOrder, setLineItemsByOrder] = useState<Record<string, OrderLineItemRecord[]>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !user.emailVerified) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const path = `users/${user.uid}/orders`;
    const q = query(collection(db, 'users', user.uid, 'orders'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as OrderRecord);
        list.sort((a, b) => {
          const aMs = a.createdAt?.toMillis?.() || 0;
          const bMs = b.createdAt?.toMillis?.() || 0;
          return bMs - aMs;
        });
        setOrders(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const toggleExpand = async (orderId: string) => {
    if (!user) return;
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!lineItemsByOrder[orderId]) {
      const items = await fetchOrderLineItems(user.uid, orderId);
      setLineItemsByOrder((prev) => ({ ...prev, [orderId]: items }));
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!user) return;
    setCancellingId(orderId);
    try {
      await cancelCustomerOrder(user.uid, orderId);
    } finally {
      setCancellingId(null);
    }
  };

  if (!user) {
    return (
      <section className="max-w-[960px] mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-xl p-8">
          <Package className="w-8 h-8 text-sky-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900">Sign in to view your orders</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Access verified payment receipts, HMAC transaction hashes, and delivery progress for your Ebygam Solar hardware.
          </p>
          <button
            type="button"
            onClick={onNavigateAuth}
            className="mt-6 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
          >
            Sign In / Create Account
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1040px] mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-sky-700">Customer Transactions · Firestore Live Sync</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Your Ebygam Solar Orders
          </h1>
        </div>
        <button
          type="button"
          onClick={onNavigateCatalog}
          className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer self-start"
        >
          Continue Shopping
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((skeleton) => (
            <div key={skeleton} className="h-28 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
          <Package className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-900">No orders placed yet</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Configure solar panels, LiFePO4 batteries, hybrid inverters, or DC fans in the catalog to complete your first verified transaction.
          </p>
          <button
            type="button"
            onClick={onNavigateCatalog}
            className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
          >
            Browse Solar Hardware
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => {
            const isExpanded = expandedOrderId === ord.orderId;
            const items = lineItemsByOrder[ord.orderId] || [];
            return (
              <div key={ord.orderId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-800">{ord.orderId}</span>
                      <span>&middot;</span>
                      <span>
                        {ord.createdAt?.toDate
                          ? ord.createdAt.toDate().toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Just now'}
                      </span>
                      <span>&middot;</span>
                      <span>Ship to {ord.shippingCity}</span>
                      <span>&middot;</span>
                      <span
                        className={`font-semibold capitalize ${
                          ord.status === 'cancelled' ? 'text-red-700' : 'text-sky-700'
                        }`}
                      >
                        Status: {ord.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{ord.summaryText}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 font-mono">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>Ref: {ord.paymentRef}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                      ${ord.subtotalUsd.toLocaleString()}
                    </span>

                    {ord.status === 'paid' && (
                      <button
                        type="button"
                        disabled={cancellingId === ord.orderId}
                        onClick={() => void handleCancelOrder(ord.orderId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{cancellingId === ord.orderId ? 'Cancelling...' : 'Cancel'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void toggleExpand(ord.orderId)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>Items ({ord.itemCount})</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 space-y-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-slate-500">Loading subcollection line items...</p>
                    ) : (
                      items.map((item) => (
                        <div key={item.itemId} className="flex items-center justify-between text-xs py-1">
                          <div>
                            <span className="font-semibold text-slate-800">{item.productName}</span>
                            <span className="text-slate-500 ml-2 font-mono">
                              ({item.selectedSpec} &times; {item.quantity})
                            </span>
                          </div>
                          <span className="font-mono tabular-nums font-semibold text-slate-900">
                            ${(item.unitPriceUsd * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                    <div className="pt-2 border-t border-slate-200 text-[11px] font-mono text-slate-500 break-all">
                      HMAC Digest: {ord.verificationDigest}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
