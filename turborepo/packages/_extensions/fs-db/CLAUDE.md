# @repo/extension-fs-db

A simple, Git-friendly "File System Database" for managing JSON data in the repository.
Designed for admin extensions, configuration management, and simple data storage that should be version controlled.

## Features
- **Collections**: Manage folders of JSON files (e.g. `data/users/*.json`) as a collection.
- **Documents**: Manage single JSON files (e.g. `data/settings.json`).
- **Zod Validation**: All data is validated on read/write.
- **Git Friendly**: Data is stored as formatted JSON files.
- **TRPC Integration**: One-line helpers to expose collections via TRPC.

## Usage

### 1. Define a Schema
```ts
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["admin", "user"]),
});
export type User = z.infer<typeof UserSchema>;
```

### 2. Create a Collection
```ts
import { createJsonCollection } from "@repo/extension-fs-db";

// Creates a collection at <repo-root>/data/users
export const users = createJsonCollection("data/users", UserSchema);
```

### 3. Use in Node.js (Backend)
```ts
// List all
const allUsers = await users.list();

// Get one
const user = await users.get("alice");

// Create/Update
await users.set("alice", { name: "Alice", role: "admin" });

// Delete
await users.delete("alice");
```

### 4. Expose via TRPC
```ts
import { createCollectionRouter } from "@repo/extension-fs-db";
import { createTRPCRouter } from "@repo/trpc-base-server";

export const appRouter = createTRPCRouter({
  users: createCollectionRouter(users),
});
```

## API Reference

### `createJsonCollection<T>(path, schema)`
Creates a collection interface.
- `path`: Relative path to repo root (e.g. "data/posts").
- `schema`: Zod schema for the items. Items must have an `id` field.

### `createJsonDocument<T>(path, schema, defaultData?)`
Creates a single-file interface.
- `path`: Relative path to repo root (e.g. "data/config.json").

### `createCollectionRouter(collection)`
Returns a TRPC router with `list`, `get`, `set`, `delete` procedures.

### `createDocumentRouter(document)`
Returns a TRPC router with `get`, `set` procedures.
