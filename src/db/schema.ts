import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Image blobs. Never select `bytes` / `thumbBytes` outside the image route. */
export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  mime: text("mime").notNull(),
  bytes: bytea("bytes").notNull(),
  thumbBytes: bytea("thumb_bytes"),
  width: integer("width"),
  height: integer("height"),
  size: integer("size").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  profileImageId: uuid("profile_image_id").references(() => images.id, { onDelete: "set null" }),
  emailVerifiedAt: ts("email_verified_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // verify | reset
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId)],
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    bannerImageId: uuid("banner_image_id").references(() => images.id, { onDelete: "set null" }),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    status: text("status").notNull().default("draft"), // draft | published | closed | cancelled
    rules: text("rules").notNull().default(""),
    prizeInfo: text("prize_info").notNull().default(""),
    finalizedAt: ts("finalized_at"),
    resultsPublishedAt: ts("results_published_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("competitions_status_end_idx").on(t.status, t.endAt)],
);

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    registeredAt: ts("registered_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("registrations_user_competition_uq").on(t.userId, t.competitionId),
    index("registrations_competition_idx").on(t.competitionId),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(), // short public id used in /p/[id]
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    imageId: uuid("image_id")
      .notNull()
      .references(() => images.id),
    title: text("title"),
    description: text("description"),
    submittedAt: ts("submitted_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("submissions_user_competition_uq").on(t.userId, t.competitionId),
    index("submissions_competition_idx").on(t.competitionId, t.submittedAt),
    index("submissions_submitted_idx").on(t.submittedAt),
  ],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    voterId: text("voter_id").notNull(),
    ipHash: text("ip_hash").notNull(),
    eligible: boolean("eligible").notNull().default(true),
    suspicious: boolean("suspicious").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("votes_submission_voter_uq").on(t.submissionId, t.voterId),
    index("votes_submission_idx").on(t.submissionId),
    index("votes_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

/** Append-only voting audit trail (likes, unlikes, blocked attempts). */
export const voteEvents = pgTable(
  "vote_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: text("submission_id").notNull(),
    voterId: text("voter_id").notNull(),
    ipHash: text("ip_hash").notNull(),
    action: text("action").notNull(), // like | unlike | blocked | flagged
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("vote_events_submission_idx").on(t.submissionId, t.createdAt)],
);

export const sponsors = pgTable("sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  imageId: uuid("image_id")
    .notNull()
    .references(() => images.id),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const prizeConfiguration = pgTable("prize_configuration", {
  id: integer("id").primaryKey().default(1),
  firstPrize: integer("first_prize").notNull().default(5000),
  secondPrize: integer("second_prize").notNull().default(3000),
  thirdPrize: integer("third_prize").notNull().default(1000),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const winners = pgTable(
  "winners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    finalLikes: integer("final_likes").notNull(),
    prizeAmount: integer("prize_amount").notNull().default(0),
    publishedAt: ts("published_at"),
  },
  (t) => [uniqueIndex("winners_competition_rank_uq").on(t.competitionId, t.rank)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    meta: jsonb("meta"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

/** Design reference images, grouped by application section (admin-only tool). */
export const designReferences = pgTable(
  "design_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    section: text("section").notNull(),
    imageId: uuid("image_id")
      .notNull()
      .references(() => images.id),
    fileName: text("file_name").notNull(),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("design_references_section_idx").on(t.section, t.createdAt)],
);
