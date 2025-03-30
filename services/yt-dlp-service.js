import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

class YtDlpService {
  constructor(config = {}) {
    this.outputDir = config.outputDir || './audios';
    this.ytDlpPath = config.ytDlpPath || 'yt-dlp';

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
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
   * Download audio from a Twitter Spaces link
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
      const process = spawn(this.ytDlpPath, [
        '-i',
        '--progress',
        '--newline',
        '--quiet',           // Very quiet, only show errors
        '--no-warnings',     // Reduces non-essential output
        '--console-title',   // Updates terminal title with progress
        spacesLink,
        '-o', outputPath
      ], { stdio: ['ignore', 'pipe', 'pipe'] }); // Capture output instead of inheriting
      
      // Track the last progress line
      let lastProgressLine = '';
      
      // Extract and display only the progress percentage
      process.stdout.on('data', (data) => {
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
              process.stdout.write(`\r\x1b[K[${bar}] ${percent}%`);
            } else {
              // Fall back to the whole line if we can't extract percentage
              process.stdout.write('\r\x1b[K' + line.trim());
            }
            lastProgressLine = line.trim();
          }
        }
      });
      
      // Improve error filtering - suppress all common FFmpeg/HLS errors
      process.stderr.on('data', (data) => {
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
      
      // Handle process completion
      process.on('close', (code) => {
        // Clear the progress line
        process.stdout.write('\r\x1b[K');
        
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
      process.on('error', (error) => {
        console.error(`Error executing yt-dlp: ${error.message}`);
        reject(error);
      });
    });
  }
}

export default YtDlpService;