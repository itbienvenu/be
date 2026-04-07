# Bugfix Requirements Document

## Introduction

The AI job structuring service (`JobAIService.generateStructuredJob`) calls the Gemini API without a `generationConfig`, meaning temperature defaults to a non-zero value and the response format is unconstrained text. As a result, the same raw job description input produces structurally and semantically different JSON outputs across runs. This non-determinism is critical because the output feeds directly into candidate scoring and matching — inconsistent structure or field values corrupt scoring results and make the system unreliable in production.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the same raw job description is submitted to `generateStructuredJob` on multiple runs THEN the system returns JSON objects with differing field values (e.g., different skill weights, different seniority levels, different summaries) across those runs.

1.2 WHEN the Gemini API is called without a `generationConfig` THEN the system sends a request body containing only `contents` with no temperature or response format constraints, allowing the model to produce free-form, variable text output.

1.3 WHEN the API returns a free-form text response THEN the system attempts to extract JSON via regex fallback (`extractJSON`), which is fragile and may silently parse partial or malformed JSON without error.

### Expected Behavior (Correct)

2.1 WHEN the same raw job description is submitted to `generateStructuredJob` on multiple runs THEN the system SHALL return structurally identical JSON output conforming to `job.schema.json`, with deterministic field values across runs.

2.2 WHEN the Gemini API is called THEN the system SHALL include a `generationConfig` with `temperature: 0`, `responseMimeType: "application/json"`, and a `responseSchema` derived from `job.schema.json`, enforcing structured output at the API level.

2.3 WHEN the API returns a structured JSON response THEN the system SHALL parse the response body directly as JSON without requiring regex-based extraction, eliminating the fragile `extractJSON` fallback path.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a valid raw job description is provided THEN the system SHALL CONTINUE TO return a `JobJSON` object that passes AJV validation against `job.schema.json`.

3.2 WHEN the Gemini API returns an error or non-OK HTTP status THEN the system SHALL CONTINUE TO log the error and return `null`.

3.3 WHEN the request exceeds the 20-second timeout THEN the system SHALL CONTINUE TO catch the `AbortError` and return `null`.

3.4 WHEN the API response contains no valid candidate content THEN the system SHALL CONTINUE TO return `null`.

3.5 WHEN `GEMINI_API_KEY` is not set in the environment THEN the system SHALL CONTINUE TO throw an error during `JobAIService` construction.
