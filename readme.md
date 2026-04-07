# Umurava Backend AI Service

## Setup
1. Ensure you have Node.js >= 20.0.0 installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your `GEMINI_API_KEY` in a `.env` file.

## Manual Verification Scripts
To verify the AI job parsing service with a live network call:
```bash
npx tsx scripts/test-ai.ts
```

To verify the schema validation of a sample job:
```bash
npx tsx scripts/test-job.ts
```
