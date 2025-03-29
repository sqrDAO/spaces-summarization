import { exec } from 'child_process';
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
      const command = `${this.ytDlpPath} -i "${spacesLink}" -o "${outputPath}"`;
      
      console.log(`Executing: ${command}`);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error downloading: ${error.message}`);
          console.error(`stderr: ${stderr}`);
          return reject(error);
        }
        
        console.log(`Download completed: ${outputPath}`);
        console.log(`stdout: ${stdout}`);
        
        if (fs.existsSync(outputPath)) {
          resolve();
        } else {
          reject(new Error('Download failed: Output file not found'));
        }
      });
    });
  }
}

export default YtDlpService;