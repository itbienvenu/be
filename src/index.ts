import express from 'express';

const app = express();
const port = 3001;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from your TypeScript backend!' });
});

app.get('/health', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
