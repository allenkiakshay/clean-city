# CleanCity — Build Plan

A hybrid municipal waste platform. **IoT bin sensors** where the hardware exists,
**citizen photo reports** everywhere else — both feeding one queue, one map, and one
status thread the reporter can actually follow.

**Stack:** Next.js 16 (App Router) · TypeScript strict · MongoDB Atlas · Mongoose 9 ·
Auth.js v5 (Google + email) · Leaflet + OpenStreetMap · deployed on Vercel

> Web version of this document (same content, easier to read/share):
> https://claude.ai/code/artifact/640496ff-f64b-4cdf-b354-447107f61217

## Where this is right now

**Built:** scaffold, data layer, auth (Google + email/password, role gating), the whole
citizen reporting loop — all three posting modes, geo-deduplication, priority scoring,
redaction, claim links, notifications — and the **admin verification queue**: the report state
machine, verify / reject / assign / merge, trust and points effects, SLA deadlines, dashboard
KPIs, bin registry, a Leaflet map coloured by priority — and the **crew app**: task list with
client-side distance sorting, start, after-photo upload, resolve. **The loop now closes** — a
citizen report goes all the way to Resolved with a before/after and a notification — plus the
**public map and analytics**: Leaflet map with a heat layer, monthly leaderboard, SLA
compliance, trend and category charts, and bin-placement suggestions.
Photos are stored in MongoDB rather than object storage, so **nothing but Atlas and Google
OAuth is needed to deploy**. 98 unit tests, all gates green, 27 routes.

**Next:** deploy.

**Deferred:** the IoT sensor half. Complaints are filed **manually by citizens** for now.
Bins, `sensorreadings` and the `+25` sensor term in the priority formula all stay in the
schema and the code — the seed still creates 12 bins with device records — so the hybrid
architecture is demonstrable and the sensor phase is a drop-in later. Nothing has to be
rebuilt to switch it on; see §12.

---

## Contents

