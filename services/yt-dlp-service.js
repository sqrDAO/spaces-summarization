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
      this._downloadAudio(task.spacesLink, task.jobId)
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
   * @param {string} [jobId] - Optional job ID for progress tracking
   * @returns {Promise<Object>} - Result object with file path and cache status
   * @private
   */
  async _downloadAudio(spacesLink, jobId) {
    // Double-check cache (in case another request downloaded it while waiting in queue)
    const cachedFilePath = this.getCachedFile(spacesLink);
    if (cachedFilePath) {
      // Log to job if we have job ID and jobsService
      if (jobId && this.jobsService) {
        this.jobsService.addJobLog(jobId, 
          `Found cached file: ${path.basename(cachedFilePath)}`, 'info');
      }
      
      return {
        outputPath: cachedFilePath,
        cached: true,
        filename: path.basename(cachedFilePath)
      };
    }

    // Generate filename from hash
    const fileHash = this.generateHashFromLink(spacesLink);
    const outputPath = path.join(this.outputDir, `${fileHash}.mp3`);
    
    // Log to job if we have job ID and jobsService
    if (jobId && this.jobsService) {
      this.jobsService.addJobLog(jobId, 
        `Downloading to: ${path.basename(outputPath)}`, 'info');
    }
    
    // Download the file
    await this.executeDownload(spacesLink, outputPath, jobId);
    
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
   * @param {string} [jobId] - Optional job ID for logging
   * @returns {Promise<void>}
   */
  executeDownload(spacesLink, outputPath, jobId) {
    return new Promise((resolve, reject) => {
      console.log(`Downloading from: ${spacesLink}`);
      console.log(`Output file: ${path.basename(outputPath)}`);
      
      // Log to job if we have job ID and jobsService
      if (jobId && this.jobsService) {
        this.jobsService.addJobLog(jobId, `Starting download from: ${spacesLink}`, 'info');
        this.jobsService.addJobLog(jobId, `Output file: ${path.basename(outputPath)}`, 'info');
      }
      
      // Use spawn with progress flags but capture output
      const processYtd = spawn(this.ytDlpPath, [
        '-i',
        '--progress',
        '--progress-delta','60',
        '--newline',
        '--quiet',           // Very quiet, only show errors
        '--no-warnings',     // Reduces non-essential output
        '-N','3',      // Number of parallel connections to download
        '--console-title',   // Updates terminal title with progress
        spacesLink,
        '-o', outputPath
      ], { stdio: ['ignore', 'pipe', 'pipe'] }); // Capture output instead of inheriting
      
      // Handle stdout for yt-dlp progress output
      processYtd.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[yt-dlp] ${output}`);
          
          // Log to job if we have job ID and jobsService
          if (jobId && this.jobsService) {
            this.jobsService.addJobLog(jobId, output, 'info');
          }
        }
      });
      
      // Handle stderr for error output
      processYtd.stderr.on('data', (data) => {
        const error = data.toString().trim();
        if (error) {
          console.error(`[yt-dlp error] ${error}`);
          
          // Log to job if we have job ID and jobsService
          if (jobId && this.jobsService) {
            this.jobsService.addJobLog(jobId, error, 'error');
          }
        }
      });
      
      // Track the partial file size
      const partialFile = `${outputPath}.part`;
      let lastLoggedSize = 0;
      const logThreshold = 100 * 1024 * 1024; // 100MB
      
      // Set up simple interval to check file size
      const checkInterval = setInterval(() => {
        if (fs.existsSync(partialFile)) {
          try {
            const stats = fs.statSync(partialFile);
            const currentSize = stats.size;
            
            // Log progress every 100MB
            if (currentSize - lastLoggedSize >= logThreshold) {
              const mbDownloaded = Math.floor(currentSize / (1024 * 1024));
              const message = `📥 Downloaded ${mbDownloaded} MB so far...`;
              console.log(message);
              lastLoggedSize = currentSize;
              
              // Log to job if we have job ID and jobsService
              if (jobId && this.jobsService) {
                this.jobsService.addJobLog(jobId, message, 'progress', {
                  bytes: currentSize,
                  megabytes: mbDownloaded
                });
              }
            }
          } catch (err) {
            // Ignore errors reading the file
            console.error(`Error reading partial file: ${err.message}`);
            
            // Log to job if we have job ID and jobsService
            if (jobId && this.jobsService) {
              this.jobsService.addJobLog(jobId, 
                `Error reading partial file: ${err.message}`, 'error');
            }
          }
        }
      }, 1000); // Check every second
      
      // Handle process completion
      processYtd.on('close', (code) => {
        // Stop the progress interval
        clearInterval(checkInterval);
        
        // Clear the progress line
        process.stdout.write('\r\x1b[K');
        
        if (code === 0) {
          // Log final file size
          if (fs.existsSync(outputPath)) {
            try {
              const stats = fs.statSync(outputPath);
              const mbDownloaded = Math.floor(stats.size / (1024 * 1024));
              const message = `✅ Download completed: ${path.basename(outputPath)} (${mbDownloaded} MB)`;
              console.log(message);
              
              // Log to job if we have job ID and jobsService
              if (jobId && this.jobsService) {
                this.jobsService.addJobLog(jobId, message, 'success', {
                  bytes: stats.size,
                  megabytes: mbDownloaded
                });
              }
            } catch (err) {
              const message = `✅ Download completed: ${path.basename(outputPath)}`;
              console.log(message);
              
              // Log to job if we have job ID and jobsService
              if (jobId && this.jobsService) {
                this.jobsService.addJobLog(jobId, message, 'success');
              }
            }
            resolve();
          } else {
            const errorMessage = 'Download failed: Output file not found';
            console.error(errorMessage);
            
            // Log to job if we have job ID and jobsService
            if (jobId && this.jobsService) {
              this.jobsService.addJobLog(jobId, errorMessage, 'error');
            }
            
            reject(new Error(errorMessage));
          }
        } else {
          const errorMessage = `❌ Download failed with exit code ${code}`;
          console.error(errorMessage);
          
          // Log to job if we have job ID and jobsService
          if (jobId && this.jobsService) {
            this.jobsService.addJobLog(jobId, errorMessage, 'error');
          }
          
          reject(new Error(`yt-dlp process exited with code ${code}`));
        }
      });
      
      // Handle process errors
      processYtd.on('error', (error) => {
        // Stop the progress interval
        clearInterval(checkInterval);
        
        const errorMessage = `Error executing yt-dlp: ${error.message}`;
        console.error(errorMessage);
        
        // Log to job if we have job ID and jobsService
        if (jobId && this.jobsService) {
          this.jobsService.addJobLog(jobId, errorMessage, 'error');
        }
        
        reject(error);
      });
    });
  }
}

export default YtDlpService;
