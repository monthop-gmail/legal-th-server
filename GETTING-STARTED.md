# Getting Started — คู่มือเริ่มต้นสำหรับทีม

คู่มือนี้พาทีมจาก clone repo → รัน server → เติม logic → เติมข้อมูลกฎหมาย ทีละขั้นตอน

---

## 1. รัน Server

```bash
git clone https://github.com/monthop-gmail/legal-th-server.git
cd legal-th-server
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

รอจน log ขึ้นว่า server running แล้วทดสอบ:

```bash
curl http://localhost:3000/health
```

ได้ `{"status":"ok","version":"0.1.0"}` = สำเร็จ

**เครื่องมือที่ได้:**

| URL | ใช้ทำอะไร |
|-----|---------|
| http://localhost:3000 | MCP Server |
| http://localhost:8080 | Adminer (ดู DB) — server: `postgres`, user: `legal_th`, pass: `legal_th_pass` |

---

## 2. ทำความเข้าใจโครงสร้าง

```
src/
├── index.ts              ← เปิด server, register plugins
├── routes/
│   └── mcp.ts            ← รับ JSON-RPC request → เรียก service ที่ถูกต้อง
├── services/
│   ├── search-laws.ts    ← ★ เติม logic ค้นหากฎหมาย
│   ├── glossary.ts       ← ★ เติม logic ค้นศัพท์
│   └── templates.ts      ← ★ เติม logic ดึง template
├── models/
│   └── schema.ts         ← database schema (ตาราง, index)
├── middleware/
│   └── auth.ts           ← ตรวจ API key
└── utils/
    └── env.ts            ← อ่าน environment variables
```

**flow ของ request:**

```
Client → POST /mcp → mcp.ts (router) → service → database → response
```

ไฟล์ที่ทีมต้องแก้หลักๆ อยู่ใน `src/services/` เท่านั้น

---

## 3. Setup Database

### 3.1 สร้างตาราง

Schema อยู่ที่ `src/models/schema.ts` แล้ว ให้รัน migration:

```bash
# เข้าไปใน container
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec app sh

# ใน container: generate migration
npx drizzle-kit generate

# ใน container: run migration
npx drizzle-kit migrate
```

หรือจะใช้ Adminer (http://localhost:8080) รัน SQL เองก็ได้:

```sql
-- ตรวจว่าตารางถูกสร้างแล้ว
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

### 3.2 เพิ่ม Thai Full-Text Search

PostgreSQL รองรับ full-text search ภาษาไทยผ่าน `simple` configuration:

```sql
-- สร้าง text search index สำหรับ laws
CREATE INDEX idx_laws_search ON laws
USING GIN (to_tsvector('simple', title_th || ' ' || COALESCE(title_en, '')));

-- สร้าง text search index สำหรับ law_sections
CREATE INDEX idx_sections_search ON law_sections
USING GIN (to_tsvector('simple', content || ' ' || COALESCE(title, '')));

-- สร้าง text search index สำหรับ glossary
CREATE INDEX idx_glossary_search ON glossary
USING GIN (to_tsvector('simple', term_th || ' ' || term_en || ' ' || definition_th));
```

---

## 4. เติมข้อมูลกฎหมาย

### 4.1 เตรียมข้อมูลเป็น JSON

สร้างไฟล์ JSON ใน `data/` ตามโครงสร้างนี้:

