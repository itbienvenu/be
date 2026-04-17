# Requirements Document

## Introduction

This feature adds AI-powered candidate screening and ranking to the existing recruitment backend. A recruiter triggers screening for a published job, and the system evaluates all submitted applications using a deterministic weighted scoring model across five dimensions (skills, experience, education, resources, soft skills). The Gemini API handles fuzzy skill matching and soft skill inference; all arithmetic is deterministic. Each screened application receives a final score (0–100), a per-dimension breakdown, a strengths list, a gaps list, and a recommendation text. Results are persisted on the application record and exposed through a ranked-shortlist endpoint.

---

## Glossary

- **Screening_Service**: The `ScreeningAIService` module responsible for orchestrating candidate evaluation for a given job.
- **Scorer**: The deterministic scoring engine that computes dimension scores and the final weighted score from AI-extracted signals.
- **Gemini_Client**: The wrapper around the Gemini API (temperature: 0) used for fuzzy skill matching and soft skill inference.
- **Application**: A record in the `applications` collection conforming to `ApplicationJSON`, enriched with a `screening_result` after screening.
- **Applicant**: A record in the `applicants` collection conforming to `ApplicantJSON`, containing a structured `profile` and `cvRawText`.
- **Job**: A record in the `jobs` collection conforming to `JobJSON`, including `scoring_config.weights` and `scoring_config.rules`.
- **Screening_Result**: The structured output attached to an Application after screening, containing rank, final_score, dimension_breakdown, strengths, gaps, and recommendation.
- **Dimension_Breakdown**: An object with five keys — `skills`, `experience`, `education`, `resources`, `soft_skills` — each holding a score between 0.0 and 1.0.
- **Shortlist**: The ordered list of screened Applications for a job, sorted descending by final_score, limited to the top N (10 or 20).
- **Hard_Disqualification**: A rule that sets a candidate's final_score to 0 and marks the Application status as `rejected` before ranking.
- **Recruiter**: An authenticated user with the `recruiter` role who owns the job and triggers screening.
- **Skill_Match_Signal**: The per-skill score (0, 0.5, or 1.0) returned by the Gemini_Client for a candidate–job skill pair.
- **Soft_Skill_Signal**: The per-soft-skill score (0.0–1.0) inferred by the Gemini_Client from the candidate's `cvRawText` and `profile.bio`.

---

## Requirements

### Requirement 1: Screening Trigger Endpoint

**User Story:** As a recruiter, I want to trigger AI screening for a job, so that all submitted applications are evaluated and ranked automatically.

#### Acceptance Criteria

1. WHEN a recruiter sends `POST /jobs/:jobId/screen`, THE Screening_Service SHALL accept the request only if the authenticated user is the owner of the specified job.
2. IF the specified job does not exist or belongs to a different recruiter, THEN THE Screening_Service SHALL return HTTP 403 with a descriptive error message.
3. WHEN the screening request is accepted, THE Screening_Service SHALL retrieve all Applications with `status` equal to `"pending"` or `"reviewed"` for the specified job.
4. IF no eligible Applications exist for the job, THEN THE Screening_Service SHALL return HTTP 200 with an empty results array and a message indicating no candidates were found.
5. WHEN screening completes, THE Screening_Service SHALL return HTTP 200 with the full ranked shortlist in the response body.

---

### Requirement 2: Batch AI Screening Call

**User Story:** As a recruiter, I want all candidates to be screened in a single AI call, so that screening is fast and the AI has full context of all applicants simultaneously.

#### Acceptance Criteria

1. WHEN a recruiter triggers screening, THE Screening_Service SHALL send all eligible candidates for the job in a single batch prompt to the Gemini_Client — not one call per candidate.
2. THE batch prompt SHALL include the full job context (title, seniority, domain, skills with weights and required flags, soft_skills, requirements) once, followed by a condensed profile per candidate (applicant_id, skills with level and years, experience summary, education, bio).
3. THE Gemini_Client SHALL return a structured array `candidates[]` with one entry per candidate, each containing: `applicant_id`, `skill_signals[]`, `soft_skill_signals[]`, `strengths[]`, `gaps[]`, and `recommendation`.
4. EACH `skill_signals` entry SHALL contain `skill_name` and `score` where score is `1.0` (meets/exceeds level), `0.5` (partial/lower level), or `0.0` (absent).
5. THE Gemini_Client SHALL treat semantically equivalent skill names as matches (e.g., "Node.js" = "NodeJS", "Postgres" = "PostgreSQL").
6. THE Gemini_Client SHALL be called with `temperature: 0`, `topP: 0.1`, `topK: 40` to ensure deterministic output.
7. IF the Gemini_Client returns a malformed or incomplete response, THEN THE Screening_Service SHALL assign `0.0` to all unresolved signals and log the error.

