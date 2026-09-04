import {
  pgTable,
  text,
  integer,
  timestamp,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── NextAuth required tables ────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = pgTable(
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

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ─── User API Keys (BYOK — encrypted at rest) ───────────────────────────────

export const userApiKeys = pgTable(
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("uq_user_api_key_provider").on(t.userId, t.provider)]
);

// ─── Post Batches ────────────────────────────────────────────────────────────

export const postBatches = pgTable("post_batches", {
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ─── Generated Posts ─────────────────────────────────────────────────────────

export const generatedPosts = pgTable("generated_posts", {
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
  // The visual brief the content agent returned: web_image_agent + gethos_prompt,
  // as JSON. Written at generation time and read when the image is rendered, so
  // the picture follows the brief the copy was written with rather than a preset.
  visualDirective: text("visual_directive"),
  // Status: pending | generating | completed | failed
  status: text("status").notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  // Approval: draft | approved | scheduled | published
  approvalStatus: text("approval_status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Generated Images (stored in the DB — serverless filesystems are read-only) ─
// Vercel deployments cannot write to disk, so every rendered image (carousel
// slide, post visual, deck frame) is persisted here as base64 text and served
// back through the /api/post-images/[id] proxy route. URLs stored on posts are
// of the form `/api/post-images/{imageId}`.

export const generatedImages = pgTable("generated_images", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // The post the image belongs to (nullable so a batch upload reference can be
  // detached from any single post).
  postId: text("post_id").references(() => generatedPosts.id, {
    onDelete: "cascade",
  }),
  // Base64-encoded bytes. PNG for rendered frames; the original encoding for
  // client-uploaded reference images.
  data: text("data").notNull(),
  mimeType: text("mime_type").notNull().default("image/png"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Creator Profile (derived from the client's CV / resume) ─────────────────
// This is the BASE context for all generated content. A client uploads their
// resume once; Gemini analyzes it into a structured profile that personalizes
// every post, graphic, script, and article.

export const creatorProfiles = pgTable("creator_profiles", {
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Post performance, entered by hand.
 *
 * LinkedIn's analytics API needs a partner-approved app, so there is no free
 * way to pull these automatically. Typing five numbers off the post's own stats
 * page takes seconds and is enough to learn which hooks, formats and posting
 * days actually work for this account — which is the whole point.
 */
export const postMetrics = pgTable("post_metrics", {
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
  postedAt: timestamp("posted_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
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
  ({ one, many }) => ({
    batch: one(postBatches, {
      fields: [generatedPosts.batchId],
      references: [postBatches.id],
    }),
    user: one(users, {
      fields: [generatedPosts.userId],
      references: [users.id],
    }),
    images: many(generatedImages),
  })
);

export const generatedImagesRelations = relations(generatedImages, ({ one }) => ({
  post: one(generatedPosts, {
    fields: [generatedImages.postId],
    references: [generatedPosts.id],
  }),
  user: one(users, {
    fields: [generatedImages.userId],
    references: [users.id],
  }),
}));

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
export type GeneratedImage = typeof generatedImages.$inferSelect;
export type NewGeneratedImage = typeof generatedImages.$inferInsert;
