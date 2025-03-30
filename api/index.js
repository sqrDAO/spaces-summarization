import express from 'express';
import dotenv from 'dotenv';
import YtDlpService from '../services/yt-dlp-service.js';
import SummarizationService from '../services/summarization-service.js';
import JobsService from '../services/jobs-service.js';
import {apiKeyAuth} from '../middleware/auth.js';
import customPrompts from '../config/prompts.js';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Load environment variables
dotenv.config();

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Spaces Summarization API',
      version: '1.0.0',
      description: 'API for downloading and summarizing Twitter Spaces'
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    }
  },
  apis: ['./api/index.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON
app.use(express.json());

// Add this before your routes
app.use(express.static('public'));

// Add Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Initialize services
const jobsService = new JobsService();

const ytDlpService = new YtDlpService({
  outputDir: process.env.OUTPUT_DIR || './audios',
  jobsService: jobsService
});

// Initialize the summarization service with prompts from config
let summarizationService = null;
if (process.env.GOOGLE_API_KEY) {
  summarizationService = new SummarizationService({
    apiKey: process.env.GOOGLE_API_KEY,
    prompts: customPrompts // Pass the prompts from config
  });
} else {
  console.warn('WARNING: GOOGLE_API_KEY not set. Summarization service will not be available.');
}

// Apply authentication middleware to all API routes
app.use('/api', apiKeyAuth);

// API routes with prefix
/**
 * @swagger
 * /api/download-spaces:
 *   post:
 *     summary: Download audio from a Twitter Space
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               spacesUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully downloaded
 */
app.post('/api/download-spaces', async (req, res) => {
  try {
    const { spacesUrl } = req.body;
    
    if (!spacesUrl) {
      return res.status(400).json({ error: 'Spaces URL is required' });
    }
    
    const result = await ytDlpService.downloadAudio(spacesUrl);
    
    res.json({
      success: true,
      outputPath: result.outputPath,
      filename: result.filename,
      cached: result.cached
    });
  } catch (error) {
    console.error('Error downloading audio:', error);
    res.status(500).json({ 
      error: 'Failed to download audio',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/summarize-spaces:
 *   post:
 *     summary: Summarize a Twitter Space
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               spacesUrl:
 *                 type: string
 *               promptType:
 *                 type: string
 *               customPrompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully summarized
 */
app.post('/api/summarize-spaces', async (req, res) => {
  try {
    // Check if summarization service is available
    if (!summarizationService) {
      return res.status(503).json({ 
        error: 'Summarization service unavailable', 
        message: 'Google API Key not configured'
      });
    }

    const { spacesUrl, customPrompt } = req.body;
    
    if (!spacesUrl) {
      return res.status(400).json({ error: 'Spaces URL is required' });
    }
    
    // First ensure we have the audio file
    const downloadResult = await ytDlpService.downloadAudio(spacesUrl);
    
    // Now summarize the file
    const options = {};
    if (customPrompt) {
      options.prompt = customPrompt;
    }
    
    const summary = await summarizationService.summarizeAudio(downloadResult.outputPath, options);
    
    res.json({
      success: true,
      summary,
      audioFile: {
        path: downloadResult.outputPath,
        filename: downloadResult.filename,
        cached: downloadResult.cached
      }
    });
  } catch (error) {
    console.error('Error summarizing spaces:', error);
    res.status(500).json({ 
      error: 'Failed to summarize spaces',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/prompts:
 *   get:
 *     summary: Get available prompt templates
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of available prompts
 */
app.get('/api/prompts', (req, res) => {
  try {
    if (!summarizationService) {
      return res.status(503).json({ 
        error: 'Summarization service unavailable', 
        message: 'Google API Key not configured'
      });
    }
    
    res.json({
      success: true,
      availablePrompts: summarizationService.getAvailablePrompts()
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch prompts',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/queue-status:
 *   get:
 *     summary: Get download queue status
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Current queue statistics
 */
app.get('/api/queue-status', apiKeyAuth, (req, res) => {
  // Get download queue stats
  const stats = {
    queued: ytDlpService.downloadQueue.getStats().queued,
    running: ytDlpService.downloadQueue.getStats().running,
    total: ytDlpService.downloadQueue.getStats().total
  };
  
  // Add job stats
  const jobs = jobsService.listJobs();
  const jobStats = {
    total: jobs.length,
    queued: jobs.filter(job => job.status === 'queued').length,
    processing: jobs.filter(job => job.status === 'processing').length,
    completed: jobs.filter(job => job.status === 'completed').length,
    failed: jobs.filter(job => job.status === 'failed').length
  };
  
  res.json({
    success: true,
    stats: stats,
    jobs: jobStats
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: Service health status
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * @swagger
 * /api/async/download-spaces:
 *   post:
 *     summary: Start asynchronous download of Twitter Space audio
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               spacesUrl:
 *                 type: string
 *     responses:
 *       202:
 *         description: Download job started
 */
app.post('/api/async/download-spaces', async (req, res) => {
  try {
    const { spacesUrl } = req.body;
    
    if (!spacesUrl) {
      return res.status(400).json({ error: 'Spaces URL is required' });
    }
    
    // Start async download job
    const jobId = ytDlpService.startAsyncDownload(spacesUrl);
    
    // Return immediately with job ID
    res.status(202).json({
      success: true,
      message: 'Download job started',
      jobId
    });
  } catch (error) {
    console.error('Error starting download job:', error);
    res.status(500).json({ 
      error: 'Failed to start download job',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   get:
 *     summary: Get job status and result
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status and result
 *       404:
 *         description: Job not found
 */
app.get('/api/jobs/:jobId', apiKeyAuth, (req, res) => {
  const job = jobsService.getJob(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  res.json({
    success: true,
    job
  });
});

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: List all jobs
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of jobs
 */
app.get('/api/jobs', apiKeyAuth, (req, res) => {
  const jobs = jobsService.listJobs();
  res.json({
    success: true,
    jobs
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Service listening on port ${PORT}`);
});

export default app;