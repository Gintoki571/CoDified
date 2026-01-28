@echo off
cd /d "C:\Users\Bindesh Kandel\CoD\CoDified"

REM Set environment variables
set LLM_PROVIDER=lmstudio
set OPENAI_API_KEY=lm-studio
set OPENAI_BASE_URL=http://127.0.0.1:1234/v1
set EMBEDDING_MODEL=text-embedding-bge-reranker-v2-m3
set DEFAULT_USER_ID=default_user
set NODE_ENV=development

npx -qy tsx src/interface/mcp/tools.ts