**`data/laws/categories.json`**
```json
[
  { "key": "data_protection", "name_th": "คุ้มครองข้อมูลส่วนบุคคล", "name_en": "Data Protection" },
  { "key": "labor", "name_th": "แรงงาน", "name_en": "Labor" },
  { "key": "civil", "name_th": "แพ่งและพาณิชย์", "name_en": "Civil and Commercial" },
  { "key": "tax", "name_th": "ภาษี", "name_en": "Tax" },
  { "key": "ip", "name_th": "ทรัพย์สินทางปัญญา", "name_en": "Intellectual Property" },
  { "key": "consumer", "name_th": "คุ้มครองผู้บริโภค", "name_en": "Consumer Protection" },
  { "key": "ecommerce", "name_th": "ธุรกรรมอิเล็กทรอนิกส์", "name_en": "E-Commerce" },
  { "key": "criminal", "name_th": "อาญา", "name_en": "Criminal" },
  { "key": "constitutional", "name_th": "รัฐธรรมนูญ", "name_en": "Constitutional" },
  { "key": "corporate", "name_th": "บริษัท หลักทรัพย์", "name_en": "Corporate" },
  { "key": "environment", "name_th": "สิ่งแวดล้อม", "name_en": "Environment" },
  { "key": "healthcare", "name_th": "สาธารณสุข", "name_en": "Healthcare" }
]
```

**`data/laws/pdpa.json`** (ตัวอย่าง 1 ฉบับ)
```json
{
  "id": "pdpa-2562",
  "title_th": "พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562",
  "title_en": "Personal Data Protection Act B.E. 2562 (2019)",
  "category_key": "data_protection",
  "law_type": "act",
  "year": 2562,
  "status": "active",
  "source_url": "https://www.ratchakitcha.soc.go.th/DATA/PDF/2562/A/069/T_0052.PDF",
  "amendments": [],
  "sections": [
    {
      "section_number": "มาตรา 19",
      "title": "การถอนความยินยอม",
      "content": "เจ้าของข้อมูลส่วนบุคคลจะถอนความยินยอมเสียเมื่อใดก็ได้..."
    },
    {
      "section_number": "มาตรา 23",
      "title": "การแจ้งวัตถุประสงค์",
      "content": "การเก็บรวบรวมข้อมูลส่วนบุคคล ผู้ควบคุมข้อมูลส่วนบุคคลจะต้องแจ้งให้เจ้าของข้อมูลส่วนบุคคลทราบก่อนหรือในขณะเก็บรวบรวม..."
    },
    {
      "section_number": "มาตรา 24",
      "title": "ฐานทางกฎหมาย",
      "content": "ห้ามมิให้ผู้ควบคุมข้อมูลส่วนบุคคลทำการเก็บรวบรวมข้อมูลส่วนบุคคลโดยไม่ได้รับความยินยอม เว้นแต่..."
    },
    {
      "section_number": "มาตรา 26",
      "title": "ข้อมูลอ่อนไหว",
      "content": "ห้ามมิให้เก็บรวบรวมข้อมูลส่วนบุคคลเกี่ยวกับเชื้อชาติ เผ่าพันธุ์ ความคิดเห็นทางการเมือง..."
    },
    {
      "section_number": "มาตรา 28",
      "title": "การโอนข้อมูลไปต่างประเทศ",
      "content": "ในกรณีที่ผู้ควบคุมข้อมูลส่วนบุคคลส่งหรือโอนข้อมูลส่วนบุคคลไปยังต่างประเทศ..."
    },
    {
      "section_number": "มาตรา 37(4)",
      "title": "แจ้งเหตุละเมิดข้อมูล",
      "content": "แจ้งเหตุการละเมิดข้อมูลส่วนบุคคลแก่สำนักงานโดยไม่ชักช้าภายในเจ็ดสิบสองชั่วโมง..."
    }
  ]
}
```

