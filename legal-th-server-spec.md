# Legal-TH MCP Server Specification

**สำหรับทีมพัฒนา Backend**

---

## 1. ภาพรวม

Legal-TH MCP Server เป็น backend service ที่ให้บริการข้อมูลกฎหมายไทยผ่าน **MCP HTTP Transport Protocol** (JSON-RPC 2.0 over HTTP) รองรับ client plugin จากทุก AI coding agent (Claude Code, OpenCode, Copilot ฯลฯ)

```
┌──────────────────────────────────────┐
│  AI Coding Agent Clients             │
│  Claude Code | OpenCode | อื่นๆ      │
│  (plugin ฝั่ง client — repo แยก)      │
└──────────────┬───────────────────────┘
               │ MCP HTTP (JSON-RPC 2.0)
               │ HTTPS + API Key Auth
               ▼
┌──────────────────────────────────────┐
│  Legal-TH MCP Server  ◄── repo นี้   │
│  ├─ Endpoint Router                  │
│  ├─ Auth & Rate Limiting             │
│  ├─ Service Layer                    │
│  └─ Data Layer                       │
└──────────────────────────────────────┘
```

**หน้าที่ของ server:**
- เป็น single source of truth สำหรับข้อมูลกฎหมายไทย
- ให้บริการค้นหา ดึง template ตรวจ compliance ผ่าน MCP endpoints
- อัปเดตกฎหมายจุดเดียว ทุก client ได้รับพร้อมกัน
- บันทึก audit trail ทุก request

**หน้าที่ที่ไม่ใช่ของ server:**
- ไม่ต้องดูแล plugin ฝั่ง client (คนละ repo)
- ไม่ต้องจัดการ UI/UX (client จัดการเอง)

---

## 2. MCP Protocol

### 2.1 Transport

| รายการ | ค่า |
|--------|-----|
| Protocol | HTTP/HTTPS |
| Format | JSON-RPC 2.0 |
| Method | POST (ทุก endpoint) |
| Content-Type | application/json |
| Encryption | TLS 1.3+ |
| Base URL | `https://api.legal-th.example.com/mcp` |

### 2.2 Request Format

```json
{
  "jsonrpc": "2.0",
  "id": "req-abc123",
  "method": "legal_th/search_laws",
  "params": {
    "query": "PDPA การส่งข้อมูลข้ามประเทศ",
    "category": "data_protection",
    "limit": 10
  }
}
```

### 2.3 Response Format

**สำเร็จ:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-abc123",
  "result": {
    "laws": [...],
    "total": 5,
    "query_time_ms": 45
  }
}
```

**ผิดพลาด:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-abc123",
  "error": {
    "code": -32001,
    "message": "Authorization failed",
    "data": { "details": "Invalid API key" }
  }
}
```

### 2.4 Error Codes

| Code | ความหมาย |
|------|---------|
| -32700 | Parse error (JSON ไม่ถูกต้อง) |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32001 | Authorization failed |
| -32002 | Rate limit exceeded |
| -32003 | Resource not found |

---

## 3. Authentication & Security

### 3.1 API Key

```
Header: Authorization: Bearer sk-legal-xxxxx
```

- API key ออกให้ต่อองค์กร/ผู้ใช้
- รองรับ key rotation
- สิทธิ์แบบ granular (read / write / admin)

### 3.2 Request Signing (Phase 2)

```
HMAC-SHA256:
signature = HMAC-SHA256(
  key = api_secret,
  message = method + JSON(params) + timestamp
)
```

### 3.3 Rate Limiting

| Plan | Requests/min | Requests/day |
|------|-------------|-------------|
| Free | 10 | 500 |
| Pro | 60 | 10,000 |
| Enterprise | 300 | unlimited |

### 3.4 Security Checklist

- [ ] HTTPS only (ปิด HTTP)
- [ ] CORS whitelist
- [ ] API key hashed ใน database (ไม่เก็บ plaintext)
- [ ] Rate limiting ต่อ API key
- [ ] Request logging (audit trail)
- [ ] Input validation ทุก endpoint
- [ ] SQL injection protection (parameterized queries)
- [ ] PDPA compliance สำหรับ user data

---

## 4. MCP Endpoints

### 4.1 สรุป Endpoints ทั้งหมด