1. [Why neither half works alone](#1-why-neither-half-works-alone)
2. [Architecture](#2-architecture)
3. [Three ways to report, and what stops the spam](#3-three-ways-to-report-and-what-stops-the-spam)
4. [Accounts and sign-in](#4-accounts-and-sign-in)
5. [Priority scoring](#5-priority-scoring)
6. [Report lifecycle](#6-report-lifecycle)
7. [Data model](#7-data-model)
8. [Why Mongoose, not Prisma](#8-why-mongoose-not-prisma)
9. [Screens](#9-screens)
10. [API surface](#10-api-surface)
11. [Stack, pinned](#11-stack-pinned)
12. [Build order](#12-build-order) — incl. the deferred sensor phase
13. [Deployment](#13-deployment)
14. [Traps already handled](#14-traps-already-handled)
15. [Done means](#15-done-means)

---

## 1. Why neither half works alone

A fill-level sensor knows exactly one thing: how full its own bin is. It is blind to the
litter scattered *around* the bin, to the roadside dump two streets over, to every square
metre of the city where no bin was ever installed.

A citizen reporting app has the opposite problem. It sees everything — but only when
somebody happens to be looking, happens to care, and happens to believe the report will go
anywhere. Most civic reporting apps die at that last clause.

Running both against a single backend fixes each one's blind spot, and produces a third
thing neither has on its own: **corroboration**. When a sensor says 94% and four people
photograph the same corner within an hour, that is not two signals — it is one very
high-confidence signal, and the system should route a crew accordingly.

| | Sensors only | App only | Both, one pipeline |
|---|---|---|---|
| **Coverage** | Only instrumented bins | Anywhere a person walks | Instrumented bins *and* everywhere else |
| **Latency** | Immediate, automatic | Waits for a passer-by to care | Automatic where instrumented, crowd-driven elsewhere |
| **Confidence** | One unverified number | One unverified photo | Cross-checked — sensor plus crowd raises priority |
| **Accountability** | Invisible to the public | Visible, but stalls if nobody acts | Public status thread with an SLA clock on it |
| **Planning value** | Usage per existing bin | Where complaints cluster | Density heatmap → where to put the *next* bin |

---

## 2. Architecture

Both sources write into the same `reports` collection. That single decision is what makes
one queue, one map and one analytics view possible instead of three parallel systems that
disagree with each other.

```
    DETECT                INTAKE                  VERIFY                    ACT

┌────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ IoT bin sensor │┄ ┄▶                  │──▶│  Auto-verified   │──┐
│ (later — §12)  │   │ Intake & scoring │   │ sensor ≥90% ×2   │  │   ┌─────────────────────┐
└────────────────┘   │                  │   │ or trust ≥ 80    │  ├──▶│   Crew dispatch     │
                     │ one collection   │   └──────────────────┘  │   │ geo + photo + prio  │
┌────────────────┐   │ dedupe ≤ 50 m    │                         │   │ after-photo→Resolved│
│  Citizen app   │──▶│ trust check      │   ┌──────────────────┐  │   └──────────┬──────────┘
│ named · hidden │   │ priority 0–100   │──▶│   Admin queue    │──┘              │
│ · anonymous    │   └──────────────────┘   │ human check      │                 │
└───────▲────────┘                          │ merge duplicates │                 │
        │                                   └──────────────────┘                 │
        └───────────── status update + notification back to the reporter ────────┘
```

That return path is the part most civic reporting systems omit, and the reason citizens
stop using them. Every status change appends a timeline entry **and** writes a notification,
so "Reported" never becomes a dead end. Anonymous reporters get the same thread through a
claim link — see §3.

The dashed sensor feed is designed in but **not built yet** — every report today comes from a
person. The intake path does not care which source a report arrives from, which is the whole
reason turning sensors on later is additive rather than a rewrite.

Sensor readings will skip human review because the device is authenticated. Citizen photos do
not — unless the reporter's trust score has earned it.

---

## 3. Three ways to report, and what stops the spam

Two decisions pull against each other here, and the plan has to reconcile them rather than
list them.

Dropping AI verification removed the automated spam filter. Adding **anonymous submission**
removes the account that the remaining defences hang off. Both are deliberate: lowering the
barrier is how you get reports from people who would never create an account, and anonymity
genuinely matters when the thing being reported is a local business dumping at night. But
something has to catch the abuse instead.

### "Anonymous" means two different things

Conflating them is how apps end up promising privacy they do not deliver:

- **Hidden from the public** — signed in, but the report shows "A resident" rather than a
  name. The system still knows who submitted it.
- **No account at all** — nothing links the report to a person.

CleanCity supports both, and treats them differently:

| | Named | Hidden | Anonymous |
|---|---|---|---|
| **Account** | required | required | none |
| **Public sees** | reporter's name | "A resident" | "A resident" |
| **Staff see** | name | name | nothing but the report |
| **Points & leaderboard** | yes | yes, opt-in as "Anonymous resident" | no |
| **Trust score** | earns & spends | earns & spends | none |
| **Auto-verify fast path** | if trust ≥ 80 | if trust ≥ 80 | **never** |
| **Can confirm others' reports** | yes | yes | **no** |
| **Tracking** | `/me` + notifications | `/me` + notifications | claim link |

### What stops abuse

This is a science-fair project, not a public deployment, so the defences are
deliberately minimal. Two remain, both because they are *product* logic rather
than security infrastructure — removing them would make the demo worse:

1. **Geo-deduplication.** A second report within 50 m of an open report of the
   same category is absorbed rather than creating a new queue item. For a
   signed-in reporter it becomes a confirmation; for an anonymous one it is
   silently folded in.
2. **Confirming requires an account.** Corroboration raises the priority score,
   so leaving confirmation open to anonymous traffic would make the number
   trivially gameable and the scoring demo meaningless.

Signed-in reporters also keep the **trust score** (`+2` verified, `−10`
rejected; above 80 skips the queue), and **anonymous reports are never
fast-pathed** — they always go to the admin queue.

> **What was cut, and what that means.** An earlier revision specified
> Cloudflare Turnstile plus per-device and per-IP rate limiting in a TTL
> collection. Both were removed as unnecessary for a science fair. The
> consequence, stated plainly: a public deployment would have **no bot
> protection and no abuse throttling** — anyone could script submissions
> against `/api/reports` and `/api/upload`. Fine for a demo and a judged
> project; not fine for a real municipality, where those two would need to come
> back before launch.

### Honesty about what "hidden" means

A hidden-name report is still visible to municipal staff; that is unavoidable if abuse is to
be handled at all. The submit screen says so in plain words rather than implying more
privacy than exists:

> *Your name will not be shown publicly. Municipal staff can still see it.*

An anonymous report is genuinely unlinked — there is no account, and the device cookie holds
a random identifier rather than anything about the person.

### Following an anonymous report

An anonymous reporter still needs to know whether anything happened. On submit they get a
**claim link** — the report URL plus a one-time unguessable token, `/reports/[id]?t=…` —
shown on screen and saved to `localStorage`. If they later create an account,
`POST /api/reports/[id]/claim` attaches the report to it, and the points come with it. No
email address is required at any point.

---

## 4. Accounts and sign-in

Two providers on Auth.js v5, both landing in the same `users` collection:

- **Google** — one click, the path most people will take.
- **Email and password** — Credentials provider, for people who will not use Google and for
  municipal staff accounts that are created rather than self-registered.

Sessions are **JWT**, not database sessions. That is what keeps `middleware.ts` edge-safe:
the role check reads the token and never opens a database connection.

### Why not Firebase Auth

Considered and rejected. Firebase would have made the Google setup nearly automatic and would
have let preview deployments do Google sign-in, since the callback lands on
`<project>.firebaseapp.com` rather than the Vercel URL. Both are real advantages.

They do not outweigh two costs. **Two identity stores** — Firebase owns the user record while
MongoDB owns `role`, `points`, `trustScore` and `zone`, so every request becomes verify-token
then look-up-by-`firebaseUid`. And **role gating stops being native**: the Firebase ID token
carries Firebase's claims, so `role` has to become a custom claim that only propagates on token
refresh (a role change can take up to an hour to take effect), and `firebase-admin` cannot run
on the edge runtime, so middleware would verify the token by hand against Google's public keys.

Auth.js does all of that natively against the one `users` collection we already have. The
redirect-URI registration is a ten-minute one-time annoyance; a sync layer is permanent.

Firebase would win if **phone/OTP login** were required — Auth.js has no phone provider and
that would mean wiring an SMS gateway directly. It is not in scope: Google and email/password
only.

### No adapter — deliberate

`@auth/mongodb-adapter` exists and is the obvious reach. It is not used, because it owns its
own `users` document shape, and ours already carries `role`, `points`, `trustScore`, `zone`
and `accounts[]` that the adapter knows nothing about. Two competing owners of one collection
is a bad trade for roughly twenty lines of code.

Instead the `signIn` callback upserts into our single Mongoose-owned `users` collection and
appends to the embedded `accounts[]` array. One user model, queried the same way everywhere
else in the app.

### Account linking, and the takeover trap

Someone signs up with email and password, then later clicks "Continue with Google" using the
same address. Handled explicitly:

- Link **only if Google reports `email_verified: true`.** A verified Google email is proof of
  control of that mailbox.
- If it is not verified, **refuse and explain** — sign in with your password first, then link
  Google from account settings.

Auto-linking on an unverified email is a straightforward account-takeover path. It is the
default behaviour people accidentally ship.

### Roles are never self-assigned

Every self-registration — Google or password — lands as `CITIZEN`. `ADMIN` and `WORKER` are
granted by an existing admin from `/admin/users`, and the seed script creates the first
admin. Google sign-in must never be a route to an admin account.

---

## 5. Priority scoring

"Sensor plus multiple citizen reports equals high priority" is the right instinct, but a
crew needs a number they can sort by. Every report gets a 0–100 score, recomputed whenever
a signal changes:

```ts
// src/lib/priority.ts — pure function, no DB, fully unit-tested
score = categoryWeight        // DEAD_ANIMAL 40 · ILLEGAL_DUMP 35 · OVERFLOW 30
                              // DEBRIS 20 · LITTER 15
      + min(confirms, 5) * 6  // signed-in confirmations only     max +30
      + sensorBoost           // bin within 30 m read ≥85% in 2 h     +25
                              //   ^ always 0 until the sensor phase ships
      + zone.sensitivity      // school / hospital / market        0..15
      + ageEscalation         // +2 per 6 h left open             max +20

clamp(0, 100) → bucket → SLA clock
```

The function stays pure — the *inputs* are gathered by MongoDB, the arithmetic has no
database in it and runs in microseconds under Vitest.

Note the corroboration term: **only confirmations from signed-in accounts count.** The
scoring function never sees anonymous confirmations because the API never creates them.

Age escalation matters more than it looks: a low-priority litter report cannot be ignored
forever. It climbs on its own until somebody has to deal with it.

| Bucket | Score | SLA |
|---|---|---|
| `LOW` | 0–24 | 72 h |
| `MEDIUM` | 25–49 | 24 h |
| `HIGH` | 50–74 | 12 h |
| `CRITICAL` | 75–100 | 4 h |

The same four-stop scale colours bin fill levels on the map, priority chips in the queue,
and SLA state on the dashboard — one visual language across the product.

**Worked example.** Overflow reported beside a school, corroborated by three neighbours,
with a bin 12 m away reading 91%:

```
30 (overflow) + 18 (3×6) + 25 (sensor) + 12 (school zone) + 0 (fresh) = 85 → CRITICAL, 4 h
```

**The same report today**, with no sensor feed, scores 60 → HIGH, 12 hours. The `+25` is the
measurable difference the sensor half buys, and it is worth showing both numbers in a
presentation: it is the argument for the hybrid, quantified.

The same overflow on an empty industrial road with no corroboration scores 30 → MEDIUM,
24 hours. That difference is the whole point of merging the two feeds.

---

## 6. Report lifecycle

Six states. Transitions are validated server-side against the actor's role, and every legal
transition appends a timeline entry and writes a notification **in one transaction**. There
is no path that changes a report's state silently.

```
              admin verifies      admin assigns      crew starts      after-photo
 SUBMITTED ───────────────▶ VERIFIED ──────────▶ ASSIGNED ────────▶ IN PROGRESS ────────▶ RESOLVED
     │
     │ rejected · trust −10 (signed-in reporters only)
     ▼
 REJECTED   (terminal)
```

Sensor-sourced reports are created directly in `VERIFIED` and skip the first hop — the
device is authenticated, so there is nothing for a human to confirm. Anonymous reports never
skip it. `REJECTED` is terminal, and costs trust only where there is an account to charge.

Notifications go to the reporter's account; for anonymous reports the timeline is still
written, and the claim link is how it gets read.

---

## 7. Data model

Six collections. Two structural decisions drive the design:

- **Everything positional is GeoJSON with a `2dsphere` index.** Proximity is core logic
  here, not a nice-to-have, so it belongs in the database rather than in application loops.
- **Bounded child data is embedded; unbounded child data is a collection.** A report's
  timeline and confirmations are embedded, so the entire detail page is one document read
  with zero joins. Notifications are their own collection, because a user accumulates them
  without limit.

### `users`

```ts
{
  email: String,          // unique index
  emailVerified: Date,
  passwordHash: String,   // NULL for Google-only accounts — see traps
  name, phone, image: String,
  accounts: [{           // embedded — linked OAuth providers
    provider: 'google',
    providerAccountId: String,
    linkedAt: Date
  }],
  role: 'CITIZEN' | 'ADMIN' | 'WORKER',   // never self-assigned
  points: Number,         // default 0
  trustScore: Number,     // default 50
  hideNameByDefault: Boolean,             // remembers the reporter's preference
  zone: ObjectId          // crews are scoped to a ward
}
// indexes: { email: 1 } unique
//          { 'accounts.provider': 1, 'accounts.providerAccountId': 1 } unique sparse
//          { role: 1, points: -1 }   ← leaderboard
```

### `zones`

```ts
{
  name: String,
  wardCode: String,
  area:     { type: 'Polygon', coordinates: [[[lng, lat], ...]] },
  centroid: { type: 'Point',   coordinates: [lng, lat] },
  sensitivity: Number     // 0–15 · school, hospital, market
}
// indexes: { area: '2dsphere' }
```

The polygon earns its keep: assigning a report to a ward is a query, not a lookup table.

```ts
Zone.findOne({ area: { $geoIntersects: { $geometry: point } } })
```

### `bins`  *(schema live, readings deferred)*

```ts
{
  code: String,           // unique
  label: String,
  location: { type: 'Point', coordinates: [lng, lat] },
  zone: ObjectId,
  capacityLiters: Number,
  status: 'ACTIVE' | 'MAINTENANCE' | 'REMOVED',
  device: {               // embedded — strictly 1:1, always read together
    tokenHash: String,
    lastSeenAt: Date,
    batteryPercent: Number,
    firmware: String
  },
  latestReading: {        // denormalised so /api/map is ONE query, no join
    fillPercent: Number,
    recordedAt: Date
  },
  installedAt: Date
}
// indexes: { location: '2dsphere' } · { code: 1 } unique · { 'device.tokenHash': 1 }
```

### `sensorreadings` — a **time-series collection**  *(created, empty until §12)*

```ts
db.createCollection('sensorreadings', {
  timeseries: { timeField: 'recordedAt', metaField: 'bin', granularity: 'minutes' },
  expireAfterSeconds: 60 * 60 * 24 * 90        // 90-day retention, automatic
})

{ bin: ObjectId, recordedAt: Date, fillPercent, weightKg, batteryPercent }
```

Twelve bins reporting every five minutes is ~1.2 M documents a year; a time-series
collection buckets them automatically, cuts storage by roughly an order of magnitude, keeps
range scans fast, and expires old readings with no cron job to write.

### `reports`

```ts
{
  source: 'CITIZEN' | 'SENSOR',

  reporterMode: 'NAMED' | 'HIDDEN' | 'NONE',   // ← the three posting modes
  reporter:   ObjectId,   // set for NAMED and HIDDEN, null for NONE
  claimToken: String,     // set for NONE only — one-time tracking link

  bin: ObjectId,          // null for open-area reports
  location: { type: 'Point', coordinates: [lng, lat] },
  address: String,
  photoUrl: String,
  afterPhotoUrl: String,
  description: String,
  category: 'OVERFLOW' | 'LITTER' | 'ILLEGAL_DUMP' | 'DEAD_ANIMAL' | 'DEBRIS',
  status:   'SUBMITTED' | 'VERIFIED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED',
  priorityScore: Number,
  priorityBucket: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  zone: ObjectId,
  assignedTo: ObjectId,
  duplicateOf: ObjectId,
  slaDueAt: Date,

  confirmations: [{ user: ObjectId, at: Date }],                    // signed-in only
  timeline:      [{ type, actor: ObjectId, note, photoUrl, at }],   // embedded, bounded

  verifiedAt, resolvedAt, createdAt, updatedAt
}
// indexes:
//   { location: '2dsphere' }            ← dedupe + proximity
//   { status: 1, priorityScore: -1 }    ← the admin queue
//   { status: 1, slaDueAt: 1 }          ← SLA breach scan
//   { reporter: 1, createdAt: -1 }      ← /me and "my reports"
//   { claimToken: 1 }                   ← unique sparse
//   { assignedTo: 1, status: 1 }        ← crew task list
//   { 'confirmations.user': 1 }         ← block double-confirmation
```

`reporterMode` is stored explicitly rather than inferred from `reporter === null`, so no
serialisation path can accidentally leak a name that was meant to be hidden. Public API
responses are built by a single `toPublicReport()` projector that drops `reporter`,
`claimToken` unless the viewer is staff.

### `photos`

```ts
{ data: Buffer, contentType: String, size: Number, createdAt: Date }
```

Photos live in their **own collection, never on the report document**. The admin queue loads
a hundred reports at a time; if each carried ~300 KB of image bytes, every `Report.find()`
in the app would drag 30 MB behind it. The report holds only `photoUrl: "/api/photos/<id>"`,
so reports stay small and every existing query is untouched.

Plain BSON binary rather than GridFS: the browser downscales to a few hundred KB before
upload, nowhere near the 16 MB document ceiling, so GridFS's chunking would be pure overhead.
Atlas M0 gives 512 MB — roughly 1,700 photos.

The trade is that there is **no CDN**: every view hits a function and the database. The route
sets `Cache-Control: immutable`, so the browser cache is what keeps repeat views off Atlas.

### `notifications`

```ts
{ user: ObjectId, report: ObjectId, title, body, readAt: Date, createdAt }
// indexes: { user: 1, createdAt: -1 } · { user: 1, readAt: 1 }
```

### The queries that used to be application code

Against a relational store these were "fetch candidates, then filter in JS". Here they are
one query each, served by the `2dsphere` index, with distances in **metres**:

```ts
// dedupe — is there already an open report of this kind within 50 m?
Report.findOne({
  category,
  status: { $in: ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'] },
  createdAt: { $gte: dayAgo },
  location: { $near: { $geometry: point, $maxDistance: 50 } }
})

// sensor boost — a nearly-full bin within 30 m, seen in the last 2 hours?
Bin.findOne({
  location: { $near: { $geometry: point, $maxDistance: 30 } },
  'latestReading.fillPercent': { $gte: 85 },
  'latestReading.recordedAt':  { $gte: twoHoursAgo }
})
```

Analytics are aggregation pipelines: `$group` on a rounded coordinate grid for the heatmap,
`$group` on `$dateTrunc` for trends, and for bin-placement suggestions a grid of dense
`LITTER` cells joined via a `$lookup` whose sub-pipeline runs `$geoNear` to confirm no bin
sits within 100 m.

### Logic that stays outside the framework

Pure modules, no Mongoose or Next imports, unit-tested in milliseconds:

| Module | Exports | Responsibility |
|---|---|---|
| `lib/priority.ts` | `computePriority()` | Score and bucket from category, confirmations, sensor proximity, zone, age |
| `lib/workflow.ts` | `canTransition()`, `applyTransition()` | Legal state moves per role; throws on anything else |
| `lib/sla.ts` | `slaDeadline()` | Bucket → deadline hours |
| `lib/geo.ts` | `haversineMeters()`, `toGeoJSON()`, `toLeaflet()` | Client-side distance display, and the **coordinate-order conversion** between Leaflet `[lat, lng]` and GeoJSON `[lng, lat]` |
| `lib/redact.ts` | `toPublicReport()` | The single place reporter identity is stripped for public responses |

---

## 8. Why Mongoose, not Prisma

Prisma does support MongoDB, and keeping it would have preserved the schema-file workflow.
It was rejected for one concrete reason: **Prisma's MongoDB connector has no typed
geospatial query support.** `$near`, `$geoWithin` and `$geoNear` are not expressible in the
Prisma client API, so dedupe, sensor proximity, zone assignment and bin-placement analysis
would all drop through to `$runCommandRaw` / `aggregateRaw` — untyped escape hatches.

That inverts the reason to use Prisma at all. The most important queries in the system would
be the least type-safe ones. Mongoose 9 declares `2dsphere` indexes in the schema, types the
geospatial operators, and gives real TypeScript inference on documents.

**What genuinely improves with MongoDB here**

- Proximity moves into the database — the 50 m and 30 m rules become index-served queries.
- Sensor readings get time-series collections: automatic bucketing, ~10× storage reduction,
  TTL expiry with no cron job.
- A report detail page is one document read; the timeline and confirmations come with it.
- No migration step in the deploy pipeline.

**What is genuinely harder, and how it is handled**

- *No referential integrity.* Nothing stops a dangling `assignedTo`. Mitigation: every write
  path goes through a service function in `src/server/`, never a raw model call from a route
  handler, and deletes are soft (`status: 'REMOVED'`) rather than physical.
- *Schema drift.* Mongoose validates on write, but documents written before a schema change
  keep their old shape. Mitigation: `strict: 'throw'` on every schema, plus a versioned
  `scripts/migrate/` directory for the rare backfill.
- *Analytics are more verbose.* Aggregation pipelines are longer than the equivalent SQL.
  Accepted — they are confined to `src/server/analytics.ts` and covered by tests.

---

## 9. Screens

Role is carried in the JWT and gated in `middleware.ts`, so all three surfaces ship as route
groups inside one Next.js app rather than three codebases.

**Citizen** (public · `CITIZEN`)

| Route | Purpose |
|---|---|
| `/report` | Camera capture, GPS auto-tag, category, description, **posting-mode selector** |
| `/map` | Live bins by fill %, open reports, heatmap toggle |
| `/reports/[id]` | Public status thread, before & after photos; `?t=` token for anonymous reporters |
| `/me` | My reports, points, trust score, linked accounts |
| `/leaderboard` | Monthly ranking of active reporters |
| `/login` · `/register` | **Continue with Google**, or email and password |

The posting-mode selector defaults to whatever the reporter chose last
(`user.hideNameByDefault`), and is a three-way control, not a checkbox — "Post as *Name*" /
"Hide my name" / "Post anonymously". Signed-out visitors see only the third option, with a
one-line prompt that signing in earns points and lets them track reports without a link.

**Admin** (municipal staff · `ADMIN`)

| Route | Purpose |
|---|---|
| `/admin` | KPIs, SLA breaches, trend charts |
| `/admin/queue` | Split map + list: approve, reject, merge. Anonymous reports flagged as such |
| `/admin/reports/[id]` | Full detail, assign a crew |
| `/admin/bins` | Bin registry, device tokens, fill levels |
| `/admin/users` | **Grant `ADMIN` / `WORKER` roles**, review low-trust accounts |
| `/admin/analytics` | Heatmap, resolution times, bin placement suggestions |

**Crew** (field · `WORKER`)

| Route | Purpose |
|---|---|
| `/worker` | Tasks sorted by priority, then distance |
| `/worker/tasks/[id]` | Navigate, start, after-photo, resolve |

The crew view is designed thumb-first and one-handed: it is used standing next to a pile of
rubbish, not at a desk.

---

## 10. API surface

| Route | Auth | Does |
|---|---|---|
| `POST /api/ingest/sensor` | device token | **Deferred (§12).** Append a reading, update `bin.latestReading`; two consecutive readings ≥90% auto-create a VERIFIED report |
| `POST /api/reports` | signed-in **or** anonymous | Dedupe, trust check, score, create or confirm |
| `POST /api/reports/[id]/confirm` | **signed-in only** | Add corroboration, recompute priority |
| `POST /api/reports/[id]/claim` | signed-in + claim token | Attach an anonymous report to the new account, transfer points |
| `POST /api/upload` | open | Store a photo in MongoDB, return `/api/photos/<id>` |
| `GET /api/photos/[id]` | public | Stream the bytes, cached immutably |
| `PATCH /api/admin/reports/[id]` | admin | Verify, reject, merge duplicate, assign |
| `PATCH /api/admin/users/[id]` | admin | Grant or revoke a role |
| `PATCH /api/worker/tasks/[id]` | crew | Start, upload after-photo, resolve |
| `GET /api/map` | public | Bins with `latestReading`, open reports, heat points |
| `GET /api/stats` | public | Counters, SLA compliance, trend series |
| `GET /api/notifications` | any | Unread notifications for the signed-in user |

Every body is validated by a Zod schema shared verbatim with the client form — one
definition, both sides. Zod is also where `[lat, lng]` from the browser is converted to
GeoJSON `[lng, lat]`, so the swap happens in exactly one place.

Every response that can reach the public goes through `toPublicReport()`. There is no route
that serialises a raw report document to an unauthenticated client.

Any handler that changes report state wraps its writes in a MongoDB **transaction**, so a
status change, its timeline entry and its notification either all land or none do.

---

## 11. Stack, pinned

Versions resolved against npm on 2026-09-02.

| Layer | Package | Version | Why this one |
|---|---|---|---|
| Framework | `next` | 16.3.3 | Server components, route handlers, middleware in one deploy |
| Runtime | `react` | 19.2.8 | Required by Next 16 and react-leaflet 5 |
| Database | MongoDB Atlas | M0 free tier | 3-node replica set — so transactions work on the free plan |
| ODM | `mongoose` | 9.9.4 | Typed geospatial operators and `2dsphere` in the schema |
| Driver | `mongodb` | 7.6.0 | Transitive via Mongoose; direct for the time-series `createCollection` |
| Auth | `next-auth` | 5.0.0-beta.32 | **Pin exact.** Google + Credentials, JWT sessions |
| Hashing | `bcryptjs` | 3.0.3 | Pure JS — no native build step on Vercel |
| IDs | `nanoid` | 6.0.1 | Claim tokens for anonymous reports |
| Photos | MongoDB `photos` collection | — | BSON binary in its own collection, served by `/api/photos/[id]`. No third-party storage account needed |
| Maps | `leaflet` / `react-leaflet` | 1.9.4 / 5.0.0 | OpenStreetMap tiles — no API key, no billing account, no map quota |
| Heatmap | `leaflet.heat` | 0.2.0 | Density layer for the waste-prone-zone view |
| Charts | `recharts` | 3.10.1 | Admin trends and SLA compliance |
| Validation | `zod` | 4.5.4 | One schema for the form and the handler |
| Forms | `react-hook-form` | 7.87.0 | With `@hookform/resolvers` 5.9.1 |
| Polling | `swr` | 2.5.1 | 10 s refresh — survives serverless function limits that break long-lived SSE |
| Styling | `tailwindcss` | 4.3.3 | CSS-first config, plus shadcn/ui primitives |
| Tests | `vitest` | 4.1.11 | Unit tests for scoring, workflow, SLA, coordinate conversion, redaction |
| Scripts | `tsx` | 4.23.13 | Runs the seed, the index sync and the sensor simulator |

`@auth/mongodb-adapter` is **deliberately absent** — see §4.

**Local toolchain:** Node 20.19.5 · npm 10.8.2 · git 2.52 · Docker present.
Vercel CLI is 39.3.0 and needs upgrading (`npm i -g vercel@latest`).
**pnpm via corepack is broken on this machine — use npm.**

---

## 12. Build order

Ordered so that something demonstrable exists as early as possible, and so each phase is
testable before the next depends on it. **The IoT phase moved to the end** — citizens file
complaints manually for now, and the sensor feed is additive when it arrives.

**0 · Scaffold — done**
create-next-app with TypeScript, Tailwind, App Router, src directory. Pinned dependencies,
shadcn init, strict compiler options, `.env.example`.

**1 · Data and auth — done**
Atlas cluster. Cached connection helper. Six Mongoose schemas with indexes declared,
`scripts/ensure-indexes.ts` and the time-series `createCollection`. Auth.js with Google and
Credentials, JWT sessions, the `signIn` upsert and the verified-email linking rule. Split auth
config so middleware stays edge-safe. Role gating plus `/admin/users`. Seed: 3 zone polygons,
12 bins with devices, one user per role.

**2 · Citizen reporting, all three modes — done**
Report form with geolocation and photo upload, downscaled in the browser. Three-way
posting-mode selector. Shared Zod schema doing the coordinate conversion. Dedupe via `$near`.
Transactional create. `toPublicReport()` redaction with a staff-only block on the status page.
Claim link and the claim route. Status thread and notification centre.

**3 · Admin — done**
Verification queue as split map and list, served by `{ status, priorityScore }`. Verify,
reject, merge duplicates, assign a crew. Anonymous reports flagged. Dashboard KPIs. Bin and
device registry. The state machine in `lib/workflow.ts` is pure and exhaustively tested;
every action is one transaction writing status + timeline + notification together.
Merging costs the reporter no trust — a duplicate is not a bad report — and carries their
signal across as a confirmation on the surviving report.

**4 · Crew — done**
Task list from `{ assignedTo, status }`, sorted by priority then client-side distance —
computed in the browser, so the server never sees the crew's live position. Start,
after-photo upload, resolve → reporter notified and credited.

A crew member can only act on their own assignment; an admin keeps a photo-less resolve as
the fallback for when a crew cannot update from the field. **A worker cannot close a task
without an after photo** — it is the proof of work the reporter was promised, and the whole
reason the status thread is worth reading.

**5 · Map and analytics — done**
Public map at `/map` with report markers, bin markers and a `leaflet.heat` density layer,
each toggleable. Aggregation pipelines in `server/analytics.ts`: heat grid, trends, category
and priority breakdowns, SLA compliance, average resolution per ward, and bin-placement
suggestions. Monthly leaderboard at `/leaderboard`.

The leaderboard is **recomputed from reports** each month rather than read off the running
`points` total — a month has to be able to start again from zero. Someone who files with
their name hidden appears as "Anonymous resident" rather than being outed by a public board.

Bin-placement checks proximity with one `$near` per candidate cell rather than a `$geoNear`
sub-pipeline inside `$lookup`: there are only ever a handful of candidates, and this version
is readable.

**6 · Deploy — next**
Link the project, add the Atlas connection string, allow Vercel egress in Atlas network
access, register the Google OAuth redirect URIs, add a Blob store, run the index sync once
against production.
→ *Ships: a public URL*

---

### 7 · IoT sensor feed — **deferred**

Everything below is designed and scaffolded but deliberately not built yet. Complaints are
filed manually by citizens in the meantime.

*Already in place:* the `bins` collection with embedded `device` records, the `sensorreadings`
time-series collection, `bin.latestReading`, the `+25` sensor term in `computePriority()`, and
`findSensorBoost()` in `src/server/reports.ts` — which returns nothing today and simply
contributes 0.

*What the phase adds:*

- `POST /api/ingest/sensor` — device-token auth, appends a reading and updates
  `bin.latestReading` in one transaction.
- The two-consecutive-readings-≥90% rule that auto-creates a `VERIFIED` report.
- `scripts/simulate-sensors.ts` — a random-walk fill simulator, so no hardware is needed:
  ```bash
  npm run simulate -- --url http://localhost:3000 --interval 5000
  ```
  Bins change colour on the map, and one crossing 90% twice creates a report on the admin
  dashboard with nobody touching the UI. It posts to the same authenticated endpoint a real
  ESP32 would, so swapping the script for hardware changes nothing server-side.
- Bin fill colours on the map, and the sensor boost becoming live in scoring.

*Why it is a drop-in:* both sources write into the same `reports` collection, and the intake
path never branches on where a report came from. Turning sensors on adds a producer; it does
not change the queue, the map, or the scoring.

## 13. Deployment

MongoDB Atlas → create an **M0** cluster → Database Access user → Network Access.
Vercel's serverless egress is not a fixed IP range, so Atlas network access must be
`0.0.0.0/0` with a strong database password (the practical default for Atlas + Vercel), or
Atlas Private Endpoint on a paid tier.

**Google Cloud Console** → OAuth consent screen → Credentials → OAuth client ID (Web).
Authorised redirect URIs:

```
http://localhost:3000/api/auth/callback/google
https://<your-domain>/api/auth/callback/google
```

Google does not accept wildcard redirect URIs, so Vercel preview deployments cannot use
Google sign-in unless each preview URL is registered by hand. Set `AUTH_URL` to the
production domain and use the email/password provider when testing previews.

There is no migration step, so the build command is unchanged:

```bash
next build
```

Indexes are **not** created at build time. `autoIndex` is off in production; they are
synced once, explicitly, after the first deploy:

```bash
npm run db:indexes     # tsx scripts/ensure-indexes.ts — Model.syncIndexes() for each model
npm run db:seed        # tsx scripts/seed.ts
```

```bash
# environment
MONGODB_URI                     # mongodb+srv://... — includes the database name
AUTH_SECRET                     # npx auth secret
AUTH_URL                        # production origin — pins the Google callback
AUTH_GOOGLE_ID                  # Google OAuth client ID
AUTH_GOOGLE_SECRET              # Google OAuth client secret
HASH_PEPPER                     # hashes IoT device tokens; must match whatever
                                #   the seed used, or device tokens will not verify
```

---

## 14. Traps already handled

Each of these will otherwise cost an afternoon, so they are designed around from the start
rather than debugged later.

- **Serverless connection exhaustion.** Every lambda invocation would otherwise open a new
  connection and blow through Atlas's cap. `src/lib/mongo.ts` caches the connection promise
  on `globalThis` and reuses it across invocations. This is the single most important file
  in the data layer.
- **GeoJSON is `[longitude, latitude]`. Leaflet is `[latitude, longitude]`.** They are
  reversed, and getting it wrong puts Bengaluru in Somalia without throwing an error. All
  conversion is confined to `toGeoJSON()` / `toLeaflet()` in `lib/geo.ts`, applied at the
  Zod boundary, and unit-tested.
- **`bcrypt.compare` against a null hash.** Google-only accounts have no `passwordHash`. The
  Credentials provider must reject before comparing, or it throws — or worse, behaves
  inconsistently. One guard clause, one test.
- **OAuth auto-linking is an account-takeover path.** Link a Google identity to an existing
  email account only when Google reports `email_verified: true`. Otherwise refuse and route
  the user through password sign-in first.
- **Google rejects wildcard redirect URIs.** Vercel preview deployments therefore cannot use
  Google sign-in without registering each URL. Pin `AUTH_URL` and use password auth on
  previews.
- **Anonymous confirmations would be a free priority lever.** Confirmation requires an
  account; the scoring function never sees an anonymous one.
- **`middleware.ts` is deprecated in Next 16** — the convention is now `proxy.ts`. Same
  default export, same `config.matcher`.
- **`$near` cannot run inside a MongoDB transaction.** Dedupe, zone lookup and the sensor
  check are all reads gathered *before* the transaction opens; only writes go inside it.
- **`.lean()` returns BSON `Binary`, not a Node `Buffer`.** `new Uint8Array(binary)` on that
  silently yields an EMPTY array — the response still returns 200 with a correct
  Content-Length and the image just renders broken, with no error anywhere. `toBytes()` in
  `lib/photo.ts` does the conversion explicitly and is unit-tested against that exact shape.
- **`photoUrl` is a strict reference, not a URL.** `z.url()` rejects `/api/photos/<id>`
  outright, and an open `z.url()` would let anyone make the site render an image from any
  server. The regex accepts only photos this app stored.
- **A module-scope `throw` on a missing env var breaks the BUILD, not the request.**
  `next build` imports every route module to collect its config, so a top-level
  `if (!process.env.X) throw` fails the deploy with an error pointing at your file rather
  than at the missing variable. This is what broke the first Vercel deploy. Read runtime
  config *inside* the function that needs it. Where a module-scope guard is genuinely
  wanted (the Google provider), skip it for `NEXT_PHASE === "phase-production-build"` so a
  real deployment still fails loudly on its first request.
  Verify with: `mv .env.local .env.local.bak && npm run build` — it must succeed.
- **A page that reads the database is prerendered by default.** `/map` and `/leaderboard`
  both built as static (`○`) and would have served data frozen at build time.
  `export const dynamic = "force-dynamic"` is the fix; check the build output for `ƒ` vs `○`
  on any page with live data.
- **`leaflet.heat` is a plugin, not a module.** Importing it patches `L` with `heatLayer`
  rather than exporting anything, so the layer is attached imperatively via `useMap()`.
- **Leaflet's default marker icons break under bundlers.** `CircleMarker` needs no image
  assets at all, and lets the priority bucket carry colour — which is what an admin scans for.
- **`models.X ?? model("X", schema)` produces an uncallable union type.** Cast the export to
  `Model<XDocument>`, or every query has to be written through `.where().equals()` chains to
  dodge the union.
- **Redaction must be structural, not incidental.** `reporterMode` is an explicit field and
  `toPublicReport()` is the only serialiser for public responses, so a hidden name cannot
  leak through a route that forgot to omit it.
- **Model recompilation under hot reload.** `mongoose.models.Report || mongoose.model(...)`
  on every model, or dev throws `OverwriteModelError` on the second save.
- **Transactions need a replica set.** A standalone `mongod` silently is not one. Atlas M0
  is a replica set and works; for local Docker use `--replSet rs0` and initiate it, or point
  local dev at Atlas too.
- **Time-series collections must be created as such.** They cannot be converted from an
  existing normal collection — if Mongoose auto-creates `sensorreadings` first, it has to be
  dropped. `scripts/ensure-indexes.ts` creates it explicitly before any write.
- **`$near` requires the `2dsphere` index.** Without it the query errors rather than
  silently scanning — the good failure mode, but only if indexes are actually synced after
  deploy.
- **Mongoose does not run on the edge runtime.** Hence JWT sessions and a split auth config;
  middleware checks the token and never touches the database.
- **Leaflet is client-only.** The map is a `'use client'` wrapper that dynamically imports
  the canvas with `ssr: false` — that option is illegal inside a server component in Next 16.
- **4.5 MB request body cap.** Photos go browser → Blob directly; the server only mints the
  upload token. A modern phone photo would otherwise fail on upload.
- **Browser geolocation requires HTTPS.** Works on `localhost` and on Vercel; silently fails
  on a LAN IP during phone testing.

---

## 15. Done means

Not "the pages render" — done is the full loop working against the deployed URL.

- [ ] `tsc --noEmit`, lint and `next build` all clean
- [ ] Vitest green on scoring, workflow, SLA, coordinate conversion and redaction —
      including that illegal transitions throw, that the sensor boost applies only within
      30 m and 2 hours, that `toGeoJSON`/`toLeaflet` round-trip, and that `toPublicReport()`
      drops `reporter` for both HIDDEN and NONE
- [ ] `npm run db:indexes` reports every `2dsphere` index present, and `sensorreadings` is
      confirmed a time-series collection (empty until the sensor phase)
- [ ] **Google sign-in** creates a `CITIZEN` — never an admin — and appears in `/me` as a
      linked account
- [ ] Signing in with Google on an email that already has a password account **links** when
      the Google email is verified, and **refuses with an explanation** when it is not
- [ ] A named report shows the reporter's name publicly; a hidden report shows "A resident"
      while `/admin/queue` still shows the name
- [ ] An **anonymous** report submits with no account, is never fast-pathed, and is trackable
      through its claim link
- [ ] Confirming a report while signed out is refused
- [ ] A signed-out visitor asking for NAMED is forced to NONE and gets a claim link
- [ ] A second report at the same spot and category is absorbed as a duplicate, not queued twice
- [ ] Admin verifies and assigns; the crew starts, uploads an after-photo, resolves
- [ ] The reporter's status page reads **Resolved**, shows before and after, and a
      notification is waiting
- [ ] Creating an account and claiming an anonymous report transfers it and its points
- [ ] A second report 20 m from the first, same category, is recorded as a confirmation —
      priority rises, no duplicate queue item
- [ ] A forced failure mid-transition leaves no orphaned timeline entry or notification
- [ ] All of the above repeated against the production URL

**Deferred to the sensor phase (§12.7):**

- [ ] With the simulator running, bins change colour on the map and one crossing 90% twice
      creates a report unaided
- [ ] A citizen report within 30 m of a bin reading ≥85% scores 25 points higher than the
      same report away from one

---

*CleanCity is a working package name — trivially renamed. Plan revised 2026-09-02.*