---

### Requirement 3: Deterministic Dimension Scoring

**User Story:** As a recruiter, I want scores to be consistent and reproducible, so that re-running screening on the same data always produces the same result.

#### Acceptance Criteria

1. THE Scorer SHALL compute the **skills score** as:
   `skills_score = Σ(signal.score × skill.weight) / Σ(skill.weight)` across all job skills, producing a value between 0.0 and 1.0.
2. THE Scorer SHALL compute the **experience score** as:
   `experience_score = min(candidate_total_years / min_years_required, 1.0)`, where `candidate_total_years` is the sum of durations across all `profile.experience` entries (using `end_date` or today for current roles).
3. THE Scorer SHALL compute the **education score** by mapping the candidate's highest degree to a numeric tier (`none=0.0, high_school=0.25, associate=0.5, bachelor=0.75, master=0.9, phd=1.0`) and computing `min(candidate_tier / required_tier, 1.0)` against the job's highest required education level.
4. THE Scorer SHALL compute the **resources score** as:
   `resources_score = matched_required_resources / total_required_resources`, where a resource is matched if its name appears (case-insensitive) in `profile.skills[].name` or `cvRawText`.
5. THE Scorer SHALL compute the **soft skills score** as:
   `soft_skills_score = Σ(signal.score × soft_skill.weight) / Σ(soft_skill.weight)` across all job soft skills.
6. THE Scorer SHALL compute the **final score** as:
   `final_score = (skills_score × weights.skills + experience_score × weights.experience + education_score × weights.education + resources_score × weights.resources + soft_skills_score × weights.soft_skills) × 100`, rounded to two decimal places.
7. THE Scorer SHALL round all intermediate dimension scores to six decimal places before computing the final score.
8. THE Scorer SHALL produce identical final scores when given identical inputs across multiple invocations.

---

### Requirement 4: Soft Skill Inference

**User Story:** As a recruiter, I want the system to infer soft skills from unstructured CV text, so that candidates without explicitly listed soft skills are still evaluated fairly.

#### Acceptance Criteria

1. WHEN evaluating soft skills, THE Gemini_Client SHALL receive the candidate's `cvRawText`, `profile.bio`, and the job's `soft_skills` array in a single prompt call.
2. THE Gemini_Client SHALL return a `Soft_Skill_Signal` between 0.0 and 1.0 for each soft skill in the job's `soft_skills` array, reflecting the strength of evidence found in the candidate's text.
3. IF the job's `soft_skills` array is empty, THEN THE Scorer SHALL assign a soft skills dimension score of 0.0.
4. THE Gemini_Client SHALL be called with `temperature: 0` to ensure deterministic output.
5. IF the Gemini_Client returns a malformed or incomplete response for soft skills, THEN THE Screening_Service SHALL assign `0.0` to all unresolved soft skill signals and log the error.

---

### Requirement 5: Hard Disqualification Rules

**User Story:** As a recruiter, I want candidates who fail mandatory criteria to be automatically disqualified, so that the shortlist only contains viable candidates.

#### Acceptance Criteria

1. WHEN `scoring_config.rules.required_skills_must_match` is `true`, THE Scorer SHALL set the final_score to 0 and mark the candidate as disqualified if any job skill with `required: true` has a `Skill_Match_Signal` of `0.0`.
2. WHEN `scoring_config.rules.min_experience_required` is `true`, THE Scorer SHALL set the final_score to 0 and mark the candidate as disqualified if `candidate_total_years` is strictly less than `job.requirements.experience.min_years`.
3. THE Screening_Service SHALL exclude disqualified candidates from the ranked shortlist.
4. THE Screening_Service SHALL update the `status` field of a disqualified Application to `"rejected"` in the database.
5. IF both disqualification rules are enabled and a candidate fails both, THEN THE Scorer SHALL still record a single disqualification with both failing reasons listed in the `gaps` array.

---

### Requirement 6: Screening Result Structure

**User Story:** As a recruiter, I want each screened candidate to have a detailed result record, so that I can understand why a candidate was ranked where they were.

#### Acceptance Criteria