| Method | คำอธิบาย | Phase | ความซับซ้อน |
|--------|---------|-------|------------|
| `legal_th/search_laws` | ค้นหากฎหมายไทย | 1 | ปานกลาง |
| `legal_th/glossary_lookup` | ค้นหาศัพท์กฎหมาย | 1 | ง่าย |
| `legal_th/get_template` | ดึง template สัญญา | 1 | ง่าย |
| `legal_th/check_compliance` | ตรวจ compliance | 2 | ยาก |
| `legal_th/generate_contract` | สร้างสัญญาจาก template | 2 | ปานกลาง |
| `legal_th/generate_checklist` | สร้าง compliance checklist | 2 | ปานกลาง |
| `legal_th/regulatory_updates` | ข่าวกฎหมายล่าสุด | 3 | ปานกลาง |

---

### 4.2 รายละเอียดแต่ละ Endpoint

#### `legal_th/search_laws`

ค้นหากฎหมาย ระเบียบ ประกาศ คำพิพากษา

**Input:**
```json
{
  "query": "string — คำค้นหา (ไทยหรืออังกฤษ)",
  "category": "string? — หมวดหมู่ (ดูตาราง categories)",
  "filters": {
    "year_from": "number? — ปี พ.ศ. เริ่มต้น",
    "year_to": "number? — ปี พ.ศ. สิ้นสุด",
    "law_type": "string? — act | regulation | announcement | ruling",
    "status": "string? — active | repealed | amended"
  },
  "limit": "number? — จำนวนผลลัพธ์ (default: 10, max: 50)",
  "offset": "number? — pagination offset"
}
```

**Output:**
```json
{
  "laws": [
    {
      "id": "pdpa-2562",
      "title_th": "พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562",
      "title_en": "Personal Data Protection Act B.E. 2562",
      "category": "data_protection",
      "law_type": "act",
      "year": 2562,
      "status": "active",
      "relevant_sections": [
        {
          "section": "มาตรา 28",
          "title": "การโอนข้อมูลไปต่างประเทศ",
          "content": "...",
          "excerpt": "..."
        }
      ],
      "amendments": ["ฉบับที่ 2 พ.ศ. ..."],
      "source_url": "https://ratchakitcha.soc.go.th/..."
    }
  ],
  "total": 5,
  "query_time_ms": 45
}
```

**Categories:**

| Key | คำอธิบาย |
|-----|---------|
| `constitutional` | รัฐธรรมนูญ กฎหมายปกครอง |
| `civil` | แพ่งและพาณิชย์ |
| `criminal` | อาญา |
| `labor` | แรงงาน |
| `data_protection` | PDPA คุ้มครองข้อมูล |
| `ip` | ทรัพย์สินทางปัญญา |
| `tax` | ภาษี อากร |
| `consumer` | คุ้มครองผู้บริโภค |
| `ecommerce` | ธุรกรรมอิเล็กทรอนิกส์ |
| `corporate` | บริษัท หลักทรัพย์ |
| `environment` | สิ่งแวดล้อม |
| `healthcare` | สาธารณสุข |

---

#### `legal_th/glossary_lookup`

ค้นหาศัพท์กฎหมายไทย-อังกฤษ

**Input:**
```json
{
  "term": "string — คำที่ค้นหา (ไทยหรืออังกฤษ)",
  "category": "string? — สาขากฎหมาย",
  "language": "string? — th | en | both (default: both)"
}
```

**Output:**
```json
{
  "entries": [
    {
      "id": "gl-001",
      "term_th": "นิติกรรม",
      "term_en": "Juristic Act",
      "category": "civil",
      "definition_th": "การกระทำใดๆ อันทำลงโดยชอบด้วยกฎหมายและด้วยใจสมัคร...",
      "definition_en": "Any lawful act done voluntarily...",
      "legal_reference": "ป.พ.พ. มาตรา 149",
      "usage_context": "ใช้ในบริบทของการทำสัญญา...",
      "related_terms": ["สัญญา", "เจตนา", "ความสามารถ"]
    }
  ],
  "total": 1
}
```

---

#### `legal_th/get_template`

ดึง template สัญญา/เอกสารกฎหมาย

**Input:**
```json
{
  "template_id": "string? — ID ของ template",
  "template_type": "string? — employment | nda | service | lease | sale | loan",
  "variant": "string? — standard | simplified | bilingual",
  "language": "string? — th | en | bilingual (default: th)"
}
```

