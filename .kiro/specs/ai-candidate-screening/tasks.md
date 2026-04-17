# Implementation Plan: AI Candidate Screening

## Overview

Implement the AI-powered candidate screening feature by building the screening module from scratch, extending the existing `BaseAIService` pattern, and wiring everything into the existing Express app. Tasks follow the architecture defined in the design document: types → scorer → AI service → repository → service → controller → routes.

## Tasks

- [x] 1. Define screening types and extend ApplicationJSON
  - Add `ScreeningResult`, `DimensionBreakdown`, `SkillSignal`, `SoftSkillSignal`, `AICandidate`, `BatchAIResponse`, `CandidateInput`, `ScoredCandidate`, `ShortlistEntry`, and `ApplicationUpdate` interfaces to `src/modules/screening/screening.types.ts`
  - Add the optional `screening_result?: ScreeningResult` field to `ApplicationJSON` in `src/modules/application/application.types.ts`
  - Import `ApplicantProfileJSON` and `ApplicationStatus` from their respective modules in `screening.types.ts`
  - _Requirements: 6.1, 7.1_

- [x] 2. Implement the pure scoring engine
  - [x] 2.1 Create `src/modules/screening/screening.scorer.ts` as a pure class with no I/O
    - Implement `score(job, candidate, aiResult)` as the public entry point
    - Implement `private computeSkillsScore` — weighted average of skill signals; comment explains the formula `Σ(signal.score × skill.weight) / Σ(skill.weight)`
    - Implement `private computeExperienceScore` — linear scale capped at 1.0; comment explains `min(totalYears / minYears, 1.0)` and the today-fallback for current roles
    - Implement `private computeEducationScore` — tier map (`none=0.0, high_school=0.25, associate=0.5, bachelor=0.75, master=0.9, phd=1.0`); comment explains tier comparison logic
    - Implement `private computeResourcesScore` — case-insensitive substring match against skills list and cvRawText; comment explains the ratio formula
    - Implement `private computeSoftSkillsScore` — weighted average of soft skill signals; comment mirrors skills formula
    - Implement `private applyDisqualificationRules` — checks required-skill and min-experience rules before scoring; comment explains why disqualification happens before arithmetic
    - Implement `private round(value, places)` — rounds to N decimal places (6 for intermediates, 2 for final)
    - All intermediate dimension scores rounded to 6dp; final score rounded to 2dp
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 5.1, 5.2, 5.5_

  - [ ]* 2.2 Write property test for skills score (Property 1)
    - **Property 1: Skills score is a valid weighted average**
    - **Validates: Requirements 3.1**
    - Use fast-check; generate arbitrary non-empty skill arrays with positive weights and signals in {0, 0.5, 1.0}; assert result equals `Σ(signal × weight) / Σ(weight)` and lies in [0.0, 1.0]

  - [ ]* 2.3 Write property test for experience score (Property 2)
    - **Property 2: Experience score is capped at 1.0**
    - **Validates: Requirements 3.2**
    - Generate arbitrary `totalYears ≥ 0` and `minYears > 0`; assert result equals `min(totalYears / minYears, 1.0)` and lies in [0.0, 1.0]

  - [ ]* 2.4 Write property test for education score (Property 3)
    - **Property 3: Education score respects tier ordering**
    - **Validates: Requirements 3.3**
    - Generate arbitrary candidate and required degree levels from the tier map; assert result in [0.0, 1.0] and that meeting/exceeding requirement always yields 1.0

  - [ ]* 2.5 Write property test for resources score (Property 4)
    - **Property 4: Resources score is a valid ratio**
    - **Validates: Requirements 3.4**
    - Generate arbitrary required resource lists and candidate skill/cvRawText combinations; assert result in [0.0, 1.0] and that adding an already-matched resource does not decrease the score

  - [ ]* 2.6 Write property test for soft skills score (Property 5)
    - **Property 5: Soft skills score is a valid weighted average**
    - **Validates: Requirements 3.5, 4.2**
    - Generate arbitrary non-empty soft skill arrays with weights and signals in [0.0, 1.0]; assert result equals `Σ(signal × weight) / Σ(weight)` and lies in [0.0, 1.0]

  - [ ]* 2.7 Write property test for final score determinism (Property 6)
    - **Property 6: Final score is a deterministic weighted combination**
    - **Validates: Requirements 3.6, 3.7, 3.8, 10.2, 10.3**
    - Generate arbitrary five dimension scores in [0.0, 1.0] and weights summing to 1.0; assert `final_score = round(Σ(dim × weight) × 100, 2)` lies in [0.00, 100.00] and running scorer twice with same inputs yields identical output

  - [ ]* 2.8 Write property test for required-skill disqualification (Property 7)
    - **Property 7: Required-skill disqualification is universal**
    - **Validates: Requirements 5.1**
    - Generate any candidate where at least one required skill has signal 0.0 and `required_skills_must_match = true`; assert `final_score = 0` and `new_status = "rejected"` regardless of other scores

  - [ ]* 2.9 Write property test for min-experience disqualification (Property 8)
    - **Property 8: Minimum-experience disqualification is universal**
    - **Validates: Requirements 5.2**
    - Generate any candidate where `totalYears < minYears` and `min_experience_required = true`; assert `final_score = 0` and `new_status = "rejected"` regardless of other scores

