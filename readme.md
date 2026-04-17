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

## AI Candidate Screening

Recruiters can trigger AI-powered screening via `POST /jobs/:jobId/screen`. Candidates are evaluated across five dimensions (skills, experience, education, resources, soft skills) using a deterministic weighted scoring engine.

### Scoring Weights (`scoring_config.weights`)

Each job's `scoring_config.weights` object controls how much each dimension contributes to the final score. Weights should sum to `1.0` (e.g. `skills: 0.5, experience: 0.25, education: 0.1, resources: 0.05, soft_skills: 0.1`).

If the weights don't sum to `1.0`, the scorer **automatically normalises** them at runtime so the final score always falls in the `[0, 100]` range. A `console.warn` is emitted when this happens, so misconfigured jobs are detectable in logs. If all weights are `0` or negative, the scorer falls back to equal weights (`0.2` each).

### AI Unavailability Fallback

If the Gemini API returns a malformed or null response, the scorer does **not** abort. Instead it generates deterministic `strengths`, `gaps`, and `recommendation` values derived from the computed dimension scores:

- Dimensions scoring `≥ 0.7` are surfaced as strengths.
- Dimensions scoring `< 0.5` are flagged as gaps.
- The recommendation is a score-band summary (strong / reasonable / partial / weak fit).

Screening results produced under this fallback include `"ai_unavailable": true` in the response so callers can distinguish AI-backed results from fallback ones.

---

## Application Rules

- An applicant can apply to multiple jobs, but **cannot apply to the same job more than once**.
- Attempting a duplicate application to the same job returns a `400` error: `"You have already applied to this job"`.

## Manual Verification Scripts
To verify the AI job parsing service with a live network call:
```bash
npx tsx scripts/test-ai.ts
```

To verify the schema validation of a sample job:
```bash
npx tsx scripts/test-job.ts
```