**Output:**
```json
{
  "template": {
    "id": "tpl-employment-001",
    "name": "สัญญาจ้างแรงงาน (มาตรฐาน)",
    "type": "employment",
    "variant": "standard",
    "language": "th",
    "version": "2.1",
    "last_updated": "2026-01-15",
    "content": "สัญญาจ้างแรงงาน\n\nทำที่ ______\nวันที่ ______\n\nระหว่าง...",
    "variables": [
      { "name": "employer_name", "label": "ชื่อนายจ้าง", "required": true },
      { "name": "employee_name", "label": "ชื่อลูกจ้าง", "required": true },
      { "name": "position", "label": "ตำแหน่ง", "required": true },
      { "name": "salary", "label": "เงินเดือน (บาท)", "required": true },
      { "name": "start_date", "label": "วันเริ่มงาน", "required": true }
    ],
    "mandatory_clauses": [
      "ตำแหน่งและหน้าที่",
      "ค่าจ้างและสวัสดิการ",
      "ชั่วโมงทำงาน",
      "เงื่อนไขการเลิกจ้าง"
    ],
    "legal_notes": [
      "ต้องสอดคล้องกับ พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541",
      "ค่าจ้างต้องไม่ต่ำกว่าค่าแรงขั้นต่ำ"
    ],
    "stamp_duty": "ไม่ต้องติดอากรแสตมป์"
  }
}
```

**Template Types:**

| Type | คำอธิบาย | ตัวอย่าง Variants |
|------|---------|-----------------|
| `employment` | สัญญาจ้างแรงงาน | standard, probation, fixed-term |
| `nda` | สัญญารักษาความลับ | mutual, unilateral, bilingual |
| `service` | สัญญาบริการ/จ้างทำของ | standard, consulting, IT |
| `lease` | สัญญาเช่า | property, equipment, vehicle |
| `sale` | สัญญาซื้อขาย | goods, property, business |
| `loan` | สัญญากู้ยืม | personal, corporate |
| `partnership` | สัญญาร่วมทุน/หุ้นส่วน | joint-venture, partnership |
| `license` | สัญญาอนุญาตใช้สิทธิ์ | software, trademark, patent |

---

#### `legal_th/check_compliance` (Phase 2)

ตรวจสอบ compliance ตามกฎหมายไทย

**Input:**
```json
{
  "check_type": "string — pdpa | labor | consumer | tax | general",
  "context": "string — อธิบายกิจกรรม/โครงการที่ต้องตรวจ",
  "code": "string? — source code ที่ต้องตรวจ (สำหรับ PDPA data handling)",
  "industry": "string? — finance | healthcare | ecommerce | tech | general",
  "details": {
    "data_types": ["string? — personal_data | sensitive_data | financial_data"],
    "data_subjects": ["string? — employees | customers | partners | public"],
    "cross_border": "boolean? — มีการโอนข้อมูลข้ามประเทศ",
    "employee_count": "number? — จำนวนพนักงาน"
  }
}
```

**Output:**
```json
{
  "summary": {
    "status": "proceed_with_conditions",
    "risk_level": "YELLOW",
    "compliance_score": 72
  },
  "applicable_laws": [
    {
      "law": "PDPA พ.ศ. 2562",
      "relevance": "เก็บข้อมูลส่วนบุคคลของลูกค้า",
      "key_requirements": ["ต้องมี Privacy Notice", "ต้องมีฐานทางกฎหมาย"]
    }
  ],
  "requirements": [
    {
      "id": 1,
      "requirement": "จัดทำ Privacy Notice",
      "status": "not_met",
      "action_needed": "จัดทำ Privacy Notice ภาษาไทย แจ้งวัตถุประสงค์การเก็บข้อมูล",
      "legal_reference": "PDPA มาตรา 23",
      "priority": "high"
    }
  ],
  "risks": [
    {
      "risk": "เก็บข้อมูลโดยไม่มีฐานทางกฎหมาย",
      "severity": "high",
      "penalty": "ปรับไม่เกิน 5,000,000 บาท",
      "mitigation": "กำหนดฐานทางกฎหมายสำหรับการประมวลผลแต่ละกรณี"
    }
  ],
  "actions": [
    "จัดทำ Privacy Notice",
    "กำหนดฐานทางกฎหมาย",
    "แต่งตั้ง DPO"
  ]
}
```

---

#### `legal_th/generate_contract` (Phase 2)

สร้างสัญญาจาก template + เงื่อนไข