**`data/glossary/glossary.json`** (ตัวอย่าง)
```json
[
  {
    "term_th": "นิติกรรม",
    "term_en": "Juristic Act",
    "category_key": "civil",
    "definition_th": "การกระทำใดๆ อันทำลงโดยชอบด้วยกฎหมายและด้วยใจสมัคร มุ่งโดยตรงต่อการผูกนิติสัมพันธ์ขึ้นระหว่างบุคคล เพื่อจะก่อ เปลี่ยนแปลง โอน สงวน หรือระงับซึ่งสิทธิ",
    "definition_en": "Any lawful act done voluntarily, directly aimed at establishing a juristic relationship between persons in order to create, change, transfer, preserve, or extinguish a right",
    "legal_reference": "ป.พ.พ. มาตรา 149",
    "usage_context": "ใช้ในบริบทของการทำสัญญา การแสดงเจตนา และนิติสัมพันธ์ทั่วไป",
    "related_terms": ["สัญญา", "เจตนา", "ความสามารถ", "โมฆะ", "โมฆียะ"]
  },
  {
    "term_th": "เหตุสุดวิสัย",
    "term_en": "Force Majeure",
    "category_key": "civil",
    "definition_th": "เหตุใดๆ อันจะเกิดขึ้นก็ดี จะให้ผลพิบัติก็ดี เป็นเหตุที่ไม่อาจป้องกันได้ แม้ทั้งบุคคลผู้ต้องประสบหรือใกล้จะต้องประสบเหตุนั้น จะได้จัดการระมัดระวังตามสมควรอันพึงคาดหมายได้จากบุคคลในฐานะและภาวะเช่นนั้น",
    "definition_en": "An event which occurs or produces harmful consequences that cannot be prevented even if the person who encounters or is about to encounter such event exercises such care as may be expected from a person in that position and condition",
    "legal_reference": "ป.พ.พ. มาตรา 8",
    "usage_context": "ใช้ในสัญญาเพื่อยกเว้นความรับผิดเมื่อเกิดเหตุการณ์ที่ไม่สามารถควบคุมได้",
    "related_terms": ["ความรับผิด", "สัญญา", "ค่าเสียหาย"]
  },
  {
    "term_th": "ผู้ควบคุมข้อมูลส่วนบุคคล",
    "term_en": "Data Controller",
    "category_key": "data_protection",
    "definition_th": "บุคคลหรือนิติบุคคลซึ่งมีอำนาจหน้าที่ตัดสินใจเกี่ยวกับการเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคล",
    "definition_en": "A person or juristic person having the power and duties to make decisions regarding the collection, use, or disclosure of personal data",
    "legal_reference": "PDPA มาตรา 6",
    "usage_context": "ใช้ในบริบท PDPA เพื่อระบุผู้รับผิดชอบหลักในการประมวลผลข้อมูลส่วนบุคคล",
    "related_terms": ["ผู้ประมวลผลข้อมูลส่วนบุคคล", "เจ้าของข้อมูลส่วนบุคคล", "DPO"]
  }
]
```

