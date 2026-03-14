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
         │
    CF Tunnel (optional)
         │
    *.legal-th.example.com
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ (TypeScript) |
| Framework | Fastify 5 |
| Database | PostgreSQL 16 |
| ORM | Drizzle |
| Validation | Zod |
| Logging | Pino |
| Tunnel | Cloudflare Tunnel |
| Secrets | SOPS + age |
| CI/CD | GitHub Actions |

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
├── services/                     # Modular compose (Docker Compose v2.20+)
│   ├── app/compose.yaml          # MCP Server service
│   ├── postgres/compose.yaml     # PostgreSQL 16
│   ├── redis/compose.yaml        # Redis (Phase 2)
│   └── tunnels/compose.yaml      # Cloudflare Tunnel
├── data/
│   ├── laws/                     # JSON data: กฎหมาย
│   ├── glossary/                 # JSON data: ศัพท์กฎหมาย
│   └── templates/                # JSON data: template สัญญา
├── scripts/
│   ├── migrate.ts                # Database migration
│   ├── seed.ts                   # Seed data
│   └── deploy.sh                 # Manual deploy script
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD: auto deploy from branch
├── docker-compose.yml            # Root: include services/* (modular)
├── docker-compose.dev.yml        # Dev override (hot reload + Adminer)
├── docker-compose.prd.yml        # Prd override (limits + healthcheck)
├── Dockerfile                    # Production image
├── Dockerfile.dev                # Dev image (hot reload)
├── .env.example                  # Environment template (commit ได้)
├── .sops.yaml                    # SOPS config (commit ได้)
├── .env.enc                      # Encrypted secrets (commit ได้)
├── package.json
├── tsconfig.json
├── drizzle.config.ts
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

### Docker Compose (แนะนำ)

ไม่ต้องติดตั้ง Node.js หรือ PostgreSQL เอง

```bash
# Clone
git clone https://github.com/monthop-gmail/legal-th-server.git
cd legal-th-server

# Copy environment
cp .env.example .env

# Development mode (hot reload + Adminer DB GUI)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production mode
docker compose -f docker-compose.yml -f docker-compose.prd.yml up -d

# Production (includes CF Tunnel)
docker compose -f docker-compose.yml -f docker-compose.prd.yml up -d
```

**Services ที่ได้:**

| Service | URL | คำอธิบาย |
|---------|-----|---------|
| MCP Server | http://localhost:3000 | API endpoint |
| Health Check | http://localhost:3000/health | ตรวจสถานะ |
| Adminer (dev) | http://localhost:8080 | DB GUI |
| PostgreSQL (dev) | localhost:5432 | เชื่อมจาก tools ภายนอก |
| CF Tunnel | *.legal-th.example.com | Public URL ผ่าน Cloudflare (ทุก env) |

### คำสั่งที่ใช้บ่อย

```bash
# ─── Development ───
docker compose -f docker-compose.yml -f docker-compose.dev.yml up        # เริ่ม dev
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d     # background
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f   # ดู logs
docker compose -f docker-compose.yml -f docker-compose.dev.yml down      # หยุด
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v   # หยุด + ลบ DB

# ─── Migration & Seed ───
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec app npm run db:migrate
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec app npm run db:seed

# ─── Deploy (manual) ───
./scripts/deploy.sh dev    # deploy dev
./scripts/deploy.sh prd    # deploy production
```

---

### Manual Setup

#### Prerequisites

- Node.js 20+
- PostgreSQL 16+

```bash
git clone https://github.com/monthop-gmail/legal-th-server.git
cd legal-th-server
npm install
cp .env.example .env
# Edit .env
npm run db:migrate
npm run db:seed
npm run dev
```

---

### ทดสอบ

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

---

## Environment & Deployment

### Environment Separation