**Input:**
```json
{
  "contract_type": "string — employment | nda | service | lease | ...",
  "variant": "string? — standard | simplified | bilingual",
  "variables": {
    "employer_name": "บริษัท ตัวอย่าง จำกัด",
    "employee_name": "นายสมชาย ใจดี",
    "position": "Software Engineer",
    "salary": 50000,
    "start_date": "2026-04-01"
  },
  "include_compliance": "boolean? — เพิ่มข้อกำหนด compliance อัตโนมัติ",
  "additional_clauses": ["string? — ข้อกำหนดเพิ่มเติม"]
}
```

**Output:**
```json
{
  "contract": {
    "content": "สัญญาจ้างแรงงาน\n\nทำที่ กรุงเทพมหานคร\nวันที่ 1 เมษายน 2569\n\nระหว่าง บริษัท ตัวอย่าง จำกัด...",
    "format": "markdown",
    "language": "th"
  },
  "compliance_notes": [
    "ค่าจ้าง 50,000 บาท สูงกว่าค่าแรงขั้นต่ำ ✓",
    "ระบุชั่วโมงทำงานไม่เกิน 8 ชม./วัน ✓",
    "แนะนำเพิ่มข้อกำหนด PDPA สำหรับข้อมูลพนักงาน"
  ],
  "legal_references": [
    "พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541",
    "PDPA พ.ศ. 2562 (สำหรับข้อมูลพนักงาน)"
  ],
  "stamp_duty": "ไม่ต้องติดอากรแสตมป์",
  "withholding_tax": "หัก ณ ที่จ่ายตามอัตราภาษีเงินได้บุคคลธรรมดา"
}
```

---

#### `legal_th/generate_checklist` (Phase 2)

สร้าง compliance checklist ตามประเภทข้อกำหนด

**Input:**
```json
{
  "requirement_type": "string — pdpa | labor_hire | labor_terminate | new_business | cross_border_data",
  "context": "string? — บริบทเพิ่มเติม",
  "industry": "string? — อุตสาหกรรม"
}
```

**Output:**
```json
{
  "checklist": {
    "title": "Checklist การจ้างพนักงานใหม่",
    "requirement_type": "labor_hire",
    "items": [
      {
        "id": 1,
        "category": "ก่อนจ้าง",
        "item": "จัดทำสัญญาจ้างงาน (ภาษาไทย)",
        "required": true,
        "legal_reference": "พ.ร.บ.คุ้มครองแรงงาน",
        "notes": "ระบุตำแหน่ง ค่าจ้าง วันเริ่มงาน ชั่วโมงทำงาน"
      },
      {
        "id": 2,
        "category": "ก่อนจ้าง",
        "item": "ขึ้นทะเบียนประกันสังคม",
        "required": true,
        "legal_reference": "พ.ร.บ.ประกันสังคม มาตรา 34",
        "notes": "ภายใน 30 วันนับแต่วันที่รับเข้าทำงาน"
      }
    ],
    "total_items": 12,
    "required_items": 8,
    "optional_items": 4
  }
}
```

---

#### `legal_th/regulatory_updates` (Phase 3)

ดึงข่าวสารกฎหมายล่าสุด

**Input:**
```json
{
  "category": "string? — หมวดหมู่ (ดู categories ด้านบน)",
  "limit": "number? — จำนวน (default: 10)",
  "since": "string? — ISO date (เช่น 2026-03-01)"
}
```

**Output:**
```json
{
  "updates": [
    {
      "id": "upd-2026-0312",
      "title": "ประกาศ สคส. เรื่องมาตรฐานการรักษาความมั่นคงปลอดภัย",
      "category": "data_protection",
      "type": "announcement",
      "published_date": "2026-03-12",
      "effective_date": "2026-06-12",
      "summary": "สคส. ออกประกาศกำหนดมาตรฐานขั้นต่ำ...",
      "impact": "ผู้ควบคุมข้อมูลต้องปรับปรุงมาตรการรักษาความปลอดภัย",
      "source_url": "https://pdpc.or.th/...",
      "related_laws": ["PDPA มาตรา 37"]
    }
  ],
  "total": 3
}
```

---

## 5. Data Model

