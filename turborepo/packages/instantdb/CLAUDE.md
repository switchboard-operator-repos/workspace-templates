# InstantDB

InstantDB is a modern Firebase like database for full-stack apps with a sync engine built in. It acts like a relational database and offers reactive queries out of the box (aka, using InstantDB hooks on the frontend automatically listen for and pushes data changes). This also means that any client data mutations happen optimistically / instantly and sync with the database in the background. When possible, we should opt to make mutations on the client/frontend, and they will appear to the user instantly. Server-side mutations are also ok, and will sync with the client automatically.

## 0) Golden rules

* `i.json` attributes are untyped (“any”). Treat them defensively and validate at boundaries.
* All attributes are **required by default** — use `.optional()` only where the schema marks it.
* **Links cannot carry attributes** and are **not ordered**. Never store metadata on a link; put it on a dedicated entity (e.g., `organizationMemberships`, `teamMemberships`) and use links to connect.
* Special entities:

  * **`$users`** and **`$files`** may **only** appear on the **reverse** side of links. You **cannot** add attributes to `$users`; attach per‑user fields to `userProfiles` and link `$users` ⇄ `userProfiles`.
* Ordering & comparisons require **indexed, typed** attributes; otherwise queries will reject.
* Links aren’t ordered; when you need order within a collection (e.g., UI parts), store a **sequence attribute** (`orderInMessageIndex`) and **index** it.

---

## 1) Mental model (InstaQL “shape‑of‑data”)

You **query by the shape you want to receive**: top‑level namespaces map to entities; nested keys traverse links. Think “GraphQL‑like” but zero config. Queries are **live** with `db.useQuery` (React) and **one‑shot** with `db.queryOnce`/`admin.query`.

---

## 2) Query syntax essentials

### 2.1 Top‑level and nested

```ts
// All teams in an org, including members (users) and their roles
const query = {
  teams: {
    $: { where: { 'organization.id': orgId }, order: { name: 'asc' } },
    teamMemberships: {
      $: { order: { joinedAt: 'asc' } },
      $user: {}, // follow teamMembership_user$ → $users
    },
  },
};
const { data } = db.useQuery(query);
```

* Use `where` on attributes **or** on **dot‑paths** across links (e.g., `'organization.id'`).
* `order` works on **indexed** attributes; you **may** order nested namespaces, but **not by nested attributes** (e.g., cannot `order: { 'owner.name': 'asc' }`). ([instantdb.com][3])

### 2.2 Filters & operators

All in the `$` option map:

* Comparisons: `$gt`, `$gte`, `$lt`, `$lte` (require **indexed & typed** columns).
* Equality variants: `$ne`, `$in`.
* Null checks: `$isNull: true|false`.
* Text search: `$like` (case‑sensitive) and `$ilike` (case‑insensitive) on **indexed strings**.
* Logical composition: `{ and: [/* clauses */] }`, `{ or: [/* clauses */] }`. ([instantdb.com][3])

**Examples from our domain**

```ts
// Active organization memberships for a user (never left/removed)
const q1 = {
  organizationMemberships: {
    $: {
      where: {
        '$user.id': userId, // reverse link traversal
        leftAt: { $isNull: true },
        removedAt: { $isNull: true },
      },
      order: { joinedAt: 'desc' },
    },
    organization: {}, // join org
  },
};

// Case-insensitive team search by name prefix (index required on teams.name)
const q2 = {
  teams: {
    $: { where: { name: { $ilike: `${prefix}%` } }, order: { name: 'asc' } },
  },
};
```

### 2.3 Selecting specific fields (and pagination)

Use `fields` to select only the attributes you need. This lowers payload size and minimizes re‑renders when unrelated attributes change.

- Place `fields` inside the `$` options map for the namespace you are selecting.
- `id` is always included even if not specified.

Top‑level example

```ts
const query = {
  personaBios: {
    $: {
      fields: ["name", "company", "status"],
      order: { createdAt: "desc" },
      first: 20,
    },
  },
};
const { isLoading, error, data } = db.useQuery(query);
// data.personaBios -> [{ id, name, company, status }, ...]
```

Nested example

```ts
const query = {
  teams: {
    $: { fields: ["name"] },
    teamMemberships: {
      $: { fields: ["id"] },
      $user: { $: { fields: ["email"] } },
    },
  },
};
```

Notes
- `fields` is per‑namespace; set it wherever you want to narrow returned attributes.
- `fields` does not restrict access — use permissions to protect sensitive data.

Pagination (top‑level only)

