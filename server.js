const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Google Cloud Storage backend is running',
    timestamp: new Date().toISOString(),
    environment: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? 'configured' : 'missing',
      bucket: process.env.GOOGLE_CLOUD_BUCKET ? 'configured' : 'missing',
      credentials: process.env.GOOGLE_CLOUD_CREDENTIALS ? 'configured' : 'missing'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Glint Google Cloud Storage Backend',
    version: '1.0.0',
    endpoints: ['/health', '/upload/signed-url', '/videos']
  });
});

app.listen(port, () => {
  console.log(`🚀 Google Cloud Storage backend running on port ${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
});
