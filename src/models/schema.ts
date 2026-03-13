import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// --- Categories ---

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).unique().notNull(),
  nameTh: text("name_th").notNull(),
  nameEn: text("name_en").notNull(),
});

// --- Laws ---

export const laws = pgTable(
  "laws",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    titleTh: text("title_th").notNull(),
    titleEn: text("title_en"),
    categoryKey: varchar("category_key", { length: 50 })
      .references(() => categories.key)
      .notNull(),
    lawType: varchar("law_type", { length: 20 }).notNull(), // act, regulation, announcement, ruling
    year: integer("year").notNull(), // ปี พ.ศ.
    status: varchar("status", { length: 20 }).notNull().default("active"), // active, repealed, amended
    sourceUrl: text("source_url"),
    amendments: jsonb("amendments").$type<string[]>().default([]),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    categoryIdx: index("idx_laws_category").on(table.categoryKey),
    yearIdx: index("idx_laws_year").on(table.year),
    statusIdx: index("idx_laws_status").on(table.status),
  })
);

// --- Law Sections ---

export const lawSections = pgTable(
  "law_sections",
  {
    id: serial("id").primaryKey(),
    lawId: varchar("law_id", { length: 100 })
      .references(() => laws.id)
      .notNull(),
    sectionNumber: varchar("section_number", { length: 50 }).notNull(),
    title: text("title"),
    content: text("content").notNull(),
    contentEn: text("content_en"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    lawIdx: index("idx_sections_law").on(table.lawId),
  })
);

// --- Glossary ---

export const glossary = pgTable(
  "glossary",
  {
    id: serial("id").primaryKey(),
    termTh: text("term_th").notNull(),
    termEn: text("term_en").notNull(),
    categoryKey: varchar("category_key", { length: 50 }),
    definitionTh: text("definition_th").notNull(),
    definitionEn: text("definition_en"),
    legalReference: text("legal_reference"),
    usageContext: text("usage_context"),
    relatedTerms: jsonb("related_terms").$type<string[]>().default([]),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    categoryIdx: index("idx_glossary_category").on(table.categoryKey),
  })
);

// --- Templates ---

export const templates = pgTable(
  "templates",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    name: text("name").notNull(),
    type: varchar("type", { length: 50 }).notNull(), // employment, nda, service, etc.
    variant: varchar("variant", { length: 50 }).notNull().default("standard"),
    language: varchar("language", { length: 10 }).notNull().default("th"),
    version: varchar("version", { length: 20 }).notNull().default("1.0"),
    content: text("content").notNull(),
    variables: jsonb("variables")
      .$type<{ name: string; label: string; required: boolean }[]>()
      .default([]),
    mandatoryClauses: jsonb("mandatory_clauses").$type<string[]>().default([]),
    legalNotes: jsonb("legal_notes").$type<string[]>().default([]),
    stampDuty: text("stamp_duty"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    typeIdx: index("idx_templates_type").on(table.type),
    variantIdx: index("idx_templates_variant").on(table.variant),
  })
);

// --- API Keys ---

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  keyHash: varchar("key_hash", { length: 255 }).unique().notNull(),
  orgName: text("org_name").notNull(),
  permissions: jsonb("permissions")
    .$type<string[]>()
    .default(["read"]),
  rateLimitMax: integer("rate_limit_max").default(60),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// --- Audit Logs ---

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    apiKeyId: integer("api_key_id"),
    method: varchar("method", { length: 100 }).notNull(),
    paramsHash: varchar("params_hash", { length: 64 }),
    responseCode: integer("response_code"),
    responseTimeMs: integer("response_time_ms"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    createdIdx: index("idx_audit_created").on(table.createdAt),
  })
);