- Offset: `{ $: { limit: 20, offset: 40 } }`
- Cursors: `{ $: { first: 20, after: pageInfo?.<ns>.endCursor } }` and `{ last, before }` ([instantdb.com][3])

### 2.4 Ordering gotchas you must remember

* You **can** order nested namespaces (e.g., a prompt’s versions by `createdAt`).
* You **cannot** order by a **nested attribute** (`'owner.name'` in `order` is invalid), but you **can** filter by nested attributes in `where`. ([instantdb.com][3])

---

## 3) Write syntax (InstaML)

Use `db.transact(...)` with **actions** on the `db.tx` proxy:

* `create`, `update`, `merge`, `delete`, `link`, `unlink`
* `id()` for UUIDs; `lookup(attr, value)` to target a **unique** attribute (e.g., `$users.email`, `$files.path`, `prompts.name`) across `update`/`delete` and inside `link`/`unlink`.
* **All transactions in a call are atomic**. A single transact array can contain transactions for multiple entity types. Use **batching** for very large sets. ([instantdb.com][4])

**Examples grounded in our schema**

```ts
import { id, lookup } from '@instantdb/react';

// 3.1 Create a prompt and its first version (immutability: versions are append-only)
const promptId = id();
await db.transact([
  db.tx.prompts[promptId].update({ name: 'review-assistant' }), // 'name' is unique+indexed
  db.tx.promptVersions[id()]
    .update({
      content: 'Initial instructions...',
      commitMessage: 'v1 bootstrap',
      createdAt: Date.now(),
    })
    .link({ prompt: promptId }), // prompt_promptVersions forward link
]);

// 3.2 Add a new prompt version by friendly name via lookup
await db.transact(
  db.tx.promptVersions[id()]
    .update({
      content: 'Tweaked critique rules',
      commitMessage: 'highlight tone fixes',
      createdAt: Date.now(),
    })
    .link({ prompt: lookup('name', 'review-assistant') }),
);

// 3.3 Join a user to an organization with role (metadata sits on membership entity)
const membershipId = id();
await db.transact(
  db.tx.organizationMemberships[membershipId]
    .update({ role: 'admin', joinedAt: Date.now() })
    .link({ $user: userId, organization: orgId }),
);

// 3.4 UI message with ordered parts
const messageId = id();
await db.transact([
  db.tx.uiMessages[messageId]
    .update({ role: 'assistant', createdAt: Date.now() })
    .link({ trajectory: trajectoryId }),
  db.tx.uiMessageParts[id()]
    .update({ type: 'text', text: 'Hello!', state: 'complete', orderInMessageIndex: 0 })
    .link({ uiMessage: messageId }),
  db.tx.uiMessageParts[id()]
    .update({ type: 'tool-result', output: { foo: 'bar' }, state: 'complete', orderInMessageIndex: 1 })
    .link({ uiMessage: messageId }),
]);

#### AI trajectory guardrails
- Validate agent outputs *before* they touch InstantDB. Run `safeParse` (or equivalent) on model responses so you never persist malformed data.
- Normalise every `uiMessagePart` with a deterministic payload (no `undefined` values). If a schema requires text (`evidence`, `title`, etc.), supply a fallback string instead of leaving it empty.
- Always set `createdAt` on messages and `orderInMessageIndex` on parts so replay order is stable; treat `Date.now()` + incremental offsets as the minimum viable default.
- Keep provenance by linking domain records back to `uiMessagePart` IDs (see `linkProvenanceField`). That makes it trivial to explain how summaries or follow-up actions were produced.
- When persisting search results, store the raw source payload alongside the structured summary so the UI can render both without re-querying Parallel.

// 3.5 Merge when changing nested JSON 'state' to avoid clobbering other writers
await db.transact(db.tx.uis[uiId].merge({ state: { panel: { open: true } } }));

// 3.5 Upload / overwrite a file
const path = `${user.id}/avatar.png`;
await db.storage.uploadFile(path, file);

// or, set the content type and content disposition
const path = `${user.id}/orders/${orderId}.pdf`;
const { data } = await db.storage.uploadFile(path, file, {
  contentType: 'application/pdf',
  contentDisposition: `attachment; filename="${orderId}-confirmation.pdf"`,
});
// can link the file to another entity from the returned data
await db.transact(db.tx.profiles[profileId].link({ avatar: data.id }));

// Uploads and overwrites a file to 'demo.png'
await db.storage.uploadFile('demo.png', file);
await db.storage.uploadFile('demo.png', file2);

await db.storage.delete('demo.png'); // delete a file

// file is also available on the admin SDK, but must be through a buffer or stream
const { data } = await db.storage.uploadFile(dest, stream, {
  contentType: contentType,
  fileSize,
});
```

