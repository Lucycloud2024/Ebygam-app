# Ebygam Solar — Firestore Zero-Trust Security Specification

## 1. Data Invariants & Master Source of Truth

1. **Root Ownership (`UserProfile` at `/users/{userId}`)**:
   - A `UserProfile` document ID `{userId}` must strictly match `request.auth.uid`, match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and require `request.auth.token.email_verified == true`.
   - `uid` and `createdAt` are immutable after creation; `updatedAt` must always equal `request.time`.
2. **PII Isolation (`UserPrivateInfo` at `/users/{userId}/private/{docId}`)**:
   - Customer PII (`email`, `phone`, `shippingAddress`, `city`) is isolated in `/users/{userId}/private/{docId}` (`docId == 'contact'`).
   - Requires parent `/users/{userId}` document existence (Master Gate) and strict `isOwner(userId)` + `isVerified()` enforcement. Non-owners can never read or list PII.
3. **Order Integrity & Terminal State Locking (`Order` at `/users/{userId}/orders/{orderId}`)**:
   - Every `Order` requires parent `/users/{userId}` existence (or atomic batch `existsAfter`), verified owner match (`userId == request.auth.uid`), valid HMAC hex `verificationDigest`, initial `status == 'paid'`, and `createdAt == request.time`.
   - Terminal states (`'delivered'`, `'cancelled'`) are permanently locked against further updates. Customers may only execute the explicit `cancelOrder` action transitioning `'paid'` to `'cancelled'` with `affectedKeys().hasOnly(['status', 'updatedAt'])`.
4. **Subcollection Line Items (`OrderItem` at `/users/{userId}/orders/{orderId}/items/{itemId}`)**:
   - Line items are stored in a subcollection (no unbounded arrays).
   - `create` and `get` enforce Master Gate check against `/users/{userId}/orders/{orderId}` (`exists` / `existsAfter` for atomic batch creation).
   - `list` enforces `resource.data.userId == request.auth.uid` without O(n) `get()` calls. Line items are immutable once created (`allow update, delete: if false`).
5. **Telemetry Presets (`TelemetryConfig` at `/users/{userId}/telemetryConfigs/{configId}`)**:
   - Enforces enum domain bounds (`500W-550W` | `550W-600W` | `600W-650W`, `5kWh` | `10kWh` | `15kWh`, `1.2kW` | `3.5kW` | `5kW`, `16in-18in` | `20in-22in`), integer bounds (`fanSpeed` 1..5, `gridTiePercent` 0..100), and parent `/users/{userId}` Master Gate.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 01 — Shadow Field Injection on `UserProfile`**:
   `{ uid: "user_1", displayName: "Ada", accountTier: "residential", isAdmin: true, createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` -> **REJECTED** (`hasOnly` blocks `isAdmin`).
2. **Payload 02 — Unverified Email Write Spoof**:
   Authenticated token with `email_verified: false` writing to `/users/user_1` -> **REJECTED** (`isVerified()` requires `email_verified == true`).
3. **Payload 03 — Cross-Tenant PII Read**:
   `auth.uid = "attacker_9"` attempting `get` on `/users/victim_1/private/contact` -> **REJECTED** (`isOwner(userId)` fails).
4. **Payload 04 — ID Poisoning (2KB Path Segment)**:
   `create` on `/users/user_1/orders/<2000-char-junk>` -> **REJECTED** (`isValidId(orderId)` caps length at `<= 128` and regex `^[a-zA-Z0-9_\-]+$`).
5. **Payload 05 — Identity Spoofing in `Order`**:
   `auth.uid = "user_1"` creating `/users/user_1/orders/ord_1` with `{ userId: "victim_2", ... }` -> **REJECTED** (`data.userId == request.auth.uid` fails).
6. **Payload 06 — Order State Shortcutting on Create**:
   Creating `/users/user_1/orders/ord_1` with `status: "delivered"` -> **REJECTED** (`create` enforces `incoming().status == 'paid'`).
7. **Payload 07 — Terminal State Unlock Attack**:
   Updating an `Order` whose existing `status` is `'cancelled'` back to `'paid'` -> **REJECTED** (terminal state lock requires `existing().status == 'paid'`).
8. **Payload 08 — Subtotal Mutation During Order Update**:
   Updating `Order` fields `['status', 'subtotalUsd', 'updatedAt']` -> **REJECTED** (`affectedKeys().hasOnly(['status', 'updatedAt'])` blocks `subtotalUsd`).
9. **Payload 09 — Orphaned `OrderItem` Without Parent Order**:
   Creating `/users/user_1/orders/nonexistent_ord/items/item_1` without parent order -> **REJECTED** (Master Gate `exists` / `existsAfter` fails).
10. **Payload 10 — Client Timestamp Forgery**:
    Creating `Order` with `createdAt: Timestamp(2020, 1, 1)` -> **REJECTED** (`incoming().createdAt == request.time` fails).
11. **Payload 11 — Telemetry Enum & Range Poisoning**:
    Saving `TelemetryConfig` with `panelRange: "9999W"` or `fanSpeed: 99` -> **REJECTED** (`isValidTelemetryConfig` enforces strict allowlist & numeric bounds).
12. **Payload 12 — Unauthorized List Query Scraping**:
    `auth.uid = "attacker_9"` issuing `list` query on `/users/victim_1/orders` -> **REJECTED** (`isOwner(userId) && resource.data.userId == request.auth.uid` fails).

---

## 3. Red Team Conflict Report

| Collection | Identity Spoofing | State Shortcutting | Resource / Value Poisoning | `isValid[Entity]` Wrapping Update | Audit Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/users/{userId}` | Blocked (`uid == auth.uid`) | N/A (`createdAt` immutable) | Blocked (`maxLength` + `hasOnly`) | Present | PASS |
| `/users/{userId}/private/{docId}` | Blocked (`uid == auth.uid` + Master Gate) | N/A | Blocked (`maxLength` + `docId == 'contact'`) | Present | PASS |
| `/users/{userId}/orders/{orderId}` | Blocked (`userId == auth.uid` + Master Gate) | Blocked (`paid` -> `cancelled` only; terminal lock) | Blocked (`verificationDigest` hex regex + bounds) | Present | PASS |
| `/users/{userId}/orders/{orderId}/items/{itemId}` | Blocked (`userId == auth.uid` + Master Gate) | Blocked (`update` & `delete` denied) | Blocked (`quantity` 1..50, `unitPriceUsd` > 0) | Immutable | PASS |
| `/users/{userId}/telemetryConfigs/{configId}` | Blocked (`userId == auth.uid` + Master Gate) | N/A | Blocked (strict enum + integer bounds) | Present | PASS |
