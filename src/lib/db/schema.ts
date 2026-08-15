import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─── NextAuth required tables ────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date()),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ─── User API Keys (BYOK — encrypted at rest) ───────────────────────────────

export const userApiKeys = sqliteTable(
  "user_api_keys",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'gemini' | 'fal'
    encryptedKey: text("encrypted_key").notNull(),
    keyPrefix: text("key_prefix").notNull(), // first 4 chars for display
    iv: text("iv").notNull(), // hex-encoded initialization vector
    authTag: text("auth_tag").notNull(), // hex-encoded GCM auth tag
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("uq_user_api_key_provider").on(t.userId, t.provider)]
);

// ─── Post Batches ────────────────────────────────────────────────────────────

export const postBatches = sqliteTable("post_batches", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(), // main topic/idea
  industry: text("industry"),
  targetAudience: text("target_audience"),
  tonePrefs: text("tone_prefs"),
  postType: text("post_type").notNull(), // 'text' | 'carousel' | 'article' | 'poll'
  postsCount: integer("posts_count").notNull(),
  // Status: pending | generating_briefs | generating_images | completed | failed
  status: text("status").notNull().default("pending"),
  designBriefs: text("design_briefs"), // JSON string
  // Reference images the client uploaded with the brief, as a JSON array of
  // public paths. Kept because the illustrated deck renders WITH them, not just
  // from them — a photo the client supplied beats anything a model invents.
  referenceImages: text("reference_images"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

// ─── Generated Posts ─────────────────────────────────────────────────────────

export const generatedPosts = sqliteTable("generated_posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  batchId: text("batch_id")
    .notNull()
    .references(() => postBatches.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  postType: text("post_type").notNull(),
  hookCategory: text("hook_category").notNull(), // e.g. "The Story Hook", "The Contrarian"
  hook: text("hook").notNull(), // first 2 lines
  body: text("body").notNull(), // full post content
  hashtags: text("hashtags").notNull(), // JSON array
  cta: text("cta").notNull(), // call to action
  whyThisWorks: text("why_this_works").notNull(),
  variations: text("variations").notNull(), // JSON array of 3 alternative full posts
  carouselSlides: text("carousel_slides"), // JSON array of slide objects (nullable, for carousel type)
  imageUrl: text("image_url"),
  carouselImages: text("carousel_images"), // JSON array of generated slide image URLs (carousel type)
  // Status: pending | generating | completed | failed
  status: text("status").notNull().default("pending"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  // Approval: draft | approved | scheduled | published
  approvalStatus: text("approval_status").notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date()),
});

// ─── Creator Profile (derived from the client's CV / resume) ─────────────────
// This is the BASE context for all generated content. A client uploads their
// resume once; Gemini analyzes it into a structured profile that personalizes
// every post, graphic, script, and article.

export const creatorProfiles = sqliteTable("creator_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // Extracted resume text (for re-analysis / reference).
  rawText: text("raw_text"),
  sourceFilename: text("source_filename"),
  // Optional one-pager (goals / what they want to work on / who they target).
  onePagerText: text("one_pager_text"),
  onePagerFilename: text("one_pager_filename"),
  // Human-readable top-level fields for quick display.
  fullName: text("full_name"),
  headline: text("headline"),
  industry: text("industry"),
  targetAudience: text("target_audience"),
  // Full structured analysis (JSON): summary, expertise, achievements, roles,
  // signatureStories, voiceTone, positioning, contentPillars, etc.
  profileJson: text("profile_json"),
  // Profile Kit (JSON): the banner brief, 3 ranked headline options and the
  // About section — the three assets a recruiter reads in their first 30
  // seconds. Kept beside the profile because it is derived from it.
  kitJson: text("kit_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});

/**
 * Post performance, entered by hand.
 *
 * LinkedIn's analytics API needs a partner-approved app, so there is no free
 * way to pull these automatically. Typing five numbers off the post's own stats
 * page takes seconds and is enough to learn which hooks, formats and posting
 * days actually work for this account — which is the whole point.
 */
export const postMetrics = sqliteTable("post_metrics", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Nullable so metrics can be logged for a post published outside the app.
  postId: text("post_id").references(() => generatedPosts.id, { onDelete: "set null" }),
  /** Free-text label when there is no linked post. */
  label: text("label"),
  postType: text("post_type"),
  hookCategory: text("hook_category"),
  impressions: integer("impressions"),
  reactions: integer("reactions"),
  comments: integer("comments"),
  reposts: integer("reposts"),
  saves: integer("saves"),
  profileViews: integer("profile_views"),
  /** When it went live — the basis for day-of-week and hour analysis. */
  postedAt: integer("posted_at", { mode: "timestamp_ms" }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(userApiKeys),
  postBatches: many(postBatches),
  generatedPosts: many(generatedPosts),
}));

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [userApiKeys.userId],
    references: [users.id],
  }),
}));

export const postBatchesRelations = relations(postBatches, ({ one, many }) => ({
  user: one(users, {
    fields: [postBatches.userId],
    references: [users.id],
  }),
  posts: many(generatedPosts),
}));

export const generatedPostsRelations = relations(
  generatedPosts,
  ({ one }) => ({
    batch: one(postBatches, {
      fields: [generatedPosts.batchId],
      references: [postBatches.id],
    }),
    user: one(users, {
      fields: [generatedPosts.userId],
      references: [users.id],
    }),
  })
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PostBatch = typeof postBatches.$inferSelect;
export type NewPostBatch = typeof postBatches.$inferInsert;
export type GeneratedPost = typeof generatedPosts.$inferSelect;
export type NewGeneratedPost = typeof generatedPosts.$inferInsert;
export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;
export type CreatorProfile = typeof creatorProfiles.$inferSelect;
export type NewCreatorProfile = typeof creatorProfiles.$inferInsert;
