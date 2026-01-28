# CoDified (Hardened Memory Engine)

A high-performance, local-first memory engine for AI Agents.
It combines **Temporal**, **Semantic**, and **Graph** retrieval capabilities with a hardened, production-ready architecture.

##  Core Architecture (Hardened Stack)
- **Database**: SQLite (WAL Mode) with Drizzle ORM.
- **Vector Store**: LanceDB (Embedded) with connection/table pooling.
- **Graph Engine**: Native SQLite Recursive CTEs (Bidirectional).
- **Intelligence**: Integrated Entity Extraction & Summarization.
- **Security**: Zod-validated MCP layer, Secure Randomness (`crypto`), and Thread-safe Transactions (`async-mutex`).
- **Extensibility**: Thread-safe Modular Plugin System (`ModuleManager`).

##  Features
- **Intelligence Ingestion**: Automatic extraction of entities and relations.
- **Hybrid Search**: RAG-enhanced retrieval combining semantic vectors and graph context.
- **Multi-Agent Ready**: Built-in schema support for multi-persona memory isolation.
- **Fast Path I/O**: Asynchronous background indexing for AI-heavy tasks.

##  Getting Started

### 1. Prerequisites
- Node.js v18+
- Windows/Linux/Mac (No Docker required)

### 2. Installation
```bash
npm install
```

### 3. Database Setup
```bash
npx drizzle-kit generate
```
The database is created in `./data/codified_v2.db`.

### 4. Running the Server (MCP)
```bash
npm start
```
*Debug Mode:* `npm run dev`

##  Testing
Run security and performance tests:
```bash
npm test # Standard integration
npx tsx tests/security/audit_remediation.test.ts # Security hardening verification
```

##  Project Structure
- `src/infrastructure/`: Database, Vector, and LLM implementations.
- `src/core/`: Logic for Graph Traversal, Memory Orchestration, and Modules.
- `src/interface/mcp/`: Validated MCP Tool definitions and Server.
- `drizzle/`: SQL Migrations for schema evolution.