1. THE Screening_Service SHALL produce a `Screening_Result` for every evaluated Application containing: `rank` (integer, 1-based), `final_score` (number, 0–100), `dimension_breakdown` (object with five dimension scores), `strengths` (non-empty array of strings for scores ≥ 50), `gaps` (array of strings, may be empty), and `recommendation` (string).
2. THE Screening_Service SHALL populate `strengths` with human-readable descriptions of the candidate's top-performing dimensions and matched skills.
3. THE Screening_Service SHALL populate `gaps` with human-readable descriptions of missing or under-matched skills, experience shortfalls, or education mismatches.
4. THE Screening_Service SHALL generate the `recommendation` text using the Gemini_Client, summarising the candidate's fit for the role in 2–4 sentences, based on the dimension scores and job context.
5. IF a candidate is disqualified, THEN THE Screening_Service SHALL set `rank` to `null`, `final_score` to `0`, and include the disqualification reasons in `gaps`.

---

### Requirement 7: Persistence of Screening Results

**User Story:** As a recruiter, I want screening results saved to the database, so that I can retrieve them later without re-running the AI.

#### Acceptance Criteria

1. WHEN a `Screening_Result` is produced for an Application, THE Screening_Service SHALL write the result to the `screening_result` field of the corresponding Application document in MongoDB.
2. THE Screening_Service SHALL update the `status` field of a shortlisted Application to `"shortlisted"` in the database.
3. THE Screening_Service SHALL set the `updatedAt` field of every modified Application to the current UTC timestamp.
4. IF a database write fails for a specific Application, THEN THE Screening_Service SHALL log the error and continue processing the remaining Applications without aborting the entire screening run.
5. THE Screening_Service SHALL complete all database writes before returning the response to the recruiter.

---

### Requirement 8: Ranked Shortlist Retrieval

**User Story:** As a recruiter, I want to retrieve the ranked shortlist for a job, so that I can review the top candidates at any time after screening.

#### Acceptance Criteria

1. WHEN a recruiter sends `GET /jobs/:jobId/shortlist`, THE Screening_Service SHALL return all Applications for the job that have a `screening_result` present, sorted by `screening_result.final_score` in descending order.
2. WHERE the recruiter provides a `limit` query parameter of `10` or `20`, THE Screening_Service SHALL return at most that many results; if `limit` is absent, THE Screening_Service SHALL default to `10`.
3. IF the `limit` query parameter is any value other than `10` or `20`, THEN THE Screening_Service SHALL return HTTP 400 with a descriptive validation error.
4. THE Screening_Service SHALL include the full `Screening_Result` and the applicant's `profile.first_name`, `profile.last_name`, and `profile.headline` in each shortlist entry.
5. IF no screened Applications exist for the job, THEN THE Screening_Service SHALL return HTTP 200 with an empty array.
6. IF the authenticated recruiter does not own the specified job, THEN THE Screening_Service SHALL return HTTP 403.

---

### Requirement 9: AI Prompt Documentation and Intentionality

**User Story:** As a developer, I want all AI prompts to be stored as versioned text files, so that prompt behaviour is auditable and reproducible.

#### Acceptance Criteria

1. THE Screening_Service SHALL load the skill-matching prompt from a dedicated file at `src/modules/ai/prompts/screening-skill-match.prompt.txt`.
2. THE Screening_Service SHALL load the soft-skill inference prompt from a dedicated file at `src/modules/ai/prompts/screening-soft-skills.prompt.txt`.
3. THE Screening_Service SHALL load the recommendation generation prompt from a dedicated file at `src/modules/ai/prompts/screening-recommendation.prompt.txt`.
4. WHEN a prompt file is missing at startup, THE Screening_Service SHALL throw a descriptive error and prevent the service from initialising.
5. THE Screening_Service SHALL include the job title, seniority level, and domain in every prompt call to provide role-specific context to the Gemini_Client.

---

### Requirement 10: Score Determinism Guarantee

**User Story:** As a developer, I want the scoring pipeline to be fully deterministic, so that the same inputs always produce the same ranked output regardless of when screening is run.

#### Acceptance Criteria

1. THE Gemini_Client SHALL be configured with `temperature: 0`, `topP: 0.1`, and `topK: 40` for all screening-related calls.
2. THE Scorer SHALL perform all arithmetic using fixed-precision floating-point operations and round intermediate values to six decimal places before computing the final score.
3. FOR ALL valid sets of Application and Job inputs, running the Screening_Service twice with the same inputs SHALL produce identical `final_score` values and identical `rank` orderings.
4. WHEN two candidates have equal `final_score` values, THE Screening_Service SHALL break the tie by ordering the candidate with the earlier `appliedAt` timestamp first (earlier application = higher rank).
