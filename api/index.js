import express from 'express';
import YtDlpService from '../services/yt-dlp-service.js';
import SummarizationService from '../services/summarization-service.js';
import dotenv from 'dotenv';
import path from 'path';
import customPrompts from '../config/prompts.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON
app.use(express.json());

// Configure services
const ytDlpService = new YtDlpService({
  outputDir: process.env.OUTPUT_DIR || './audios'
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

// Download Spaces endpoint
app.post('/download-spaces', async (req, res) => {
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

// Summarize audio endpoint
app.post('/summarize-spaces', async (req, res) => {
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

// Reload prompts endpoint
app.post('/reload-prompts', async (req, res) => {
  try {
    if (!summarizationService) {
      return res.status(503).json({ 
        error: 'Summarization service unavailable', 
        message: 'Google API Key not configured'
      });
    }
    
    // Clear module cache to force reload
    delete require.cache[require.resolve('../config/prompts.js')];
    
    // Re-import the prompts
    const freshPrompts = (await import('../config/prompts.js?t=' + Date.now())).default;
    
    // Update the service
    summarizationService.prompts = freshPrompts;
    
    res.json({
      success: true,
      message: 'Prompts reloaded successfully',
      availablePrompts: summarizationService.getAvailablePrompts()
    });
  } catch (error) {
    console.error('Error reloading prompts:', error);
    res.status(500).json({ 
      error: 'Failed to reload prompts',
      message: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Service listening on port ${PORT}`);
});

export default app;