### 5.1 ER Diagram (หลัก)

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   laws      │     │  law_sections   │     │  categories  │
│─────────────│     │─────────────────│     │──────────────│
│ id (PK)     │────<│ id (PK)         │     │ id (PK)      │
│ title_th    │     │ law_id (FK)     │     │ key          │
│ title_en    │     │ section_number  │     │ name_th      │
│ category_id │>────│ title           │     │ name_en      │
│ law_type    │     │ content         │     └──────────────┘
│ year        │     │ content_en      │
│ status      │     └─────────────────┘
│ source_url  │
└─────────────┘

┌─────────────┐     ┌─────────────────┐
│  glossary   │     │   templates     │
│─────────────│     │─────────────────│
│ id (PK)     │     │ id (PK)         │
│ term_th     │     │ name            │
│ term_en     │     │ type            │
│ definition  │     │ variant         │
│ category    │     │ content         │
│ reference   │     │ variables (JSON)│
└─────────────┘     │ mandatory_clauses│
                    │ legal_notes     │
┌─────────────┐     │ stamp_duty      │
│ api_keys    │     └─────────────────┘
│─────────────│
│ id (PK)     │     ┌─────────────────┐
│ key_hash    │     │  audit_logs     │
│ org_id      │     │─────────────────│
│ permissions │     │ id (PK)         │
│ rate_limit  │     │ api_key_id (FK) │
│ created_at  │     │ method          │
│ expires_at  │     │ params_hash     │
└─────────────┘     │ response_code   │
                    │ response_time_ms│
                    │ created_at      │
                    └─────────────────┘
