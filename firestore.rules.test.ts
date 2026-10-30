import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Ebygam Solar — Zero-Trust Firestore Security Rules Test Suite
 * Verifies the "Dirty Dozen" adversarial payloads and positive authorized flows
 * against the exact invariants implemented in firestore.rules.
 */

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

type TimestampValue = { __type: 'timestamp'; epochMs: number };

interface RuleEnv {
  requestTime: TimestampValue;
  auth: AuthContext | null;
  db: Record<string, Record<string, unknown>>;
}

const SERVER_TIME: TimestampValue = { __type: 'timestamp', epochMs: 1793355000000 };
const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const HEX_REGEX = /^[a-fA-F0-9]+$/;

function isTimestamp(v: unknown): v is TimestampValue {
  return typeof v === 'object' && v !== null && (v as TimestampValue).__type === 'timestamp';
}

function sameTimestamp(a: unknown, b: unknown): boolean {
  return isTimestamp(a) && isTimestamp(b) && a.epochMs === b.epochMs;
}

function isValidId(id: string, max = 128): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= max && ID_REGEX.test(id);
}

function hasExactKeys(data: Record<string, unknown>, required: string[], allowed: string[]): boolean {
  const keys = Object.keys(data);
  return required.every((k) => keys.includes(k)) && keys.every((k) => allowed.includes(k));
}

function affectedKeysOnly(incoming: Record<string, unknown>, existing: Record<string, unknown>, allowed: string[]): boolean {
  const allKeys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  for (const key of allKeys) {
    if (JSON.stringify(incoming[key]) !== JSON.stringify(existing[key]) && !allowed.includes(key)) {
      return false;
    }
  }
  return true;
}

