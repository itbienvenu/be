# Umurava Backend AI Service

## Setup
1. Ensure you have Node.js >= 20.0.0 installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Configure your environment variables in `.env`.
   - **IMPORTANT**: `MONGODB_TLS_ALLOW_INVALID_CERTS` is for local development only. Do NOT enable it in production unless strictly necessary for corporate proxy environments, and always ensure `ALLOW_DEVELOPMENT_CERTS=true` is set to acknowledge the risk.

## Manual Verification Scripts
To verify the AI job parsing service with a live network call:
```bash
npx tsx scripts/test-ai.ts
```

To verify the schema validation of a sample job:
```bash
npx tsx scripts/test-job.ts
```
