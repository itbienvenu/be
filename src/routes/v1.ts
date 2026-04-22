/**
 * API v1 Router
 *
 * All v1 routes are assembled here and mounted under /api/v1 in index.ts.
 */

import { Router } from "express";
import JobRoutes from "@/modules/job/job.routes.js";
import AuthRoutes from "@/modules/auth/auth.routes.js";
import ApplicantRoutes from "@/modules/applicant/applicant.routes.js";
import RecruiterRoutes from "@/modules/recruiter/recruiter.routes.js";
import ApplicationRoutes from "@/modules/application/application.routes.js";
import ScreeningRoutes from "@/modules/screening/screening.routes.js";
import SourcingRoutes from "@/modules/sourcing/sourcing.routes.js";

const v1 = Router();

const jobRoutes         = new JobRoutes();
const authRoutes        = new AuthRoutes();
const applicantRoutes   = new ApplicantRoutes();
const recruiterRoutes   = new RecruiterRoutes();
const applicationRoutes = new ApplicationRoutes();
const screeningRoutes   = new ScreeningRoutes();
const sourcingRoutes    = new SourcingRoutes();

v1.use("/auth",         authRoutes.router);
v1.use("/jobs",         jobRoutes.router);
v1.use("/applicants",   applicantRoutes.router);
v1.use("/recruiters",   recruiterRoutes.router);
v1.use("/applications", applicationRoutes.router);
v1.use("/sourcing",     sourcingRoutes.router);

// Screening is nested under /jobs/:jobId — mergeParams handles the param inheritance
v1.use("/jobs/:jobId",  screeningRoutes.router);

export default v1;