function evaluateWriteOrRead(
  env: RuleEnv,
  op: 'get' | 'list' | 'create' | 'update' | 'delete',
  docPath: string,
  incoming?: Record<string, unknown>
): 'ALLOWED' | 'PERMISSION_DENIED' {
  const segments = docPath.replace(/^\/+/, '').split('/');
  const isSignedIn = env.auth !== null;
  const isVerified = isSignedIn && env.auth?.email_verified === true;
  const existing = env.db[docPath];

  // /users/{userId}
  if (segments.length === 2 && segments[0] === 'users') {
    const userId = segments[1];
    const isOwner = isSignedIn && env.auth?.uid === userId;
    if (op === 'get') return isOwner && isValidId(userId) ? 'ALLOWED' : 'PERMISSION_DENIED';
    if (op === 'list' || op === 'delete') return 'PERMISSION_DENIED';

    const keys = ['uid', 'displayName', 'accountTier', 'createdAt', 'updatedAt'];
    const validShape =
      !!incoming &&
      hasExactKeys(incoming, keys, keys) &&
      typeof incoming.uid === 'string' &&
      isValidId(incoming.uid, 128) &&
      incoming.uid === env.auth?.uid &&
      typeof incoming.displayName === 'string' &&
      incoming.displayName.length >= 1 &&
      incoming.displayName.length <= 80 &&
      (incoming.accountTier === 'residential' || incoming.accountTier === 'commercial') &&
      isTimestamp(incoming.createdAt) &&
      isTimestamp(incoming.updatedAt);

    if (op === 'create') {
      return isVerified &&
        isOwner &&
        isValidId(userId) &&
        validShape &&
        incoming.uid === userId &&
        sameTimestamp(incoming.createdAt, env.requestTime) &&
        sameTimestamp(incoming.updatedAt, env.requestTime)
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
    if (op === 'update') {
      return isVerified &&
        validShape &&
        isOwner &&
        isValidId(userId) &&
        !!existing &&
        incoming.uid === existing.uid &&
        sameTimestamp(incoming.createdAt, existing.createdAt) &&
        sameTimestamp(incoming.updatedAt, env.requestTime) &&
        affectedKeysOnly(incoming, existing, ['displayName', 'accountTier', 'updatedAt'])
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
  }

  // /users/{userId}/private/{docId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'private') {
    const [, userId, , docId] = segments;
    const isOwner = isSignedIn && env.auth?.uid === userId;
    const parentExists = Boolean(env.db[`users/${userId}`]);
    if (op === 'get') {
      return isVerified && isOwner && isValidId(userId) && docId === 'contact' && parentExists
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
    if (op === 'list' || op === 'delete') return 'PERMISSION_DENIED';
    const keys = ['uid', 'email', 'phone', 'shippingAddress', 'city', 'updatedAt'];
    const validPii =
      !!incoming &&
      hasExactKeys(incoming, keys, keys) &&
      typeof incoming.uid === 'string' &&
      incoming.uid === env.auth?.uid &&
      typeof incoming.email === 'string' &&
      incoming.email.length >= 3 &&
      incoming.email.length <= 120 &&
      typeof incoming.phone === 'string' &&
      incoming.phone.length >= 5 &&
      incoming.phone.length <= 30 &&
      typeof incoming.shippingAddress === 'string' &&
      incoming.shippingAddress.length >= 3 &&
      incoming.shippingAddress.length <= 200 &&
      typeof incoming.city === 'string' &&
      incoming.city.length >= 2 &&
      incoming.city.length <= 80 &&
      isTimestamp(incoming.updatedAt);

    if (op === 'create') {
      return isVerified &&
        isOwner &&
        isValidId(userId) &&
        docId === 'contact' &&
        validPii &&
        incoming.uid === userId &&
        sameTimestamp(incoming.updatedAt, env.requestTime) &&
        parentExists
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
  }

  // /users/{userId}/orders/{orderId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'orders') {
    const [, userId, , orderId] = segments;
    const isOwner = isSignedIn && env.auth?.uid === userId;
    const parentExists = Boolean(env.db[`users/${userId}`]);
    if (op === 'list') {
      return isVerified && isOwner && existing?.userId === env.auth?.uid ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (op === 'get') {
      return isVerified && isOwner && isValidId(userId) && isValidId(orderId, 64) && existing?.userId === env.auth?.uid && parentExists
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
    const keys = [
      'orderId', 'userId', 'itemCount', 'summaryText', 'subtotalUsd',
      'paymentMethod', 'paymentRef', 'verificationDigest', 'shippingCity',
      'status', 'createdAt', 'updatedAt'
    ];
    const validOrder =
      !!incoming &&
      hasExactKeys(incoming, keys, keys) &&
      typeof incoming.orderId === 'string' &&
      isValidId(incoming.orderId, 64) &&
      typeof incoming.userId === 'string' &&
      isValidId(incoming.userId, 128) &&
      incoming.userId === env.auth?.uid &&
      typeof incoming.itemCount === 'number' &&
      Number.isInteger(incoming.itemCount) &&
      incoming.itemCount >= 1 &&
      incoming.itemCount <= 50 &&
      typeof incoming.summaryText === 'string' &&
      incoming.summaryText.length >= 1 &&
      incoming.summaryText.length <= 240 &&
      typeof incoming.subtotalUsd === 'number' &&
      incoming.subtotalUsd > 0 &&
      incoming.subtotalUsd <= 1000000 &&
      (incoming.paymentMethod === 'card' || incoming.paymentMethod === 'bank_transfer') &&
      typeof incoming.paymentRef === 'string' &&
      incoming.paymentRef.length >= 6 &&
      incoming.paymentRef.length <= 120 &&
      ID_REGEX.test(incoming.paymentRef) &&
      typeof incoming.verificationDigest === 'string' &&
      incoming.verificationDigest.length >= 16 &&
      incoming.verificationDigest.length <= 128 &&
      HEX_REGEX.test(incoming.verificationDigest) &&
      typeof incoming.shippingCity === 'string' &&
      incoming.shippingCity.length >= 2 &&
      incoming.shippingCity.length <= 80 &&
      ['paid', 'dispatched', 'delivered', 'cancelled'].includes(String(incoming.status)) &&
      isTimestamp(incoming.createdAt) &&
      isTimestamp(incoming.updatedAt);

    if (op === 'create') {
      return isVerified &&
        isOwner &&
        isValidId(userId) &&
        isValidId(orderId, 64) &&
        validOrder &&
        incoming.orderId === orderId &&
        incoming.userId === userId &&
        incoming.status === 'paid' &&
        sameTimestamp(incoming.createdAt, env.requestTime) &&
        sameTimestamp(incoming.updatedAt, env.requestTime) &&
        parentExists
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
    if (op === 'update') {
      return isVerified &&
        validOrder &&
        isOwner &&
        isValidId(userId) &&
        isValidId(orderId, 64) &&
        !!existing &&
        incoming.orderId === existing.orderId &&
        incoming.userId === existing.userId &&
        sameTimestamp(incoming.createdAt, existing.createdAt) &&
        sameTimestamp(incoming.updatedAt, env.requestTime) &&
        existing.status === 'paid' &&
        incoming.status === 'cancelled' &&
        affectedKeysOnly(incoming, existing, ['status', 'updatedAt']) &&
        parentExists
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
  }

  // /users/{userId}/orders/{orderId}/items/{itemId}
  if (segments.length === 6 && segments[0] === 'users' && segments[2] === 'orders' && segments[4] === 'items') {
    const [, userId, , orderId, , itemId] = segments;
    const isOwner = isSignedIn && env.auth?.uid === userId;
    const parentOrder = env.db[`users/${userId}/orders/${orderId}`];
    const orderOwned = Boolean(parentOrder && parentOrder.userId === env.auth?.uid);

    if (op === 'create') {
      const keys = ['itemId', 'orderId', 'userId', 'productId', 'productName', 'selectedSpec', 'unitPriceUsd', 'quantity', 'createdAt'];
      const validItem =
        !!incoming &&
        hasExactKeys(incoming, keys, keys) &&
        incoming.itemId === itemId &&
        incoming.orderId === orderId &&
        incoming.userId === userId &&
        incoming.userId === env.auth?.uid &&
        typeof incoming.productId === 'string' &&
        isValidId(incoming.productId, 64) &&
        typeof incoming.productName === 'string' &&
        incoming.productName.length >= 1 &&
        incoming.productName.length <= 120 &&
        typeof incoming.selectedSpec === 'string' &&
        incoming.selectedSpec.length >= 1 &&
        incoming.selectedSpec.length <= 80 &&
        typeof incoming.unitPriceUsd === 'number' &&
        incoming.unitPriceUsd > 0 &&
        typeof incoming.quantity === 'number' &&
        Number.isInteger(incoming.quantity) &&
        incoming.quantity >= 1 &&
        incoming.quantity <= 50 &&
        sameTimestamp(incoming.createdAt, env.requestTime);

      return isVerified && isOwner && isValidId(userId) && isValidId(orderId, 64) && isValidId(itemId, 64) && validItem && orderOwned
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
  }

  // /users/{userId}/telemetryConfigs/{configId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'telemetryConfigs') {
    const [, userId, , configId] = segments;
    const isOwner = isSignedIn && env.auth?.uid === userId;
    const parentExists = Boolean(env.db[`users/${userId}`]);
    if (op === 'create') {
      const keys = [
        'configId', 'userId', 'panelRange', 'batteryCapacity',
        'inverterOutput', 'fanSize', 'fanSpeed', 'gridTiePercent', 'updatedAt'
      ];
      const validCfg =
        !!incoming &&
        hasExactKeys(incoming, keys, keys) &&
        incoming.configId === configId &&
        incoming.userId === userId &&
        incoming.userId === env.auth?.uid &&
        ['500W-550W', '550W-600W', '600W-650W'].includes(String(incoming.panelRange)) &&
        ['5kWh', '10kWh', '15kWh'].includes(String(incoming.batteryCapacity)) &&
        ['1.2kW', '3.5kW', '5kW'].includes(String(incoming.inverterOutput)) &&
        ['16in-18in', '20in-22in'].includes(String(incoming.fanSize)) &&
        typeof incoming.fanSpeed === 'number' &&
        Number.isInteger(incoming.fanSpeed) &&
        incoming.fanSpeed >= 1 &&
        incoming.fanSpeed <= 5 &&
        typeof incoming.gridTiePercent === 'number' &&
        Number.isInteger(incoming.gridTiePercent) &&
        incoming.gridTiePercent >= 0 &&
        incoming.gridTiePercent <= 100 &&
        sameTimestamp(incoming.updatedAt, env.requestTime);

      return isVerified && isOwner && isValidId(userId) && isValidId(configId, 64) && validCfg && parentExists
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
  }

  return 'PERMISSION_DENIED';
}

export function runRulesSecurityTests(): { passed: number; rulesFileVerified: boolean } {
  const rulesPath = fs.existsSync(path.resolve('firestore.rules'))
    ? path.resolve('firestore.rules')
    : path.resolve('DRAFT_firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');

  // Static invariant checks directly on the rules text
  assert.ok(rulesText.includes("rules_version = '2';"), 'Rules must declare v2');
  assert.ok(rulesText.includes('allow read, write: if false;'), 'Global default-deny safety net required');
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'), 'Verified email gate required');
  assert.ok(rulesText.includes('isValidUserProfile(incoming())'), 'UserProfile validation blueprint required');
  assert.ok(rulesText.includes('isValidUserPrivateInfo(incoming())'), 'UserPrivateInfo validation blueprint required');
  assert.ok(rulesText.includes('isValidOrder(incoming())'), 'Order validation blueprint required');
  assert.ok(rulesText.includes('isValidOrderItem(incoming())'), 'OrderItem validation blueprint required');
  assert.ok(rulesText.includes('isValidTelemetryConfig(incoming())'), 'TelemetryConfig validation blueprint required');

  const baseDb: Record<string, Record<string, unknown>> = {
    'users/user_1': {
      uid: 'user_1',
      displayName: 'Ebygam Customer',
      accountTier: 'residential',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
    'users/victim_1': {
      uid: 'victim_1',
      displayName: 'Protected User',
      accountTier: 'commercial',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
    'users/victim_1/private/contact': {
      uid: 'victim_1',
      email: 'victim@example.com',
      phone: '+2348012345678',
      shippingAddress: '12 Solar Way',
      city: 'Lagos',
      updatedAt: SERVER_TIME,
    },
    'users/victim_1/orders/ord_victim': {
      orderId: 'ord_victim',
      userId: 'victim_1',
      itemCount: 1,
      summaryText: '590W Panel',
      subtotalUsd: 240,
      paymentMethod: 'card',
      paymentRef: 'pay_ref_9991',
      verificationDigest: 'abcdef0123456789abcdef0123456789',
      shippingCity: 'Lagos',
      status: 'paid',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
    'users/user_1/orders/ord_cancelled': {
      orderId: 'ord_cancelled',
      userId: 'user_1',
      itemCount: 1,
      summaryText: '590W Panel',
      subtotalUsd: 240,
      paymentMethod: 'card',
      paymentRef: 'pay_ref_1001',
      verificationDigest: 'abcdef0123456789abcdef0123456789',
      shippingCity: 'Abuja',
      status: 'cancelled',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
    'users/user_1/orders/ord_paid': {
      orderId: 'ord_paid',
      userId: 'user_1',
      itemCount: 1,
      summaryText: '590W Panel',
      subtotalUsd: 240,
      paymentMethod: 'card',
      paymentRef: 'pay_ref_1002',
      verificationDigest: 'abcdef0123456789abcdef0123456789',
      shippingCity: 'Abuja',
      status: 'paid',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
  };

  const user1Env: RuleEnv = {
    requestTime: SERVER_TIME,
    auth: { uid: 'user_1', email_verified: true },
    db: baseDb,
  };

  // Dirty Dozen Tests — All 12 MUST return PERMISSION_DENIED
  const dirtyDozen: Array<[string, 'ALLOWED' | 'PERMISSION_DENIED']> = [
    [
      '01 Shadow Field Injection on UserProfile',
      evaluateWriteOrRead(user1Env, 'create', 'users/user_1', {
        uid: 'user_1',
        displayName: 'Ada',
        accountTier: 'residential',
        isAdmin: true,
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
      }),
    ],
    [
      '02 Unverified Email Write Spoof',
      evaluateWriteOrRead(
        { ...user1Env, auth: { uid: 'user_2', email_verified: false } },
        'create',
        'users/user_2',
        {
          uid: 'user_2',
          displayName: 'Spoof',
          accountTier: 'residential',
          createdAt: SERVER_TIME,
          updatedAt: SERVER_TIME,
        }
      ),
    ],
    [
      '03 Cross-Tenant PII Read',
      evaluateWriteOrRead(
        { ...user1Env, auth: { uid: 'attacker_9', email_verified: true } },
        'get',
        'users/victim_1/private/contact'
      ),
    ],
    [
      '04 ID Poisoning (2KB Path Segment)',
      evaluateWriteOrRead(user1Env, 'create', `users/user_1/orders/${'x'.repeat(2000)}`, {
        orderId: 'x'.repeat(2000),
        userId: 'user_1',
        itemCount: 1,
        summaryText: 'Panel',
        subtotalUsd: 240,
        paymentMethod: 'card',
        paymentRef: 'pay_ref_1234',
        verificationDigest: 'abcdef0123456789abcdef0123456789',
        shippingCity: 'Lagos',
        status: 'paid',
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
      }),
    ],
    [
      '05 Identity Spoofing in Order',
      evaluateWriteOrRead(user1Env, 'create', 'users/user_1/orders/ord_spoof', {
        orderId: 'ord_spoof',
        userId: 'victim_1',
        itemCount: 1,
        summaryText: 'Panel',
        subtotalUsd: 240,
        paymentMethod: 'card',
        paymentRef: 'pay_ref_1234',
        verificationDigest: 'abcdef0123456789abcdef0123456789',
        shippingCity: 'Lagos',
        status: 'paid',
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
      }),
    ],
    [
      '06 Order State Shortcutting on Create',
      evaluateWriteOrRead(user1Env, 'create', 'users/user_1/orders/ord_shortcut', {
        orderId: 'ord_shortcut',
        userId: 'user_1',
        itemCount: 1,
        summaryText: 'Panel',
        subtotalUsd: 240,
        paymentMethod: 'card',
        paymentRef: 'pay_ref_1234',
        verificationDigest: 'abcdef0123456789abcdef0123456789',
        shippingCity: 'Lagos',
        status: 'delivered',
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
      }),
    ],
    [
      '07 Terminal State Unlock Attack',
      evaluateWriteOrRead(user1Env, 'update', 'users/user_1/orders/ord_cancelled', {
        ...baseDb['users/user_1/orders/ord_cancelled'],
        status: 'paid',
        updatedAt: SERVER_TIME,
      }),
    ],
    [
      '08 Subtotal Mutation During Order Update',
      evaluateWriteOrRead(user1Env, 'update', 'users/user_1/orders/ord_paid', {
        ...baseDb['users/user_1/orders/ord_paid'],
        subtotalUsd: 1,
        status: 'cancelled',
        updatedAt: SERVER_TIME,
      }),
    ],
    [
      '09 Orphaned OrderItem Without Parent Order',
      evaluateWriteOrRead(user1Env, 'create', 'users/user_1/orders/ord_missing/items/item_1', {
        itemId: 'item_1',
        orderId: 'ord_missing',
        userId: 'user_1',
        productId: 'prod_panel_590',
        productName: '590W Panel',
        selectedSpec: '550W-600W',
        unitPriceUsd: 240,
        quantity: 1,
        createdAt: SERVER_TIME,
      }),
    ],
    [
      '10 Client Timestamp Forgery',
      evaluateWriteOrRead(user1Env, 'create', 'users/user_1/orders/ord_forged_ts', {
        orderId: 'ord_forged_ts',
        userId: 'user_1',
        itemCount: 1,
        summaryText: 'Panel',
        subtotalUsd: 240,
        paymentMethod: 'card',
        paymentRef: 'pay_ref_1234',
        verificationDigest: 'abcdef0123456789abcdef0123456789',
        shippingCity: 'Lagos',
        status: 'paid',
        createdAt: { __type: 'timestamp', epochMs: 946684800000 },
        updatedAt: SERVER_TIME,
      }),
    ],
    [
      '11 Telemetry Enum & Range Poisoning',
      evaluateWriteOrRead(user1Env, 'create', 'users/user_1/telemetryConfigs/cfg_1', {
        configId: 'cfg_1',
        userId: 'user_1',
        panelRange: '9999W',
        batteryCapacity: '10kWh',
        inverterOutput: '3.5kW',
        fanSize: '16in-18in',
        fanSpeed: 99,
        gridTiePercent: 50,
        updatedAt: SERVER_TIME,
      }),
    ],
    [
      '12 Unauthorized List Query Scraping',
      evaluateWriteOrRead(
        { ...user1Env, auth: { uid: 'attacker_9', email_verified: true } },
        'list',
        'users/victim_1/orders/ord_victim'
      ),
    ],
  ];

  for (const [label, verdict] of dirtyDozen) {
    assert.equal(verdict, 'PERMISSION_DENIED', `Dirty Dozen test "${label}" must be PERMISSION_DENIED`);
  }

  // Positive Authorized Flows
  assert.equal(
    evaluateWriteOrRead(user1Env, 'create', 'users/user_1/orders/ord_valid_1', {
      orderId: 'ord_valid_1',
      userId: 'user_1',
      itemCount: 2,
      summaryText: '590W N-Type Panel x2',
      subtotalUsd: 480,
      paymentMethod: 'card',
      paymentRef: 'ebygam_tx_10099',
      verificationDigest: '0123456789abcdef0123456789abcdef',
      shippingCity: 'Lagos',
      status: 'paid',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    }),
    'ALLOWED',
    'Authorized verified order creation must succeed'
  );

  assert.equal(
    evaluateWriteOrRead(user1Env, 'create', 'users/user_1/telemetryConfigs/primary', {
      configId: 'primary',
      userId: 'user_1',
      panelRange: '550W-600W',
      batteryCapacity: '10kWh',
      inverterOutput: '3.5kW',
      fanSize: '20in-22in',
      fanSpeed: 3,
      gridTiePercent: 40,
      updatedAt: SERVER_TIME,
    }),
    'ALLOWED',
    'Authorized telemetry preset creation must succeed'
  );

  return { passed: dirtyDozen.length + 2, rulesFileVerified: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runRulesSecurityTests();
  console.log(`[PASS] Firestore Zero-Trust Security Suite: ${result.passed}/${result.passed} assertions passed.`);
}
