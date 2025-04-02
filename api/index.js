import express from 'express';
import dotenv from 'dotenv';
import YtDlpService from '../services/yt-dlp-service.js';
import SummarizationService from '../services/summarization-service.js';
import FileUploadService from '../services/file-upload-service.js';
import JobsService from '../services/jobs-service.js';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import createRoutes from './routes.js';
import { errorHandler } from '../middleware/error-handler.js';
import customPrompts from '../config/prompts.js'; 

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
  apis: ['./api/routes.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Initialize services
const services = {
  jobsService: new JobsService(),
  ytDlpService: null,
  fileUploadService: null,
  summarizationService: null
};

// Initialize YtDlpService with JobsService
services.ytDlpService = new YtDlpService({
  outputDir: process.env.OUTPUT_DIR || './audios',
  jobsService: services.jobsService
});

// Initialize Google API services if API key is available
if (process.env.GOOGLE_API_KEY) {
  services.fileUploadService = new FileUploadService({
    apiKey: process.env.GOOGLE_API_KEY
  });
  
  services.summarizationService = new SummarizationService({
    apiKey: process.env.GOOGLE_API_KEY,
    prompts: customPrompts
  });
} else {
  console.warn('WARNING: GOOGLE_API_KEY not set. File upload and summarization services will not be available.');
}

// Setup API routes
app.use('/api', createRoutes(services));

// Health check endpoint
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

// Error handling middleware
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Service listening on port ${PORT}`);
});

export default app;