- [ ] 3. Checkpoint — Ensure all scorer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create the batch AI prompt file and ScreeningAIService
  - [x] 4.1 Create `src/modules/ai/prompts/screening-batch.prompt.txt`
    - Section 1: job context block (title, seniority, domain, skills with weights/required/level, soft skills, min experience, education requirement)
    - Section 2: per-candidate profile block (applicant_id, skills with level and years, total experience years, education, bio, first 500 chars of cvRawText)
    - Output instruction: JSON object with `candidates[]` array containing `applicant_id`, `skill_signals`, `soft_skill_signals`, `strengths`, `gaps`, `recommendation`
    - _Requirements: 2.2, 2.3, 2.4, 9.1, 9.5_

  - [x] 4.2 Create `src/modules/ai/screening.ai.service.ts` extending `BaseAIService<BatchAIResponse>`
    - Load `screening-batch.prompt.txt` at construction time using `readFileSync` (same pattern as existing services); throw descriptive error if file is missing
    - Set `modelName` and `systemPrompt` as required by `BaseAIService`
    - Implement `async batchScreen(job: JobJSON, candidates: CandidateInput[]): Promise<BatchAIResponse | null>`
    - Build the full prompt string by interpolating job context once, then appending one condensed block per candidate
    - Call `this.callAI(prompt)` — inherits `temperature: 0`, `topP: 0.1`, `topK: 40`, 20 s timeout from base class
    - Return `null` on malformed/incomplete response (base class handles this); log the error
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 9.1, 9.4, 10.1_

  - [ ]* 4.3 Write unit test for ScreeningAIService prompt construction
    - Verify the constructed prompt includes job title, seniority level, domain, and all candidate applicant_ids
    - _Requirements: 2.2, 9.5_

- [x] 5. Implement ScreeningRepository
  - Create `src/modules/screening/screening.repository.ts`
  - Implement `async findJob(jobId: string): Promise<JobJSON | null>` — fetch from jobs collection by ID
  - Implement `async findEligibleApplications(jobId: string): Promise<ApplicationWithApplicant[]>` — fetch applications with `status` in `["pending", "reviewed"]`, joined with applicant profile data via applicant lookup
  - Implement `async saveScreeningResults(results: ApplicationUpdate[]): Promise<void>` — bulk-write `screening_result` and `status` fields; set `updatedAt` to current UTC timestamp; log and continue on individual write failure (do not abort)
  - Implement `async findShortlist(jobId: string, limit: number): Promise<ShortlistEntry[]>` — fetch applications with `screening_result` present, sorted by `screening_result.final_score` descending, limited to N, including `first_name`, `last_name`, `headline` from applicant profile
  - _Requirements: 1.3, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.4_

