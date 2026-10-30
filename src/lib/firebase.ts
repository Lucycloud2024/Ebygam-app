import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BLUEPRINT_CONSTRAINTS,
  BatteryCapacityOption,
  FanSizeOption,
  InverterOutputOption,
  PanelRangeOption,
  sanitizeText,
} from '../data/catalog';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot per skill mandate
async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  accountTier: 'residential' | 'commercial';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserPrivateContactDoc {
  uid: string;
  email: string;
  phone: string;
  shippingAddress: string;
  city: string;
  updatedAt?: Timestamp;
}

export interface OrderRecord {
  orderId: string;
  userId: string;
  itemCount: number;
  summaryText: string;
  subtotalUsd: number;
  paymentMethod: 'card' | 'bank_transfer';
  paymentRef: string;
  verificationDigest: string;
  shippingCity: string;
  status: 'paid' | 'dispatched' | 'delivered' | 'cancelled';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OrderLineItemRecord {
  itemId: string;
  orderId: string;
  userId: string;
  productId: string;
  productName: string;
  selectedSpec: string;
  unitPriceUsd: number;
  quantity: number;
  createdAt?: Timestamp;
}

export interface TelemetryPresetRecord {
  configId: string;
  userId: string;
  panelRange: PanelRangeOption;
  batteryCapacity: BatteryCapacityOption;
  inverterOutput: InverterOutputOption;
  fanSize: FanSizeOption;
  fanSpeed: number;
  gridTiePercent: number;
  updatedAt?: Timestamp;
}

export async function ensureUserProfileDocument(
  user: User,
  preferredName?: string,
  preferredTier: 'residential' | 'commercial' = 'residential'
): Promise<UserProfileDoc | null> {
  if (!user.emailVerified) {
    return null;
  }
  const profilePath = `users/${user.uid}`;
  const profileRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      return snap.data() as UserProfileDoc;
    }
    const cleanName = sanitizeText(
      preferredName || user.displayName || user.email?.split('@')[0] || 'Ebygam Customer',
      BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX
    );
    const payload = {
      uid: user.uid,
      displayName: cleanName.length > 0 ? cleanName : 'Ebygam Customer',
      accountTier: preferredTier,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(profileRef, payload);
    return {
      uid: user.uid,
      displayName: payload.displayName,
      accountTier: preferredTier,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export async function updateUserAccountTier(
  uid: string,
  displayName: string,
  accountTier: 'residential' | 'commercial'
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const cleanName = sanitizeText(displayName, BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX) || 'Ebygam Customer';
    await updateDoc(doc(db, 'users', uid), {
      displayName: cleanName,
      accountTier,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getUserPrivateContact(uid: string): Promise<UserPrivateContactDoc | null> {
  const path = `users/${uid}/private/contact`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'contact'));
    return snap.exists() ? (snap.data() as UserPrivateContactDoc) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserPrivateContact(
  uid: string,
  contact: Omit<UserPrivateContactDoc, 'uid' | 'updatedAt'>
): Promise<void> {
  const path = `users/${uid}/private/contact`;
  const contactRef = doc(db, 'users', uid, 'private', 'contact');
  const sanitized = {
    uid,
    email: sanitizeText(contact.email, BLUEPRINT_CONSTRAINTS.EMAIL_MAX),
    phone: sanitizeText(contact.phone, BLUEPRINT_CONSTRAINTS.PHONE_MAX),
    shippingAddress: sanitizeText(contact.shippingAddress, BLUEPRINT_CONSTRAINTS.ADDRESS_MAX),
    city: sanitizeText(contact.city, BLUEPRINT_CONSTRAINTS.CITY_MAX),
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(contactRef);
    if (existingSnap.exists()) {
      await updateDoc(contactRef, {
        email: sanitized.email,
        phone: sanitized.phone,
        shippingAddress: sanitized.shippingAddress,
        city: sanitized.city,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(contactRef, sanitized);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createVerifiedOrderBatch(
  user: User,
  orderInput: {
    orderId: string;
    itemCount: number;
    summaryText: string;
    subtotalUsd: number;
    paymentMethod: 'card' | 'bank_transfer';
    paymentRef: string;
    verificationDigest: string;
    shippingCity: string;
  },
  items: Array<{
    itemId: string;
    productId: string;
    productName: string;
    selectedSpec: string;
    unitPriceUsd: number;
    quantity: number;
  }>
): Promise<void> {
  const uid = user.uid;
  const orderPath = `users/${uid}/orders/${orderInput.orderId}`;
  try {
    // Ensure root UserProfile exists first
    await ensureUserProfileDocument(user);

    const batch = writeBatch(db);
    const orderRef = doc(db, 'users', uid, 'orders', orderInput.orderId);
    batch.set(orderRef, {
      orderId: sanitizeText(orderInput.orderId, BLUEPRINT_CONSTRAINTS.SHORT_ID_MAX),
      userId: uid,
      itemCount: Math.min(BLUEPRINT_CONSTRAINTS.MAX_ORDER_ITEMS, Math.max(1, Math.round(orderInput.itemCount))),
      summaryText: sanitizeText(orderInput.summaryText, BLUEPRINT_CONSTRAINTS.SUMMARY_MAX),
      subtotalUsd: Number(orderInput.subtotalUsd),
      paymentMethod: orderInput.paymentMethod,
      paymentRef: sanitizeText(orderInput.paymentRef, 120),
      verificationDigest: sanitizeText(orderInput.verificationDigest, 128),
      shippingCity: sanitizeText(orderInput.shippingCity, BLUEPRINT_CONSTRAINTS.CITY_MAX),
      status: 'paid',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const item of items) {
      const itemRef = doc(db, 'users', uid, 'orders', orderInput.orderId, 'items', item.itemId);
      batch.set(itemRef, {
        itemId: sanitizeText(item.itemId, BLUEPRINT_CONSTRAINTS.SHORT_ID_MAX),
        orderId: sanitizeText(orderInput.orderId, BLUEPRINT_CONSTRAINTS.SHORT_ID_MAX),
        userId: uid,
        productId: sanitizeText(item.productId, BLUEPRINT_CONSTRAINTS.SHORT_ID_MAX),
        productName: sanitizeText(item.productName, BLUEPRINT_CONSTRAINTS.PRODUCT_NAME_MAX),
        selectedSpec: sanitizeText(item.selectedSpec, BLUEPRINT_CONSTRAINTS.SELECTED_SPEC_MAX),
        unitPriceUsd: Number(item.unitPriceUsd),
        quantity: Math.min(50, Math.max(1, Math.round(item.quantity))),
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, orderPath);
  }
}

export async function fetchOrderLineItems(uid: string, orderId: string): Promise<OrderLineItemRecord[]> {
  const path = `users/${uid}/orders/${orderId}/items`;
  try {
    const q = query(collection(db, 'users', uid, 'orders', orderId, 'items'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as OrderLineItemRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function cancelCustomerOrder(uid: string, orderId: string): Promise<void> {
  const path = `users/${uid}/orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'orders', orderId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveTelemetryPreset(
  user: User,
  preset: Omit<TelemetryPresetRecord, 'configId' | 'userId' | 'updatedAt'>
): Promise<void> {
  const uid = user.uid;
  const path = `users/${uid}/telemetryConfigs/primary`;
  const ref = doc(db, 'users', uid, 'telemetryConfigs', 'primary');
  try {
    await ensureUserProfileDocument(user);
    const snap = await getDoc(ref);
    const fanSpeed = Math.min(5, Math.max(1, Math.round(preset.fanSpeed)));
    const gridTiePercent = Math.min(100, Math.max(0, Math.round(preset.gridTiePercent)));

    if (snap.exists()) {
      await updateDoc(ref, {
        panelRange: preset.panelRange,
        batteryCapacity: preset.batteryCapacity,
        inverterOutput: preset.inverterOutput,
        fanSize: preset.fanSize,
        fanSpeed,
        gridTiePercent,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        configId: 'primary',
        userId: uid,
        panelRange: preset.panelRange,
        batteryCapacity: preset.batteryCapacity,
        inverterOutput: preset.inverterOutput,
        fanSize: preset.fanSize,
        fanSpeed,
        gridTiePercent,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadTelemetryPreset(uid: string): Promise<TelemetryPresetRecord | null> {
  const path = `users/${uid}/telemetryConfigs/primary`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'telemetryConfigs', 'primary'));
    return snap.exists() ? (snap.data() as TelemetryPresetRecord) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