```

### 5.2 ขนาดข้อมูลโดยประมาณ

| ตาราง | Phase 1 | Phase 2 | Phase 3 |
|-------|---------|---------|---------|
| laws | 50+ | 200+ | 500+ |
| law_sections | 500+ | 2,000+ | 5,000+ |
| glossary | 200+ | 500+ | 1,000+ |
| templates | 10+ | 50+ | 100+ |

---

## 6. Tech Stack

### 6.1 แนะนำ (Recommended)

| Layer | เทคโนโลยี | เหตุผล |
|-------|----------|--------|
| **Runtime** | Node.js (TypeScript) | ทีมคุ้นเคย, ecosystem ใหญ่, MCP SDK รองรับ |
| **Framework** | Fastify หรือ Hono | เร็ว, lightweight, JSON-RPC friendly |
| **Database** | PostgreSQL | เสถียร, full-text search ภาษาไทย, JSONB support |
| **Search** | PostgreSQL Full-Text (Phase 1) → Elasticsearch (Phase 2+) | เริ่มง่าย แล้วค่อย scale |
| **Cache** | Redis | session, rate limiting, query cache |
| **ORM** | Drizzle หรือ Prisma | type-safe, migration support |
| **Validation** | Zod | ตรวจ input ทุก endpoint |
| **Auth** | API Key + HMAC | เรียบง่าย ปลอดภัย |
| **Logging** | Pino | structured logging, เร็ว |
| **Testing** | Vitest | เร็ว, TypeScript native |

### 6.2 ทางเลือกอื่น

| Layer | ทางเลือก |
|-------|---------|
| Runtime | Python (FastAPI), Go (Echo/Gin) |
| Database | MySQL, MongoDB |
| Search | MeiliSearch, Typesense |
| Cloud | AWS Lambda + RDS, Google Cloud Run, Railway |

### 6.3 Infrastructure

**Phase 1 (MVP):**
```
Railway / Render / DigitalOcean App Platform
├── Single server instance
├── Managed PostgreSQL
└── ไม่ต้อง Redis ยัง
ค่าใช้จ่ายประมาณ: $20-50/เดือน
```

**Phase 2:**
```
AWS / GCP
├── Container (ECS / Cloud Run)
├── Managed PostgreSQL (RDS / Cloud SQL)
├── Redis (ElastiCache / Memorystore)
├── Elasticsearch (OpenSearch / Elastic Cloud)
└── CloudFront / Cloud CDN
ค่าใช้จ่ายประมาณ: $200-500/เดือน
```

**Phase 3:**
```
AWS / GCP (production grade)
├── Multi-AZ deployment
├── Auto-scaling
├── Monitoring (Grafana / CloudWatch)
├── CI/CD pipeline
└── Backup & disaster recovery
ค่าใช้จ่ายประมาณ: $500-2,000/เดือน
```

---

## 7. Development Phases

### Phase 1: MVP (สัปดาห์ 1-4)

**เป้าหมาย:** Server ตอบ MCP request ได้ มีข้อมูลกฎหมายพื้นฐาน

**Deliverables:**
- [ ] MCP HTTP server skeleton (JSON-RPC 2.0 handler)
- [ ] API Key authentication
- [ ] `legal_th/search_laws` — full-text search ใน PostgreSQL
- [ ] `legal_th/glossary_lookup` — ค้นหาศัพท์กฎหมาย
- [ ] `legal_th/get_template` — ดึง template สัญญา
- [ ] ข้อมูล: 50+ กฎหมาย, 200+ ศัพท์, 10+ templates
- [ ] Basic request logging
- [ ] API documentation (OpenAPI spec)
- [ ] Deploy บน Railway/Render

**ทีม:** 1-2 คน
**ความซับซ้อน:** ต่ำ-ปานกลาง

**Success Criteria:**
- ✓ Client plugin (Claude/OpenCode) เชื่อมต่อได้
- ✓ ค้นหากฎหมาย ดึง template ค้นศัพท์ ทำงานได้
- ✓ Response time < 500ms (p95)
- ✓ API docs ครบ

---

### Phase 2: Feature Expansion (สัปดาห์ 5-12)

**เป้าหมาย:** เพิ่ม compliance engine และขยายข้อมูล

**Deliverables:**
- [ ] `legal_th/check_compliance` — PDPA + แรงงาน rule engine
- [ ] `legal_th/generate_contract` — สร้างสัญญาจาก template + variables
- [ ] `legal_th/generate_checklist` — compliance checklist
- [ ] Elasticsearch integration (ค้นหาดีขึ้น)
- [ ] Redis caching (response cache + rate limiting)
- [ ] Rate limiting system
- [ ] ขยายข้อมูล: 200+ กฎหมาย, 500+ ศัพท์, 50+ templates
- [ ] Request signing (HMAC-SHA256)
- [ ] Audit log retention
- [ ] Admin API สำหรับจัดการข้อมูล

**ทีม:** 2-3 คน
**ความซับซ้อน:** ปานกลาง

**ส่วนที่ยากที่สุด:**
- Compliance rule engine — ต้องเขียน rules ที่ถูกต้องตามกฎหมาย
- ต้องมีทนายความ/ผู้เชี่ยวชาญตรวจสอบ rules

---

### Phase 3: Scale & Production (สัปดาห์ 13-24)

**เป้าหมาย:** production-ready, รองรับ scale

**Deliverables:**
- [ ] `legal_th/regulatory_updates` — ข่าวกฎหมายล่าสุด
- [ ] Regulatory monitoring system (scrape ราชกิจจานุเบกษา)
- [ ] Webhook notifications
- [ ] Admin dashboard (web UI)
- [ ] Multi-AZ deployment
- [ ] Auto-scaling
- [ ] Monitoring & alerting (Grafana)
- [ ] Performance optimization (CDN, query optimization)
- [ ] ขยายข้อมูล: 500+ กฎหมาย, 1000+ ศัพท์, 100+ templates
- [ ] Security audit
- [ ] SLA 99.5%

**ทีม:** 3-5 คน
**ความซับซ้อน:** สูง

---

## 8. ข้อมูลกฎหมาย — ความท้าทายหลัก

> **สิ่งที่ยากที่สุดของ project นี้ไม่ใช่ code แต่คือ "ข้อมูล"**

### 8.1 แหล่งข้อมูล

| แหล่ง | ข้อมูล | รูปแบบ |
|-------|--------|--------|
| ราชกิจจานุเบกษา | กฎหมายทุกฉบับ | PDF / HTML |
| สำนักงานคณะกรรมการกฤษฎีกา | กฎหมาย + คำวินิจฉัย | Web |
| สคส. (PDPC) | ประกาศ ระเบียบ PDPA | Web / PDF |
| ศาลฎีกา | คำพิพากษา | Web |
| กระทรวงแรงงาน | ประกาศ ระเบียบแรงงาน | Web / PDF |

### 8.2 กระบวนการจัดการข้อมูล

```
รวบรวม → ตรวจสอบ → จัดรูปแบบ → นำเข้า DB → ตรวจสอบซ้ำ → เผยแพร่

       ▲ ต้องมีผู้เชี่ยวชาญกฎหมายตรวจสอบทุกขั้นตอน