Idempotent upserts

When consuming external callbacks (e.g., webhooks), prefer a stable, unique business key and upsert with `lookup` to guarantee idempotency.

```ts
// Ensure the attribute is unique+indexed in the schema
// e.g., personaBios.runId: i.string().unique().indexed()
await adminDB.transact(
  adminDB.tx.personaBios[lookup('runId', runId)].merge({
    runId,
    status,
    bio,
    updatedAt: Date.now(),
  })
);
```

* Prefer `merge` when updating deep JSON blobs to avoid overwriting sibling keys from other clients. ([instantdb.com][4])
* Use `lookup` for unique columns (`prompts.name`, `$files.path`, `$users.email`, etc.). ([instantdb.com][4])

> **Cascade delete**: links on the **`has: "one"`** side may set `onDelete: "cascade"`; e.g., deleting an organization cascades to its teams in our schema. Model cascade only where safe. ([instantdb.com][2])

---

## 4) Indexing & performance checklists (strict)

* **Before** writing `order`, `$gt/$lt/$isNull/$like/$ilike` **ensure** the attribute is **indexed** and has a **checked type**; otherwise, you’ll get a validation error. ([instantdb.com][3])
* Use `serverCreatedAt` for “most recent persisted” ordering when you don’t have your own timestamp. ([instantdb.com][3])
* Prefer `fields: [...]` on both top‑level and nested selections to cut payloads and re‑renders. ([instantdb.com][3])
* **Paginate** top‑level namespaces (`limit/offset` or cursors). Nested pagination is not supported. ([instantdb.com][3])
* Keep transactions under service limits; batch when creating thousands of rows. ([instantdb.com][4])

---

## 5) `$users` and `$files` — do’s and don’ts

* `$users` appears **only on reverse links**. To add user attributes, use `userProfiles` and `userProfile_user$` link; to associate records to a user, link your entity → `$users` via the forward label the schema defines (e.g., `comment_author$user`). ([instantdb.com][1])
* `$files` is similar: reverse‑only. To attach a file, create a `$files` record (via storage), then **link** the domain entity to the file’s id (e.g., `userProfile_avatar$file`, `documentVersion_$file`). ([instantdb.com][5])

**Avoid creating entities in the $files or $users tables through db.transact!** You may update them this way.

---

## 6) Admin vs client code in this monorepo

* **Client** (React, live): `db.useQuery`, `db.transact`, `db.queryOnce`
* **Admin/server** (scripts, API routes): `adminDB.query`, `adminDB.transact`; may **impersonate** a user with `adminDB.asUser({ email | token | guest })` to evaluate permissions like a user. ([instantdb.com][6])

---

## 7) Strongly‑typed usage tips

* Pass `schema` to `init` for intellisense and type‑safety.
* Use utility types where helpful:

  * `InstaQLParams<AppSchema>` to type queries,
  * `InstaQLResult<AppSchema, Query>` to type results. ([instantdb.com][3])

---

## 8) Pitfalls to avoid (seen in PRs)

* ❌ Ordering on unindexed columns (query fails) → **Index first**.
* ❌ Assuming link insertion order is preserved → **Never true**; use explicit `orderInMessageIndex`.
* ❌ Storing membership/user metadata on a link → **Links carry no attributes**; store on `organizationMemberships`/`teamMemberships`.
* ❌ Adding attributes to `$users` or linking from `$users` forward → **Not allowed**.
* ❌ Expecting nested `limit` → **Only top‑level supports limit/cursors**; restructure query.

---

## 8.5) Troubleshooting writes (schema, indexes, ticks)

- Schema not pushed: If you see `InstantAPIError: Validation failed for steps: Attributes are missing in your schema`, your deployed app’s schema is missing attributes you write locally. Push the schema:
  - `cd packages/instantdb/db && bunx --bun instant-cli push schema -y`
  - If permissions are used, also: `bunx --bun instant-cli push perms -y`
  - Ensure env vars are set where you run the CLI: `INSTANT_APP_ID`, `INSTANT_APP_ADMIN_TOKEN` (and for clients, `NEXT_PUBLIC_INSTANT_APP_ID`).
- Required vs optional: All attributes are required by default — mark `.optional()` where you truly write sparsely.
- Indexing: Any `order`, `$lte/$gte/$lt/$gt`, or `$isNull` in queries requires indexed, typed attributes. For a polling worker, index `nextPollAt`, `updatedAt`, and `status`.
- Leases for workers: To avoid multi‑tab/worker races, atomically set `claimedBy` and `claimUntil` with a single `transact` before ticking. Clear/extend as needed.

