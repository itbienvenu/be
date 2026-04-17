import express, { type Request, type Response, type NextFunction } from 'express';
import JobRoutes from "./modules/job/job.routes.js";
import AuthRoutes from "./modules/auth/auth.routes.js";
import ApplicantRoutes from "./modules/applicant/applicant.routes.js";
import RecruiterRoutes from "./modules/recruiter/recruiter.routes.js";
import ApplicationRoutes from "./modules/application/application.routes.js";
import { requestLogger } from './shared/middleware/request-logger.middleware.js';
import logger from './shared/utils/logger.js';

const app = express();
app.use(express.json());
app.use(requestLogger);

const port = 3001;

const jobRoutes = new JobRoutes();
const authRoutes = new AuthRoutes();
const applicantRoutes = new ApplicantRoutes();
const recruiterRoutes = new RecruiterRoutes();
const applicationRoutes = new ApplicationRoutes();

app.use("/jobs", jobRoutes.router);
app.use("/auth", authRoutes.router);
app.use("/applicants", applicantRoutes.router);
app.use("/recruiters", recruiterRoutes.router);
app.use("/applications", applicationRoutes.router);


app.get('/', (req, res) => {
  res.json({ message: 'Hello from your TypeScript backend!' });
});

app.get('/health', (req, res) => {
  res.send('OK');
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message || 'Internal Server Error', { stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(port, () => {
  logger.info(`Server is running at http://localhost:${port}`);
});