**`data/templates/employment-standard.json`** (ตัวอย่าง)
```json
{
  "id": "tpl-employment-001",
  "name": "สัญญาจ้างแรงงาน (มาตรฐาน)",
  "type": "employment",
  "variant": "standard",
  "language": "th",
  "version": "1.0",
  "content": "สัญญาจ้างแรงงาน\n\nทำที่ {{place}}\nวันที่ {{date}}\n\nระหว่าง {{employer_name}} ซึ่งต่อไปนี้เรียกว่า \"นายจ้าง\" ฝ่ายหนึ่ง\nกับ {{employee_name}} ซึ่งต่อไปนี้เรียกว่า \"ลูกจ้าง\" อีกฝ่ายหนึ่ง\n\nทั้งสองฝ่ายตกลงทำสัญญาจ้างแรงงานกัน ดังมีข้อความต่อไปนี้\n\nข้อ 1. ตำแหน่งและหน้าที่\nนายจ้างตกลงจ้าง และลูกจ้างตกลงทำงานในตำแหน่ง {{position}} โดยมีหน้าที่ตามที่นายจ้างกำหนด\n\nข้อ 2. ค่าจ้าง\nนายจ้างตกลงจ่ายค่าจ้างเดือนละ {{salary}} บาท โดยจ่ายทุกวันสิ้นเดือน\n\nข้อ 3. วันเริ่มงาน\nลูกจ้างจะเริ่มทำงานตั้งแต่วันที่ {{start_date}} เป็นต้นไป\n\nข้อ 4. ชั่วโมงทำงาน\nเวลาทำงานปกติวันละไม่เกิน 8 ชั่วโมง สัปดาห์ละไม่เกิน 48 ชั่วโมง\n\nข้อ 5. การทดลองงาน\nลูกจ้างมีระยะทดลองงาน {{probation_days}} วัน นับจากวันเริ่มงาน\n\nข้อ 6. การเลิกสัญญา\nฝ่ายใดฝ่ายหนึ่งอาจบอกเลิกสัญญาได้โดยแจ้งเป็นหนังสือล่วงหน้าไม่น้อยกว่า 1 งวดการจ่ายค่าจ้าง โดยนายจ้างต้องจ่ายค่าชดเชยตามที่กฎหมายกำหนด\n\nข้อ 7. กฎหมายที่ใช้บังคับ\nสัญญานี้อยู่ภายใต้กฎหมายไทย\n\nลงชื่อ _________________ นายจ้าง\n       ({{employer_name}})\n\nลงชื่อ _________________ ลูกจ้าง\n       ({{employee_name}})",
  "variables": [
    { "name": "employer_name", "label": "ชื่อนายจ้าง", "required": true },
    { "name": "employee_name", "label": "ชื่อลูกจ้าง", "required": true },
    { "name": "position", "label": "ตำแหน่ง", "required": true },
    { "name": "salary", "label": "เงินเดือน (บาท)", "required": true },
    { "name": "start_date", "label": "วันเริ่มงาน", "required": true },
    { "name": "place", "label": "สถานที่ทำสัญญา", "required": false },
    { "name": "date", "label": "วันที่ทำสัญญา", "required": false },
    { "name": "probation_days", "label": "จำนวนวันทดลองงาน", "required": false }
  ],
  "mandatory_clauses": [
    "ตำแหน่งและหน้าที่",
    "ค่าจ้าง",
    "ชั่วโมงทำงาน (ไม่เกิน 8 ชม./วัน)",
    "เงื่อนไขการเลิกสัญญา"
  ],
  "legal_notes": [
    "ต้องสอดคล้องกับ พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541",
    "ค่าจ้างต้องไม่ต่ำกว่าอัตราค่าจ้างขั้นต่ำ",
    "ทดลองงานเกิน 120 วัน → ต้องจ่ายค่าชดเชยเมื่อเลิกจ้าง",
    "หากมีข้อมูลส่วนบุคคลพนักงาน ต้องจัดทำ Privacy Notice ตาม PDPA"
  ],
  "stamp_duty": "ไม่ต้องติดอากรแสตมป์"
}
```

### 4.2 เขียน Seed Script

แก้ไข `scripts/seed.ts` ให้อ่าน JSON แล้วเขียนลง DB:

```typescript
// scripts/seed.ts
import { readFileSync } from "fs";
import { db } from "../src/utils/db.js";  // ต้องสร้างไฟล์นี้
import { categories, laws, lawSections, glossary, templates } from "../src/models/schema.js";

async function seed() {
  console.log("Seeding categories...");
  const cats = JSON.parse(readFileSync("data/laws/categories.json", "utf-8"));
  await db.insert(categories).values(cats);

  console.log("Seeding laws...");
  // อ่านทุกไฟล์ใน data/laws/ ที่ไม่ใช่ categories.json
  // แยก sections ออกมา insert ทีละตาราง

  console.log("Seeding glossary...");
  const terms = JSON.parse(readFileSync("data/glossary/glossary.json", "utf-8"));
  await db.insert(glossary).values(terms);

  console.log("Seeding templates...");
  // อ่านทุกไฟล์ใน data/templates/

  console.log("Done!");
}

seed().catch(console.error);
```

### 4.3 รัน Seed

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec app npm run db:seed
```

แล้วเปิด Adminer (http://localhost:8080) ตรวจว่าข้อมูลเข้า DB แล้ว

---

## 5. เติม Service Logic

### 5.1 สร้าง DB Connection

สร้างไฟล์ `src/utils/db.ts`:

```typescript
// src/utils/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env.js";
import * as schema from "../models/schema.js";

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });
```

### 5.2 เติม search-laws

แก้ `src/services/search-laws.ts`:

```typescript
import { z } from "zod";
import { db } from "../utils/db.js";
import { laws, lawSections } from "../models/schema.js";
import { sql, ilike, eq, and, gte, lte } from "drizzle-orm";