---

## 9) Mini reference (copy‑ready snippets)

**Init once (client)**

```ts
import { init } from '@instantdb/react';
import schema from '~/db/instant.schema';

export const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  schema,
  // Optional: return Date objects for date columns
  useDateObjects: true,
});
```

**Init once (admin/server)**

```ts
import { init } from '@instantdb/admin';
import schema from '~/db/instant.schema';

export const adminDB = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!, // shared appId for client and admin
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
  schema,
});
```

([instantdb.com][7])

**One‑shot vs live**

```ts
// live (React)
const { data, isLoading, pageInfo } = db.useQuery({ teams: { $: { limit: 20 } } });

// one-shot (client)
const { data: once } = await db.queryOnce({ teams: {} });

// backend
const { teams } = await adminDB.query({ teams: {} });
```

([instantdb.com][3])

**Transactions**

```ts
import { id, lookup } from '@instantdb/react';

// Create + link
await db.transact([
  db.tx.teams[id()].update({ name: 'Legal Ops' }).link({ organization: orgId }),
]);

// Update (strict mode)
await db.transact(db.tx.teams[teamId].update({ name: 'Legal' }, { upsert: false }));

// Delete (cascades apply per schema)
await db.transact(db.tx.documents[docId].delete());

// Link / Unlink
await db.transact(db.tx.comments[commentId].link({ $user: userId, commentThread: threadId }));
await db.transact(db.tx.comments[commentId].unlink({ commentThread: threadId }));
```

## 10) Other notes

* When in doubt, **reshape the query** so the thing you need to `limit` or paginate is **top‑level**, and use `fields` to keep payloads small.
* **Never** store state on links. If you find yourself wanting “link attributes,” it’s a sign you need a real entity (like our membership entities).
* Use **`lookup`** for all friendly identifiers (`$users.email`, `$files.path`, `prompts.name`).

---

## Appendix A — Operator cheat‑sheet

| Feature                      | Where it works               | Notes                                                                                                                                 |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `where` with dot paths       | Top‑level & nested           | Filter by associated values like `'organization.name'`. ([instantdb.com][3])                                                          |
| `order`                      | Top‑level & nested           | **Only** by attributes on that namespace; attribute must be **indexed & typed**; no nested attribute in `order`. ([instantdb.com][3]) |
| `limit / offset`             | Top‑level only               | Use top‑level reshape for per‑group “limit 1”. ([instantdb.com][3])                                                                   |
| `first/after`, `last/before` | Top‑level only               | Cursor pagination with `pageInfo`. ([instantdb.com][3])                                                                               |
| `$like` / `$ilike`           | On indexed string attributes | `%` wildcards: prefix/suffix/contains. Case sensitivity as named. ([instantdb.com][3])                                                |
| `$gt/$gte/$lt/$lte`          | On indexed, typed attributes | Dates accepted as ISO strings or timestamps. ([instantdb.com][3])                                                                     |

---

## Appendix B — Entities & links you’ll use most often

* **Users & Profiles**

  * `$users` ⇄ `userProfiles` (`userProfile_user$`, required `one:one`)
  * **Do not** add attributes to `$users`. Use `userProfiles` instead. ([instantdb.com][1])
* **Organizations & Teams**

  * `organizations` ⇄ `teams` (`onDelete: "cascade"` from org → teams)
  * Memberships carry `role`, `joinedAt`, `leftAt`, `removedAt`.
* **Prompts & Versions**

  * `prompts.name` is **unique+indexed** — use `lookup('name', ...)`. Versions are immutable; “rollback” = new version with prior content.
* **Documents & Versions**

  * `documentVersions` link to `$files`; newest by `createdAt`; optional parent link enables branching.
* **Conversations UI**

  * `trajectories` → `uiMessages` → `uiMessageParts` (order by `orderInMessageIndex`).
* **Comments & Threads**

  * `commentThreads` (anchor fields, status) → `comments` (author = `$users`).

---

### Sources for the semantics above

* InstaQL (reading data): nested filters, ordering, pagination, fields, operators; `queryOnce`. ([instantdb.com][3])
* InstaML (writing data): actions, `merge`, `lookup`, atomicity, batching. ([instantdb.com][4])
* Modeling data: types, required/optional, indexing for order & comparisons, cascade delete rules. ([instantdb.com][2])
* Backend/admin usage & impersonation. ([instantdb.com][6])
* `$users` (reverse‑only, no attributes) and `$files` reverse‑only linking constraints. ([instantdb.com][1])

---

## Schema

@src/instant.schema.ts
