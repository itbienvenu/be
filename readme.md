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

## Logging

Console log format is controlled by the `NODE_ENV` environment variable:

- **Development** (`NODE_ENV` unset or any non-`"production"` value): colorized, human-readable format.
- **Production** (`NODE_ENV=production`): structured JSON format, suitable for log aggregation tools.

In non-production environments, logs are also written to files under the `logs/` directory.

## Job State Machine

Jobs follow a strict status lifecycle: `draft → published`. The following rules apply:

- **`patchJob`**: Only jobs in `"draft"` state can be edited. Attempting to patch a `"published"` or `"archived"` job returns a `400` error: `"Job is not in draft state and cannot be edited"`.
- **`publishJob`**: Only jobs in `"draft"` state can be published. Attempting to publish a non-draft job returns a `400` error: `"Job is not in draft state and cannot be published"`.

Both operations also enforce recruiter ownership — patching or publishing a job you don't own returns a `403 Forbidden`.

## Manual Verification Scripts
To verify the AI job parsing service with a live network call:
```bash
npx tsx scripts/test-ai.ts
```

To verify the schema validation of a sample job:
```bash
npx tsx scripts/test-job.ts
```
