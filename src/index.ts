import express from 'express';
import JobRoutes from "./modules/job/job.routes.js";


const app = express();
app.use(express.json());
const port = 3001;

const jobRoutes = new JobRoutes();



app.use("/jobs", jobRoutes.router);

app.get('/', (req, res) => {
  res.json({ message: 'Hello from your TypeScript backend!' });
});

app.get('/health', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

