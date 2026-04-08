import express from 'express';
import JobRoutes from "./modules/job/job.routes.js";
import AuthRoutes from "./modules/auth/auth.routes.js";
import CandidateRoutes from "./modules/candidate/candidate.routes.js";

const app = express();
app.use(express.json());
const port = 3001;

const jobRoutes = new JobRoutes();
const candidateRoutes = new CandidateRoutes();
const authRoutes = new AuthRoutes();

app.use("/jobs", jobRoutes.router);
app.use("/candidates", candidateRoutes.router);
app.use("/auth", authRoutes.router);


app.get('/', (req, res) => {
  res.json({ message: 'Hello from your TypeScript backend!' });
});

app.get('/health', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

