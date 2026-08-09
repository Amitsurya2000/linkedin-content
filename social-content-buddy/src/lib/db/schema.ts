import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  jsonb,
  primaryKey,
  unique,
  index,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ─── NextAuth required tables ────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
  // Custom fields
  isAdmin: boolean("is_admin").default(false).notNull(),
  creditsUsed: integer("credits_used").default(0).notNull(),
  creditsLimit: integer("credits_limit").default(365).notNull(),
  invitedByCode: uuid("invited_by_code"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
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
    index("idx_accounts_user").on(account.userId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("sessionToken").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [
    index("idx_sessions_user").on(t.userId),
  ]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ─── Workspaces ──────────────────────────────────────────────────────────────

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // display name, e.g. "Acme Coffee"
    // Business profile
    businessName: text("business_name").notNull(),
    websiteUrl: text("website_url"),
    targetAudience: text("target_audience"),
    tonePrefs: text("tone_prefs"),
    // Brand kit
    logoUrl: text("logo_url"),
    brandColors: jsonb("brand_colors"), // e.g. ["#7C3AED", "#F59E0B", "#FFFFFF"]
    brandFonts: jsonb("brand_fonts"), // e.g. { heading: "Plus Jakarta Sans", body: "Inter" }
    brandGuidelines: text("brand_guidelines"), // free-text instructions for AI
    timezone: text("timezone"), // e.g. "America/New_York"
    // Meta
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_workspaces_user").on(t.userId),
  ]
);

// ─── Custom tables ────────────────────────────────────────────────────────────

export const invitationCodes = pgTable(
  "invitation_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 20 }).unique().notNull(),
    createdBy: text("created_by").references(() => users.id),
    maxUses: integer("max_uses").default(1).notNull(),
    currentUses: integer("current_uses").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_invitation_codes_created_by").on(t.createdBy),
  ]
);

export const invitationCodeRedemptions = pgTable(
  "invitation_code_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => invitationCodes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_code_redemptions_code").on(t.codeId),
    index("idx_code_redemptions_user").on(t.userId),
  ]
);

export const postBatches = pgTable(
  "post_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    businessName: text("business_name").notNull(),
    websiteUrl: text("website_url"),
    targetAudience: text("target_audience"),
    tonePrefs: text("tone_prefs"),
    postsCount: integer("posts_count").notNull(),
    // Status: pending | generating_briefs | generating_images | completed | failed
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    designBriefs: jsonb("design_briefs"), // raw Gemini response stored for reference
    errorMessage: text("error_message"),
    logoUrl: text("logo_url"),
    productImageUrl: text("product_image_url"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (t) => [
    index("idx_post_batches_user").on(t.userId),
    index("idx_post_batches_workspace").on(t.workspaceId),
    index("idx_post_batches_created").on(t.createdAt),
  ]
);

export const generatedPosts = pgTable(
  "generated_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => postBatches.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hookCategory: text("hook_category"),
    captionHook: text("caption_hook"),
    captionBody: text("caption_body"), // full caption body (2-4 sentences)
    hashtags: jsonb("hashtags"), // e.g. ["#coffee", "#latte", "#coffeeshop"]
    designBrief: text("design_brief"),
    whyThisWorks: text("why_this_works"),
    captionVariations: jsonb("caption_variations"), // array of alternative full captions
    imageUrl: text("image_url"),   // Cloudflare R2 public URL
    falRequestId: text("fal_request_id"),
    // Status: pending | generating | completed | failed
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    // Phase 2 fields (Instagram scheduler — kept null for now)
    scheduledAt: timestamp("scheduled_at", { mode: "date" }),
    approvalStatus: varchar("approval_status", { length: 20 }).default("draft"),
    instagramPostId: text("instagram_post_id"),
    publishedAt: timestamp("published_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_generated_posts_batch").on(t.batchId),
    index("idx_generated_posts_user").on(t.userId),
    index("idx_generated_posts_status").on(t.status),
  ]
);

// Phase 2: Instagram connections (table ready, not used in Phase 1)
export const instagramConnections = pgTable(
  "instagram_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    igUserId: text("ig_user_id").notNull(),
    igUsername: text("ig_username"),
    tokenExpires: timestamp("token_expires", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    unique("uq_instagram_connection").on(t.userId, t.igUserId),
    index("idx_instagram_connections_user").on(t.userId),
  ]
);

// User API keys (BYOK — encrypted at rest)
export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // "gemini" | "fal" | "getlate"
    encryptedKey: text("encrypted_key").notNull(),
    keyPrefix: varchar("key_prefix", { length: 10 }).notNull(), // first 4 chars for display
    iv: text("iv").notNull(), // hex-encoded initialization vector
    authTag: text("auth_tag").notNull(), // hex-encoded GCM auth tag
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    unique("uq_user_api_key_provider").on(t.userId, t.provider),
    index("idx_user_api_keys_user").on(t.userId),
  ]
);

// Social accounts connected via GetLate
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    platform: varchar("platform", { length: 30 }).notNull(), // "instagram"
    accountId: text("account_id").notNull(), // GetLate's account ID
    username: text("username"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_social_accounts_user").on(t.userId),
    index("idx_social_accounts_workspace").on(t.workspaceId),
  ]
);

// ─── Workspace members (team collaboration) ─────────────────────────────────

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("editor"), // owner | editor | viewer
    invitedByUserId: text("invited_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    unique("uq_workspace_member").on(t.workspaceId, t.userId),
    index("idx_workspace_members_workspace").on(t.workspaceId),
    index("idx_workspace_members_user").on(t.userId),
    index("idx_workspace_members_invited_by").on(t.invitedByUserId),
  ]
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: varchar("role", { length: 20 }).notNull().default("editor"),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | accepted | expired
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  },
  (t) => [
    index("idx_workspace_invites_workspace").on(t.workspaceId),
    index("idx_workspace_invites_email").on(t.email),
    index("idx_workspace_invites_status").on(t.status),
    index("idx_workspace_invites_invited_by").on(t.invitedByUserId),
  ]
);

// ─── Media Library ────────────────────────────────────────────────────────────

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    contentType: varchar("content_type", { length: 50 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_media_assets_workspace").on(t.workspaceId),
    index("idx_media_assets_user").on(t.userId),
  ]
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type InvitationCode = typeof invitationCodes.$inferSelect;
export type PostBatch = typeof postBatches.$inferSelect;
export type GeneratedPost = typeof generatedPosts.$inferSelect;
export type UserApiKey = typeof userApiKeys.$inferSelect;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type InvitationCodeRedemption = typeof invitationCodeRedemptions.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