const searchLawsInput = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  filters: z.object({
    year_from: z.number().optional(),
    year_to: z.number().optional(),
    law_type: z.enum(["act", "regulation", "announcement", "ruling"]).optional(),
    status: z.enum(["active", "repealed", "amended"]).optional(),
  }).optional(),
  limit: z.number().min(1).max(50).default(10),
  offset: z.number().min(0).default(0),
});

export async function searchLaws(params: Record<string, unknown>) {
  const input = searchLawsInput.parse(params);
  const start = Date.now();

  // สร้าง where conditions
  const conditions = [];

  // Full-text search (simple config สำหรับภาษาไทย)
  conditions.push(
    sql`to_tsvector('simple', ${laws.titleTh} || ' ' || COALESCE(${laws.titleEn}, ''))
        @@ plainto_tsquery('simple', ${input.query})`
  );

  if (input.category) {
    conditions.push(eq(laws.categoryKey, input.category));
  }
  if (input.filters?.year_from) {
    conditions.push(gte(laws.year, input.filters.year_from));
  }
  if (input.filters?.year_to) {
    conditions.push(lte(laws.year, input.filters.year_to));
  }
  if (input.filters?.law_type) {
    conditions.push(eq(laws.lawType, input.filters.law_type));
  }
  if (input.filters?.status) {
    conditions.push(eq(laws.status, input.filters.status));
  }

  // Query
  const results = await db
    .select()
    .from(laws)
    .where(and(...conditions))
    .limit(input.limit)
    .offset(input.offset);

  // ดึง sections ที่เกี่ยวข้อง
  const lawsWithSections = await Promise.all(
    results.map(async (law) => {
      const sections = await db
        .select()
        .from(lawSections)
        .where(eq(lawSections.lawId, law.id));

      return {
        ...law,
        relevant_sections: sections.map((s) => ({
          section: s.sectionNumber,
          title: s.title,
          content: s.content,
        })),
      };
    })
  );

  return {
    laws: lawsWithSections,
    total: lawsWithSections.length,
    query_time_ms: Date.now() - start,
  };
}
```

### 5.3 เติม glossary

แก้ `src/services/glossary.ts`:

```typescript
import { z } from "zod";
import { db } from "../utils/db.js";
import { glossary } from "../models/schema.js";
import { or, ilike } from "drizzle-orm";

const glossaryInput = z.object({
  term: z.string().min(1),
  category: z.string().optional(),
  language: z.enum(["th", "en", "both"]).default("both"),
});

export async function glossaryLookup(params: Record<string, unknown>) {
  const input = glossaryInput.parse(params);

  const results = await db
    .select()
    .from(glossary)
    .where(
      or(
        ilike(glossary.termTh, `%${input.term}%`),
        ilike(glossary.termEn, `%${input.term}%`),
        ilike(glossary.definitionTh, `%${input.term}%`)
      )
    )
    .limit(20);

  return {
    entries: results.map((r) => ({
      id: r.id,
      term_th: r.termTh,
      term_en: r.termEn,
      category: r.categoryKey,
      definition_th: r.definitionTh,
      definition_en: r.definitionEn,
      legal_reference: r.legalReference,
      usage_context: r.usageContext,
      related_terms: r.relatedTerms,
    })),
    total: results.length,
  };
}
```

### 5.4 เติม templates

แก้ `src/services/templates.ts`:

```typescript
import { z } from "zod";
import { db } from "../utils/db.js";
import { templates } from "../models/schema.js";
import { eq, and } from "drizzle-orm";