- [x] 6. Implement ScreeningService orchestrator
  - Create `src/modules/screening/screening.service.ts`
  - Implement `async screen(jobId: string, recruiterId: string): Promise<ShortlistEntry[]>`
    - Fetch job; return HTTP 403 if not found or recruiter mismatch
    - Fetch eligible applications; return early with empty array if none found
    - Assemble `CandidateInput[]` from application + applicant data
    - Call `aiService.batchScreen(job, candidates)` exactly once; on null response default all signals to 0.0 and log
    - Loop over candidates calling `scorer.score(job, candidate, aiResult)` per candidate
    - Separate disqualified from eligible; sort eligible by `final_score DESC`, tie-break by `appliedAt ASC`; assign 1-based ranks
    - Call `repo.saveScreeningResults(...)` for all candidates (shortlisted and rejected); await completion before returning
    - Return ranked shortlist entries
  - Implement `async getShortlist(jobId: string, recruiterId: string, limit: 10 | 20): Promise<ShortlistEntry[]>`
    - Verify recruiter owns job; return HTTP 403 if not
    - Delegate to `repo.findShortlist(jobId, limit)`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 5.3, 5.4, 6.1, 7.5, 8.1, 8.6, 10.4_

  - [ ]* 6.1 Write property test for shortlist excludes disqualified candidates (Property 9)
    - **Property 9: Shortlist excludes all disqualified candidates**
    - **Validates: Requirements 5.3**
    - Generate arbitrary sets of scored candidates including some with `new_status = "rejected"`; assert none appear in the ranked shortlist

  - [ ]* 6.2 Write property test for shortlist sort order (Property 10)
    - **Property 10: Shortlist is sorted descending by final score with tie-break**
    - **Validates: Requirements 8.1, 10.4**
    - Generate arbitrary sets of scored candidates; assert shortlist is sorted by `final_score` DESC and that equal-score candidates are ordered by `appliedAt` ASC

  - [ ]* 6.3 Write property test for shortlist limit (Property 11)
    - **Property 11: Shortlist respects the limit parameter**
    - **Validates: Requirements 8.2**
    - Generate N > limit screened candidates; assert returned list has exactly `limit` entries and they are the top-`limit` by score

  - [ ]* 6.4 Write property test for batch AI call count (Property 13)
    - **Property 13: Batch AI call count is always one**
    - **Validates: Requirements 2.1**
    - For any N ≥ 1 eligible candidates, assert `batchScreen` is called exactly once per `screen()` invocation

- [ ] 7. Checkpoint — Ensure all service and repository tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement ScreeningController and routes
  - [x] 8.1 Create `src/modules/screening/screening.controller.ts`
    - Implement `async triggerScreening(req, res)` for `POST /jobs/:jobId/screen`
      - Extract `jobId` from params, `recruiterId` from `req.user`
      - Delegate to `screeningService.screen(jobId, recruiterId)`
      - Return HTTP 200 with ranked shortlist; return HTTP 200 with empty array + message if no candidates
      - Return HTTP 403 on ownership failure
    - Implement `async getShortlist(req, res)` for `GET /jobs/:jobId/shortlist?limit=10|20`
      - Validate `limit` query param — must be `10` or `20`; return HTTP 400 with descriptive message if invalid or absent (default to 10 if absent)
      - Delegate to `screeningService.getShortlist(jobId, recruiterId, limit)`
      - Return HTTP 200 with shortlist array; return HTTP 403 on ownership failure
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 8.2, 8.3, 8.5, 8.6_

  - [x] 8.2 Create `src/modules/screening/screening.routes.ts`
    - Register `POST /jobs/:jobId/screen` → `triggerScreening` with auth middleware
    - Register `GET /jobs/:jobId/shortlist` → `getShortlist` with auth middleware
    - Export router and mount it in the main app entry point (`src/index.ts`)
    - _Requirements: 1.1, 8.1_

  - [ ]* 8.3 Write unit tests for ScreeningController
    - Test HTTP 400 for `limit` values other than 10 or 20
    - Test HTTP 403 when recruiter does not own the job
    - Test HTTP 200 with empty array when no candidates found
    - _Requirements: 1.2, 1.4, 8.3, 8.5, 8.6_

  - [ ]* 8.4 Write property test for shortlist entry shape (Property 12)
    - **Property 12: Every shortlist entry contains required fields**
    - **Validates: Requirements 6.1, 8.4**
    - For any shortlist entry returned by the service, assert it contains `screening_result` (with all five dimension scores, `final_score`, `rank`, `strengths`, `gaps`, `recommendation`) and `first_name`, `last_name`, `headline`

- [x] 9. Final checkpoint — Wire everything together and ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use fast-check with a minimum of 100 iterations per property
- Each property test file should include the tag comment: `// Feature: ai-candidate-screening, Property N: <property text>`
- The scorer (`screening.scorer.ts`) must remain a pure class — no imports of DB clients, HTTP clients, or file system utilities
- All AI prompt files must be loaded at service construction time (fail-fast pattern matching existing services)
- `BaseAIService` already enforces `temperature: 0`, `topP: 0.1`, `topK: 40`, and 20 s timeout — no need to override in `ScreeningAIService`
