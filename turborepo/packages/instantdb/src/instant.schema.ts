// docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

/*
 * important modeling concepts:
 * - `i.json` attributes are NOT strongly typed or validated by the DB (they are basically type any)
 * - all attributes are required by default
 * - links CANNOT carry information (attributes)
 * - links are NOT ordered; we CANNOT assume that the order links are added / modified will be preserved
 * - `.indexed` is required to use `order` or comparison operators in queries (e.g. `$gt`, `$lt`, `$gte`, `$lte`, `$ne`, `$isNull`, and `$like` operators)
 * - `.unique` is required to use `lookup(attribute, value)` in place of an id
 */

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    /*
     * We CANNOT add ATTRIBUTES to the '$users' entity (it is a special system-level entity)
     *
     * To add user-specific attributes (tied 1:1 with a $user), we can add attributes to our own userProfiles entity.
     *
     * We CAN add LINKS to the '$users' entity, so when linking to the concept of a 'user', we should link to '$users', NOT 'userProfiles'.
     */
    userProfiles: i.entity({
      firstName: i.string(),
      lastName: i.string(),
    }),
    /*
     * An organization is a firm. It is a collection of teams (and thus users)
     */
    organizations: i.entity({
      name: i.string().indexed(),
    }),
    organizationMemberships: i.entity({
      joinedAt: i.date().indexed(),
      leftAt: i.date().optional().indexed(),
      removedAt: i.date().optional().indexed(),
      role: i.string().indexed(),
    }),
    teams: i.entity({
      name: i.string().indexed(),
    }),
    teamMemberships: i.entity({
      joinedAt: i.date().indexed(),
      leftAt: i.date().optional().indexed(),
      removedAt: i.date().optional().indexed(),
      role: i.string().indexed(),
    }),
  },
  /*
   * the "names" of links DO NOT matter (the top-level key, like "$[entityA]_[entityB]"; this is NOT registered or persisted with Instant DB)
   *
   * "on" MUST be the exact entity name (e.g. "$users", "userProfiles", etc.)
   *
   * "label" MUST be unique for the entity
   * - you CANNOT use a label that is the same as an attribute of the entity
   * - you CANNOT use the same label twice for the same entity
   * - because you CANNOT use the same label twice for the same entity, Instant DB does NOT have the concept of polymorphic links; i.e. "entityA" cannot link to "entityB" and "entityC" with the same label like "children"; you would two links, one would need to use a label like "childrenA" and the other "childrenB"
   * - you CAN use the same label for the link of different entities
   * - use a label name that makes sense when viewed from the perspective of the entity
   *
   * - "has" can be "one" or "many"; Instant DB supports one-to-one, one-to-many, many-to-many, and many-to-one
   *
   * - "required" can only be set on the forward side of a link
   *
   * - "onDelete" can be set on whichever side has "has: one" (forward or reverse)
   *
   * - "$files" and "$users" (special system-level entities) can only be used on the reverse side of links
   *
   * - all links are implicitly indexed by Instant DB to ensure query performance
   */
  links: {
    /* --- Profiles & Avatars --- */

    // each user has exactly one profile
    userProfile_user$: {
      forward: {
        on: "userProfiles",
        label: "$user",
        has: "one",
        required: true,
      },
      reverse: { on: "$users", label: "profile", has: "one" },
    },

    // each profile may have one avatar file
    userProfile_avatar$file: {
      forward: { on: "userProfiles", label: "avatar$file", has: "one" },
      reverse: { on: "$files", label: "avatarOfUserProfile", has: "one" },
    },

    /* --- Organizations, Teams, Memberships --- */

    // user organization memberships (reverse on $users)
    organizationMembership_user$: {
      forward: { on: "organizationMemberships", label: "$user", has: "one" },
      reverse: { on: "$users", label: "organizationMemberships", has: "many" },
    },

    organizations_organizationMemberships: {
      forward: {
        on: "organizations",
        label: "organizationMemberships",
        has: "many",
      },
      reverse: {
        on: "organizationMemberships",
        label: "organization",
        has: "one",
      },
    },

    organizations_teams: {
      forward: { on: "organizations", label: "teams", has: "many" },
      // deleting an organization cascades to its teams (allowed on 'has: "one"' side)
      reverse: {
        on: "teams",
        label: "organization",
        has: "one",
        onDelete: "cascade",
      },
    },

    organization_avatar$file: {
      forward: { on: "organizations", label: "avatar$file", has: "one" },
      reverse: { on: "$files", label: "organizationAvatar", has: "one" },
    },

    teamMembership_user$: {
      forward: { on: "teamMemberships", label: "$user", has: "one" },
      reverse: { on: "$users", label: "teamMemberships", has: "many" },
    },

    teams_teamMemberships: {
      forward: { on: "teams", label: "teamMemberships", has: "many" },
      reverse: { on: "teamMemberships", label: "team", has: "one" },
    },

    /* --- Conversations (Trajectories, Messages, Parts) --- */
  },
});

// this helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