```

### 8.3 ข้อควรระวัง

- ข้อมูลกฎหมาย **ต้องถูกต้อง 100%** — ข้อมูลผิดอาจสร้างความเสียหาย
- ต้อง update เมื่อมีการแก้ไขกฎหมาย (ภายใน 48 ชม.)
- ต้องระบุ version/วันที่ ของข้อมูลกฎหมายที่ให้บริการ
- **ต้องมี disclaimer** ว่าไม่ใช่คำปรึกษาทางกฎหมาย

---

## 9. ทีมที่ต้องการ

| บทบาท | จำนวน | Phase |
|-------|-------|-------|
| **Backend Developer** (Node.js/TypeScript) | 1-2 | 1+ |
| **Database Engineer** | 1 | 1+ |
| **Legal Content Specialist** (ผู้เชี่ยวชาญกฎหมาย) | 1-2 | 1+ |
| **DevOps / Infrastructure** | 1 | 2+ |
| **QA / Tester** | 1 | 2+ |
| **Frontend Developer** (Admin dashboard) | 1 | 3 |
| **Security Specialist** | 1 | 3 |

**สิ่งสำคัญ:** ต้องมี **Legal Content Specialist** ตั้งแต่ Phase 1 — คนที่รวบรวม ตรวจสอบ และ maintain ข้อมูลกฎหมาย

---

## 10. Timeline สรุป

```
สัปดาห์  1-4   │ Phase 1: MVP
               │ 3 endpoints + 50 กฎหมาย + deploy
               │
สัปดาห์  5-12  │ Phase 2: Feature Expansion
               │ Compliance engine + 200 กฎหมาย + Elasticsearch
               │
สัปดาห์ 13-24  │ Phase 3: Production
               │ Regulatory updates + Admin + Scale + 500 กฎหมาย
               │
สัปดาห์ 24+    │ Maintenance & Growth
               │ SLA 99.5% + continuous law updates
```

---

## 11. Risks & Mitigations

| ความเสี่ยง | ผลกระทบ | การลดความเสี่ยง |
|-----------|---------|---------------|
| ข้อมูลกฎหมายไม่ถูกต้อง | ผู้ใช้ได้ข้อมูลผิด สร้างความเสียหาย | ผู้เชี่ยวชาญกฎหมายตรวจสอบทุกข้อมูล + disclaimer |
| กฎหมายเปลี่ยนแปลงบ่อย | ข้อมูลล้าสมัย | Regulatory monitoring + update ภายใน 48 ชม. |
| Compliance engine ไม่แม่นยำ | ให้คำแนะนำผิด | เริ่มจาก rules ที่ชัดเจน + label ว่า "ช่วยเหลือเบื้องต้น" |
| Server ล่ม | plugin ทุกตัวใช้ไม่ได้ | Multi-AZ + health check + graceful degradation |
| API key รั่วไหล | unauthorized access | Hash key ใน DB + key rotation + audit log |
| Scale ไม่ทัน | response ช้า / timeout | Caching + auto-scaling + performance monitoring |

---

## 12. เอกสารที่เกี่ยวข้อง

| เอกสาร | ที่อยู่ | คำอธิบาย |
|--------|--------|---------|
| Concept Document | `../legal-th-plugin-concept-v2.md` | ภาพรวมทั้ง project |
| Claude Plugin | `../clients/legal-th-plugin-claude/` | Client plugin สำหรับ Claude Code |
| OpenCode Plugin | `../clients/legal-th-plugin-opencode/` | Client plugin สำหรับ OpenCode |
| Anthropic Legal Plugin (ref) | `../knowledge-work-plugins/legal/` | Reference จาก Anthropic |

---

## 13. คำถามที่ต้องตัดสินใจ

ก่อนเริ่ม Phase 1 ทีมต้องตัดสินใจ:

1. **Tech stack** — Node.js (TypeScript) หรือ Python (FastAPI) หรือ Go?
2. **Cloud platform** — Railway (เริ่มเร็ว) หรือ AWS/GCP (scale ได้)?
3. **ข้อมูลกฎหมาย** — ใครเป็นผู้รวบรวมและตรวจสอบ?
4. **ลำดับความสำคัญ** — กฎหมาย 50 ฉบับแรกเอาอะไรบ้าง?
5. **Domain name / URL** — `api.legal-th.example.com` หรืออื่น?
6. **License model** — Open source หรือ Commercial?

---

**จัดทำ:** Legal-TH Plugin Team
**วันที่:** 2026-03-13
**Version:** 1.0
**สถานะ:** Draft — รอทีมรับทราบและตัดสินใจ
