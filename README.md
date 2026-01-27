# Thread (Embedded Edition)

A high-performance, local-first memory engine for AI Agents.
It combines **Temporal**, **Semantic**, and **Graph** retrieval capabilities without requiring Docker.

##  Architecture (Embedded Stack)
- **Database**: SQLite (WAL Mode) with Drizzle ORM.
- **Vector Store**: LanceDB (Embedded).
- **Graph Engine**: Native SQLite Recursive CTEs.
- **Cache**: In-Memory LRU (Session).
- **Interface**: MCP (Model Context Protocol).

##  Getting Started

### 1. Prerequisites
- Node.js v18+
- Windows/Linux/Mac (No Docker required)

### 2. Installation
```bash
npm install
```

### 3. Database Setup
Initialize the SQLite database and generate migrations:
```bash
npx drizzle-kit generate
```
*Note: The database is created automatically in `./data/remem.db` on first run.*

### 4. Running the Server
Start the MCP Server (Stdio Mode):
```bash
npm start
```
*Debug Mode:*
```bash
npm run dev
```

##  Testing
Run the System Integration Test to verify the full pipeline (Embedding -> Storage -> Retrieval):
```bash
npm test
```

##  Project Structure
- `src/infrastructure/`: Database, Vector, and Cache implementations.
- `src/core/`: Logic for Graph Traversal and Memory Orchestration.
- `src/interface/mcp/`: MCP Tool definitions and Server entry point.
- `drizzle/`: SQL Migrations.
