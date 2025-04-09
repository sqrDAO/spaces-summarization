import { Router } from 'express';
import { apiKeyAuth } from '../middleware/auth.js';
import fs from 'fs';  // Correct import statement
import { execSync } from 'child_process';  // Also import execSync directly

export default function createRoutes(services) {
  const router = Router();
  const { ytDlpService, fileUploadService, summarizationService, jobsService } = services;

  // Apply authentication middleware
  router.use(apiKeyAuth);

  // =====================================================================
  // DOWNLOAD ROUTES
  // =====================================================================

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
  router.post('/download-spaces', async (req, res) => {
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
  router.post('/async/download-spaces', async (req, res) => {
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
   * /api/queue-status:
   *   get:
   *     summary: Get download queue status
   *     security:
   *       - ApiKeyAuth: []
   *     responses:
   *       200:
   *         description: Current queue statistics
   */
  router.get('/queue-status', (req, res) => {
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

  // =====================================================================
  // SUMMARIZATION ROUTES
  // =====================================================================

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
  router.post('/summarize-spaces', async (req, res) => {
    try {
      if (!fileUploadService || !summarizationService) {
        return res.status(503).json({ 
          error: 'Summarization service unavailable', 
          message: 'Google API Key not configured'
        });
      }

      const { spacesUrl, promptType, customPrompt } = req.body;
      
      if (!spacesUrl) {
        return res.status(400).json({ error: 'Spaces URL is required' });
      }
      
      // First download the audio file
      const downloadResult = await ytDlpService.downloadAudio(spacesUrl);
      console.log(`Download completed: ${downloadResult.filename}`);
      
      // Then upload the file to Google's API
      const uploadedFile = await fileUploadService.uploadFile(downloadResult.outputPath);
      console.log(`File uploaded with URI: ${uploadedFile.uri}`);
      
      // Prepare options
      const options = {};
      if (promptType) options.promptType = promptType;
      if (customPrompt) options.customPrompt = customPrompt;
      
      // Generate the summary
      const summary = await summarizationService.summarizeFile(uploadedFile, options);
      
      // Return the result
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
      console.error('Error summarizing audio:', error);
      res.status(500).json({ 
        error: 'Failed to summarize audio',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/async/summarize-spaces:
   *   post:
   *     summary: Start asynchronous summarization of Twitter Space audio
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
   *       202:
   *         description: Summarization job started
   */
  router.post('/async/summarize-spaces', async (req, res) => {
    try {
      if (!fileUploadService || !summarizationService) {
        return res.status(503).json({ 
          error: 'Summarization service unavailable', 
          message: 'Google API Key not configured'
        });
      }

      const { spacesUrl, promptType, customPrompt } = req.body;
      
      if (!spacesUrl) {
        return res.status(400).json({ error: 'Spaces URL is required' });
      }
      
      // Create a job for this summarization request
      const jobId = jobsService.createJob('summarize', { spacesUrl, promptType, customPrompt });
      
      // Start the process in the background
      (async () => {
        try {
          // Update job status to downloading
          jobsService.updateJob(jobId, 'downloading');
          
          // Step 1: Download the audio
          const downloadResult = await ytDlpService.downloadAudio(spacesUrl);
          
          // Update job status to uploading
          jobsService.updateJob(jobId, 'uploading', { 
            result: { audioFile: downloadResult } 
          });
          
          // Step 2: Upload the file to Google's API
          const uploadedFile = await fileUploadService.uploadFile(downloadResult.outputPath);
          
          // Update job status to summarizing
          jobsService.updateJob(jobId, 'summarizing');
          
          // Prepare options
          const options = {};
          if (promptType) options.promptType = promptType;
          if (customPrompt) options.customPrompt = customPrompt;
          
          // Step 3: Generate the summary
          const summary = await summarizationService.summarizeFile(uploadedFile, options);
          
          // Update job status to completed
          jobsService.updateJob(jobId, 'completed', { 
            result: { 
              summary,
              audioFile: downloadResult,
              uploadedFile: {
                uri: uploadedFile.uri,
                fileName: uploadedFile.fileName
              } 
            } 
          });
        } catch (error) {
          console.error(`Job ${jobId} failed:`, error);
          jobsService.updateJob(jobId, 'failed', { error: error.message });
        }
      })().catch(console.error);
      
      // Return immediately with job ID
      res.status(202).json({
        success: true,
        message: 'Summarization job started',
        jobId
      });
    } catch (error) {
      console.error('Error starting summarization job:', error);
      res.status(500).json({ 
        error: 'Failed to start summarization job',
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
  router.get('/prompts', (req, res) => {
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
   * /api/upload-audio:
   *   post:
   *     summary: Upload an audio file to Google AI
   *     security:
   *       - ApiKeyAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               filePath:
   *                 type: string
   *     responses:
   *       200:
   *         description: File uploaded successfully
   */
  router.post('/upload-audio', async (req, res) => {
    try {
      if (!fileUploadService) {
        return res.status(503).json({ 
          error: 'Upload service unavailable', 
          message: 'Google API Key not configured'
        });
      }

      const { filePath } = req.body;
      
      if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
      }
      
      // Check if file exists
      if (!fileUploadService.fileExists(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Upload the file
      const uploadedFile = await fileUploadService.uploadFile(filePath);
      
      res.json({
        success: true,
        uploadedFile: {
          uri: uploadedFile.uri,
          fileName: uploadedFile.fileName,
          originalPath: uploadedFile.originalPath
        }
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ 
        error: 'Failed to upload file',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/summarize-uploaded:
   *   post:
   *     summary: Summarize an already uploaded file
   *     security:
   *       - ApiKeyAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               fileUri:
   *                 type: string
   *               mimeType:
   *                 type: string
   *               promptType:
   *                 type: string
   *               customPrompt:
   *                 type: string
   *     responses:
   *       200:
   *         description: Successfully summarized
   */
  router.post('/summarize-uploaded', async (req, res) => {
    try {
      if (!summarizationService) {
        return res.status(503).json({ 
          error: 'Summarization service unavailable', 
          message: 'Google API Key not configured'
        });
      }

      const { fileUri, mimeType, promptType, customPrompt } = req.body;
      
      if (!fileUri) {
        return res.status(400).json({ error: 'File URI is required' });
      }
      
      // Prepare file info
      const fileInfo = {
        uri: fileUri,
        mimeType: mimeType || 'audio/mp3'
      };
      
      // Prepare options
      const options = {};
      if (promptType) options.promptType = promptType;
      if (customPrompt) options.customPrompt = customPrompt;
      
      // Generate the summary
      const summary = await summarizationService.summarizeFile(fileInfo, options);
      
      res.json({
        success: true,
        summary
      });
    } catch (error) {
      console.error('Error summarizing file:', error);
      res.status(500).json({ 
        error: 'Failed to summarize file',
        message: error.message
      });
    }
  });

  // =====================================================================
  // JOBS ROUTES
  // =====================================================================

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
  router.get('/jobs/:jobId', (req, res) => {
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
  router.get('/jobs', (req, res) => {
    const jobs = jobsService.listJobs();
    res.json({
      success: true,
      jobs
    });
  });

  /**
   * @swagger
   * /api/jobs/{id}/logs/raw:
   *   get:
   *     summary: Get raw log file for a job
   *     security:
   *       - ApiKeyAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Raw job log file
   */
  router.get('/jobs/:id/logs/raw', (req, res) => {
    const { id } = req.params;
    const rawLog = jobsService.getRawJobLog(id);
    
    if (!rawLog) {
      return res.status(404).send('Log file not found');
    }
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(rawLog);
  });

  /**
   * @swagger
   * /api/jobs/{id}/logs/tail/{lines}:
   *   get:
   *     summary: Get the last N lines of a job log
   *     security:
   *       - ApiKeyAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: lines
   *         required: true
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: Last N lines of the job log
   */
  router.get('/jobs/:id/logs/tail/:lines', (req, res) => {
    const { id, lines } = req.params;
    const logPath = jobsService.getJobLogPath(id);
    
    if (!fs.existsSync(logPath)) {
      return res.status(404).send('Log file not found');
    }
    
    try {
      // Use shell command to get the last N lines
      const numLines = parseInt(lines, 10) || 20;
      //const tail = require('child_process').execSync(`tail -n ${numLines} "${logPath}"`, { encoding: 'utf8' });
      const tail = execSync(`tail -n ${numLines} "${logPath}"`, { encoding: 'utf8' });

      res.setHeader('Content-Type', 'text/plain');
      res.send(tail);
    } catch (error) {
      console.error(`Error reading tail of log for job ${id}:`, error);
      res.status(500).send(`Error reading log: ${error.message}`);
    }
  });

  return router;
}