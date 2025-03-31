import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Queue from 'better-queue';

class YtDlpService {
  constructor(config = {}) {
    this.outputDir = config.outputDir || './audios';
    this.ytDlpPath = config.ytDlpPath || 'yt-dlp';
    this.jobsService = config.jobsService;
    
    // Create a download queue
    this.downloadQueue = new Queue((task, cb) => {
      // Call our internal download method
      this._downloadAudio(task.spacesLink)
        .then(result => {
          // Update job status if this is async job
          if (task.jobId && this.jobsService) {
            this.jobsService.updateJob(task.jobId, 'completed', { result });
          }
          cb(null, result);
        })
        .catch(err => {
          // Update job status if this is async job
          if (task.jobId && this.jobsService) {
            this.jobsService.updateJob(task.jobId, 'failed', { error: err.message });
          }
          cb(err);
        });
    }, { 
      concurrent: 2,  // Process 2 downloads at once
      maxRetries: 2,
      retryDelay: 2000
    });

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
  
  /**
   * Start an asynchronous download job
   * @param {string} spacesLink - URL of the Twitter Space
   * @returns {string} - Job ID for tracking status
   */
  startAsyncDownload(spacesLink) {
    if (!spacesLink) {
      throw new Error('Spaces link is required');
    }
    
    if (!this.jobsService) {
      throw new Error('JobsService not configured');
    }
    
    // Check for cached file for immediate response
    const cachedFilePath = this.getCachedFile(spacesLink);
    if (cachedFilePath) {
      // Create and immediately complete job
      const jobId = this.jobsService.createJob('download', { spacesLink });
      this.jobsService.updateJob(jobId, 'completed', {
        result: {
          outputPath: cachedFilePath,
          cached: true,
          filename: path.basename(cachedFilePath)
        }
      });
      return jobId;
    }
    
    // Create new job and add to queue
    const jobId = this.jobsService.createJob('download', { spacesLink });
    
    // Add to download queue with job ID
    this.jobsService.updateJob(jobId, 'processing');
    this.downloadQueue.push({ spacesLink, jobId });
    
    return jobId;
  }

  /**
   * Generate a hash from the spaces link for use as filename
   * @param {string} spacesLink - URL of the Twitter Spaces
   * @returns {string} - MD5 hash of the link
   */
  generateHashFromLink(spacesLink) {
    return crypto.createHash('md5').update(spacesLink).digest('hex');
  }

  /**
   * Check if a spaces link has already been downloaded
   * @param {string} spacesLink - URL of the Twitter Spaces
   * @returns {string|null} - Path to the cached file or null if not found
   */
  getCachedFile(spacesLink) {
    const fileHash = this.generateHashFromLink(spacesLink);
    const filePath = path.join(this.outputDir, `${fileHash}.mp3`);
    
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    
    return null;
  }

  /**
   * Public method: Add a download request to the queue
   * This maintains the original synchronous API
   * @param {string} spacesLink - URL of the Twitter Spaces
   * @returns {Promise<Object>} - Result object with file path and cache status
   */
  async downloadAudio(spacesLink) {
    if (!spacesLink) {
      throw new Error('Spaces link is required');
    }

    // Check if we already have this file downloaded
    const cachedFilePath = this.getCachedFile(spacesLink);
    if (cachedFilePath) {
      return {
        outputPath: cachedFilePath,
        cached: true,
        filename: path.basename(cachedFilePath)
      };
    }

    // Not cached - add to queue and return a promise
    return new Promise((resolve, reject) => {
      this.downloadQueue.push({
        spacesLink: spacesLink
      }, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  /**
   * Internal method: Actual download logic (called by the queue)
   * @param {string} spacesLink - URL of the Twitter Spaces
   * @returns {Promise<Object>} - Result object with file path and cache status
   * @private
   */
  async _downloadAudio(spacesLink) {
    // Double-check cache (in case another request downloaded it while waiting in queue)
    const cachedFilePath = this.getCachedFile(spacesLink);
    if (cachedFilePath) {
      return {
        outputPath: cachedFilePath,
        cached: true,
        filename: path.basename(cachedFilePath)
      };
    }

    // Generate filename from hash
    const fileHash = this.generateHashFromLink(spacesLink);
    const outputPath = path.join(this.outputDir, `${fileHash}.mp3`);
    
    // Download the file
    await this.executeDownload(spacesLink, outputPath);
    
    return {
      outputPath,
      cached: false,
      filename: path.basename(outputPath)
    };
  }

  /**
   * Execute the yt-dlp command to download the audio
   * @param {string} spacesLink - URL of the Twitter Spaces
   * @param {string} outputPath - Full path where the file will be saved
   * @returns {Promise<void>}
   */
  executeDownload(spacesLink, outputPath) {
    return new Promise((resolve, reject) => {
      console.log(`Downloading from: ${spacesLink}`);
      console.log(`Output file: ${path.basename(outputPath)}`);
      
      // Use spawn with progress flags but capture output
      const processYtd = spawn(this.ytDlpPath, [
        '-i',
        '--progress',
        '--newline',
        '--quiet',           // Very quiet, only show errors
        '--no-warnings',     // Reduces non-essential output
        '--console-title',   // Updates terminal title with progress
        spacesLink,
        '-o', outputPath
      ], { stdio: ['pipe', 'pipe', 'pipe'] }); // Capture output instead of inheriting
      
      // Track the last progress line
      let lastProgressLine = '';
      
      // Extract and display only the progress percentage
      processYtd.stdout.on('data', (data) => {
        const output = data.toString();
        // Look for lines with download progress indicators
        const lines = output.split('\n');
        for (const line of lines) {
          // Filter for progress lines (they contain %)
          if (line.includes('%')) {
            // Extract just the percentage if possible
            const percentMatch = line.match(/(\d+\.?\d*)%/);
            if (percentMatch) {
              const percent = percentMatch[1];
              // Create a simple progress bar
              const barLength = 30;
              const completedLength = Math.round(barLength * (parseFloat(percent) / 100));
              const bar = '█'.repeat(completedLength) + '░'.repeat(barLength - completedLength);
              processYtd.stdout.write(`\r\x1b[K[${bar}] ${percent}%`);
            } else {
              // Fall back to the whole line if we can't extract percentage
              processYtd.stdout.write('\r\x1b[K' + line.trim());
            }
            lastProgressLine = line.trim();
          }
        }
      });
      
      // Improve error filtering - suppress all common FFmpeg/HLS errors
      processYtd.stderr.on('data', (data) => {
        // In most cases, we want to suppress these errors as they're just informational
        // or related to the HLS stream details, not actual failures
        const error = data.toString().trim();
        
        // Only show critical errors - exclude warnings and common HLS info
        const isCommonNonError = error.includes('WARNING:') || 
                                error.includes('Metadata:') || 
                                error.includes('variant_bitrate') ||
                                error.includes('Stream #') ||
                                error.includes('Duration:') ||
                                error.includes('Press [q]') ||
                                error.includes('Opening ');
        
        if (error && !isCommonNonError && !error.startsWith('Error: ')) {
          console.error(`Error: ${error}`);
        }
      });
  
      // Handle stdin error on both parent and child processes
      processYtd.stdin.on("error", (error) => console.error(error));
      process.stdin.on("error", (error) => console.error(error));
      
      // Handle process completion
      processYtd.on('close', (code) => {
        // Clear the progress line
        processYtd.stdout.write('\r\x1b[K');
        
        if (code === 0) {
          console.log(`✅ Download completed: ${path.basename(outputPath)}`);
          if (fs.existsSync(outputPath)) {
            resolve();
          } else {
            reject(new Error('Download failed: Output file not found'));
          }
        } else {
          console.error(`❌ Download failed with exit code ${code}`);
          reject(new Error(`yt-dlp process exited with code ${code}`));
        }
      });
      
      // Handle process errors
      processYtd.on('error', (error) => {
        console.error(`Error executing yt-dlp: ${error.message}`);
        reject(error);
      });
    });
  }
}

export default YtDlpService;
