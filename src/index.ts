import express from 'express';
import JobRoutes from "./modules/job/job.routes.js";
import AuthRoutes from "./modules/auth/auth.routes.js";
import ApplicantRoutes from "./modules/applicant/applicant.routes.js";
import RecruiterRoutes from "./modules/recruiter/recruiter.routes.js";
import ApplicationRoutes from "./modules/application/application.routes.js";

const app = express();
app.use(express.json());
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

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

