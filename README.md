# Legal-TH MCP Server

MCP HTTP Server สำหรับฐานข้อมูลกฎหมายไทย — ให้บริการค้นหากฎหมาย, ศัพท์กฎหมาย, template สัญญา, ตรวจ compliance ผ่าน MCP protocol

รองรับ client plugin จากทุก AI coding agent ที่รองรับ MCP (Claude Code, OpenCode ฯลฯ)

> **Disclaimer:** Server นี้ให้ข้อมูลกฎหมายเพื่อช่วยงาน workflow ไม่ใช่คำปรึกษาทางกฎหมาย

---

## Architecture

```
Client Plugins (Claude Code, OpenCode, ...)
         │
         │ JSON-RPC 2.0 over HTTPS
         ▼
┌─────────────────────────────────┐
│  Legal-TH MCP Server            │
│  ├─ Fastify (HTTP)              │
│  ├─ JSON-RPC Router             │
│  ├─ Auth Middleware              │
│  ├─ Services                    │
│  │   ├─ search-laws             │
│  │   ├─ glossary                │
│  │   ├─ templates               │
│  │   ├─ compliance (Phase 2)    │
│  │   └─ updates (Phase 3)       │
│  └─ Drizzle ORM                 │
│      └─ PostgreSQL              │
└─────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ (TypeScript) |
| Framework | Fastify 5 |
| Database | PostgreSQL |
| ORM | Drizzle |
| Validation | Zod |
| Logging | Pino |

---

## Project Structure

```
legal-th-server/
├── src/
│   ├── index.ts                  # Server entry point
│   ├── routes/
│   │   └── mcp.ts                # MCP JSON-RPC handler
│   ├── services/
│   │   ├── search-laws.ts        # ค้นหากฎหมาย
│   │   ├── glossary.ts           # ศัพท์กฎหมาย
│   │   └── templates.ts          # Template สัญญา
│   ├── models/
│   │   └── schema.ts             # Drizzle database schema
│   ├── middleware/
│   │   └── auth.ts               # API key authentication
│   └── utils/
│       └── env.ts                # Environment config (Zod)
├── data/
│   ├── laws/                     # JSON data: กฎหมาย
│   ├── glossary/                 # JSON data: ศัพท์กฎหมาย
│   └── templates/                # JSON data: template สัญญา
├── scripts/
│   ├── migrate.ts                # Database migration
│   └── seed.ts                   # Seed data
├── tests/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── Dockerfile
├── .env.example
└── legal-th-server-spec.md       # Full specification
```

---

## MCP Endpoints

### Phase 1 (MVP)

| Method | คำอธิบาย | Status |
|--------|---------|:------:|
| `legal_th/search_laws` | ค้นหากฎหมายไทย | Skeleton |
| `legal_th/glossary_lookup` | ค้นหาศัพท์กฎหมาย | Skeleton |
| `legal_th/get_template` | ดึง template สัญญา | Skeleton |

### Phase 2

| Method | คำอธิบาย | Status |
|--------|---------|:------:|
| `legal_th/check_compliance` | ตรวจ compliance | Planned |
| `legal_th/generate_contract` | สร้างสัญญาจาก template | Planned |
| `legal_th/generate_checklist` | สร้าง compliance checklist | Planned |

### Phase 3

| Method | คำอธิบาย | Status |
|--------|---------|:------:|
| `legal_th/regulatory_updates` | ข่าวกฎหมายล่าสุด | Planned |

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
# Clone
git clone https://github.com/monthop-gmail/legal-th-server.git
cd legal-th-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run db:migrate

# Seed data
npm run db:seed

# Start development server
npm run dev
```

### Test with curl

```bash
# Health check
curl http://localhost:3000/health

# Search laws
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-1",
    "method": "legal_th/search_laws",
    "params": { "query": "PDPA" }
  }'

# Glossary lookup
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-2",
    "method": "legal_th/glossary_lookup",
    "params": { "term": "นิติกรรม" }
  }'
```

### Docker

```bash
docker build -t legal-th-server .
docker run -p 3000:3000 --env-file .env legal-th-server
```

---

## Database Schema

```
laws              law_sections        categories
├─ id (PK)        ├─ id (PK)          ├─ id (PK)
├─ title_th       ├─ law_id (FK)      ├─ key (unique)
├─ title_en       ├─ section_number   ├─ name_th
├─ category_key   ├─ title            └─ name_en
├─ law_type       ├─ content
├─ year           └─ content_en
├─ status
└─ source_url

glossary          templates           api_keys
├─ id (PK)        ├─ id (PK)          ├─ id (PK)
├─ term_th        ├─ name             ├─ key_hash
├─ term_en        ├─ type             ├─ org_name
├─ definition_th  ├─ variant          ├─ permissions
├─ definition_en  ├─ content          └─ rate_limit_max
├─ legal_ref      ├─ variables (JSON)
└─ related_terms  └─ legal_notes      audit_logs
                                      ├─ id (PK)
                                      ├─ api_key_id
                                      ├─ method
                                      ├─ response_code
                                      └─ response_time_ms
```

---

## Development Status

### What's Done
- [x] Project skeleton (TypeScript + Fastify)
- [x] MCP JSON-RPC 2.0 handler
- [x] 3 service stubs (search-laws, glossary, templates)
- [x] Database schema (Drizzle)
- [x] Auth middleware stub
- [x] Environment config (Zod)
- [x] Dockerfile
- [x] Full specification document

### What's Next
- [ ] Setup PostgreSQL + run migrations
- [ ] Implement full-text search (Thai)
- [ ] Populate initial data (50 laws, 200 glossary, 10 templates)
- [ ] Implement service logic
- [ ] Write tests
- [ ] Deploy to Railway/Render
- [ ] Connect with client plugins

---

## Related Repos

| Repo | คำอธิบาย |
|------|---------|
| [legal-th-plugin](https://github.com/monthop-gmail/legal-th-plugin) | Client plugins (Claude Code, OpenCode) |

---

## Contributing

ยินดีรับ contributions โดยเฉพาะ:
- **ข้อมูลกฎหมาย** — JSON data files ใน `data/`
- **Thai full-text search** — PostgreSQL Thai tokenizer
- **Tests** — Unit + integration tests
- **Deployment** — Docker Compose, Railway config

---

## License

[MIT](LICENSE)

---

## Team

Built by Legal-TH Plugin Team

**Co-authored with** Claude Opus 4.6