| Environment | Branch | DNS Pattern | Deploy |
|-------------|--------|-------------|--------|
| dev | `feature/*` → `develop` | `svc.dev.legal-th.example.com` | manual |
| test | `develop` | `svc.test.legal-th.example.com` | auto (push to develop) |
| prd | `main` | `svc.legal-th.example.com` | auto (push to main) |

### Compose Pattern (Modular)

```
docker-compose.yml              ← root: include services/*
  ├── services/app/compose.yaml       ← MCP Server
  ├── services/postgres/compose.yaml  ← PostgreSQL 16
  ├── services/redis/compose.yaml     ← Redis (Phase 2)
  └── services/tunnels/compose.yaml   ← CF Tunnel
  + docker-compose.dev.yml     ← dev override (hot reload, Adminer, DB port)
  + docker-compose.prd.yml     ← prd override (resource limits, healthcheck)
```

- ใช้ Docker Compose `include:` (v2.20+) แยก service ต่อไฟล์
- เพิ่ม/ลบ service แค่เพิ่มไฟล์ + include ไม่ต้องแก้ไฟล์หลัก
- ทุก service อยู่ใน shared network `legal-th-net`
- ต่างกันแค่ `.env` + override file — Dockerfile และ source code เหมือนกันทุก env

### Secret Management (SOPS + age)

```bash
# ติดตั้ง
brew install sops age            # macOS
# หรือ apt install age && go install ... sops

# สร้าง key pair
age-keygen -o keys.txt
# เก็บที่ ~/.config/sops/age/keys.txt
mkdir -p ~/.config/sops/age && mv keys.txt ~/.config/sops/age/
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt

# เพิ่ม public key ใน .sops.yaml

# Encrypt / Decrypt
sops --encrypt .env > .env.enc   # encrypt → commit ได้
sops --decrypt .env.enc > .env   # decrypt → ใช้งาน
sops .env.enc                    # edit in-place
```

**สำคัญ:** `.env` ห้าม commit / `.env.enc` commit ได้ / ส่ง key ผ่าน 1Password หรือ Signal เท่านั้น

### Cloudflare Tunnel

1. สร้าง Tunnel บน [Cloudflare Dashboard](https://one.dash.cloudflare.com/)
2. ตั้ง Public Hostname เช่น `svc.legal-th.example.com → http://app:3000`
3. Copy token → ใส่ `CF_TUNNEL_TOKEN` ใน `.env`
4. `docker compose -f docker-compose.yml -f docker-compose.prd.yml up -d`

### CI/CD (GitHub Actions)

| Trigger | Action |
|---------|--------|
| Push to `develop` | Auto deploy → test env |
| Push to `main` | Auto deploy → prd env |

**GitHub Secrets ที่ต้องตั้ง:**

| Secret | คำอธิบาย |
|--------|---------|
| `DEPLOY_HOST_TEST` | IP/hostname ของ test server |
| `DEPLOY_HOST_PRD` | IP/hostname ของ prd server |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | SSH private key |
| `SOPS_AGE_KEY` | age private key content |

### Git Branching

```
feature/xxx → develop → main
               │          │
           auto test   auto prd
```

- `develop`: ต้องมี 1 approval
- `main`: ต้องมี 2 approvals + CI pass

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
- [x] Dockerfile (prod + dev)
- [x] Docker Compose (base + dev + prd override)
- [x] Cloudflare Tunnel sidecar
- [x] SOPS + age secret management
- [x] GitHub Actions deploy workflow
- [x] Deploy script
- [x] Full specification document

### What's Next
- [ ] Setup PostgreSQL + run migrations
- [ ] Implement full-text search (Thai)
- [ ] Populate initial data (50 laws, 200 glossary, 10 templates)
- [ ] Implement service logic
- [ ] Write tests
- [ ] Configure CF Tunnel per env
- [ ] Branch protection rules
- [ ] CODEOWNERS file
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
- **Infrastructure** — CF Tunnel, monitoring, alerting

---

## License

[MIT](LICENSE)

---

## Team

Built by Legal-TH Plugin Team

**Co-authored with** Claude Opus 4.6