const getTemplateInput = z.object({
  template_id: z.string().optional(),
  template_type: z.enum([
    "employment", "nda", "service", "lease",
    "sale", "loan", "partnership", "license",
  ]).optional(),
  variant: z.enum(["standard", "simplified", "bilingual"]).default("standard"),
  language: z.enum(["th", "en", "bilingual"]).default("th"),
});

export async function getTemplate(params: Record<string, unknown>) {
  const input = getTemplateInput.parse(params);

  if (!input.template_id && !input.template_type) {
    throw new Error("Either template_id or template_type is required");
  }

  const result = input.template_id
    ? await db.select().from(templates).where(eq(templates.id, input.template_id)).limit(1)
    : await db.select().from(templates).where(
        and(
          eq(templates.type, input.template_type!),
          eq(templates.variant, input.variant)
        )
      ).limit(1);

  return {
    template: result[0] ?? null,
  };
}
```

---

## 6. ทดสอบ

เมื่อเติม logic + data แล้ว ทดสอบด้วย curl:

```bash
# ค้นหา PDPA
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "legal_th/search_laws",
    "params": { "query": "PDPA" }
  }' | jq .

# ค้นศัพท์
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "legal_th/glossary_lookup",
    "params": { "term": "นิติกรรม" }
  }' | jq .

# ดึง template
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3",
    "method": "legal_th/get_template",
    "params": { "template_type": "employment" }
  }' | jq .
```

---

## 7. Checklist ทีม

### สัปดาห์ 1
- [ ] `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` รันได้
- [ ] สร้าง `src/utils/db.ts`
- [ ] รัน migration สร้างตาราง
- [ ] เตรียม JSON data: categories + 5 กฎหมายแรก + 20 ศัพท์ + 2 templates
- [ ] เขียน seed script จริง
- [ ] รัน seed ข้อมูลเข้า DB

### สัปดาห์ 2
- [ ] เติม logic `search-laws` (full-text search)
- [ ] เติม logic `glossary` (ilike search)
- [ ] เติม logic `templates` (query by type)
- [ ] ทดสอบ 3 endpoints ด้วย curl
- [ ] เพิ่มข้อมูล: 20 กฎหมาย + 100 ศัพท์ + 5 templates

### สัปดาห์ 3
- [ ] เพิ่มข้อมูล: 50 กฎหมาย + 200 ศัพท์ + 10 templates
- [ ] ทดสอบเชื่อมต่อจาก client plugin (Claude Code / OpenCode)
- [ ] เขียน unit tests
- [ ] ปรับ auth middleware ให้ใช้งานจริง

### สัปดาห์ 4
- [ ] Deploy ขึ้น cloud (Railway / Render)
- [ ] อัปเดต `.mcp.json` ใน client plugin ให้ชี้ไป production URL
- [ ] ทดสอบ end-to-end

---

## 8. แหล่งข้อมูลกฎหมาย

| แหล่ง | URL | ข้อมูล |
|-------|-----|--------|
| ราชกิจจานุเบกษา | https://ratchakitcha.soc.go.th | กฎหมายทุกฉบับ |
| สำนักงานคณะกรรมการกฤษฎีกา | https://www.krisdika.go.th | กฎหมายจัดหมวดหมู่ |
| สคส. (PDPC) | https://www.pdpc.or.th | ประกาศ ระเบียบ PDPA |
| ศาลฎีกา | https://deka.supremecourt.or.th | คำพิพากษา |
| กระทรวงแรงงาน | https://www.mol.go.th | กฎหมายแรงงาน |
| กรมสรรพากร | https://www.rd.go.th | ประมวลรัษฎากร ภาษี |
| กรมทรัพย์สินทางปัญญา | https://www.ipthailand.go.th | IP law |

---

## ถามอะไรก็ถามได้

- **ปัญหา Docker** → ดู logs: `docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f`
- **ปัญหา DB** → เปิด Adminer: http://localhost:8080
- **ปัญหา API** → ดู server log: `docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f app`
- **Spec เต็ม** → อ่าน `legal-th-server-spec.md`
