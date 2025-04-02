import { GoogleGenAI } from "@google/genai";
import fs from "fs";

class FileUploadService {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    if (!this.apiKey) {
      throw new Error("Google API Key is required");
    }
    
    // Initialize the Gemini API client
    this.genAI = new GoogleGenAI(this.apiKey);
  }

  /**
   * Upload an audio file to Google AI
   * @param {string} audioFilePath - Path to the audio file
   * @returns {Promise<Object>} - The uploaded file object with URI
   */
  async uploadFile(audioFilePath) {
    // Validate file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }
    
    console.log(`Uploading file ${audioFilePath}...`);
    
    try {
      // Upload the file
      const file = await this.genAI.files.upload({
        file: audioFilePath,
        config: { mimeType: "audio/mp3" },
      });
      
      console.log(`File uploaded successfully with URI: ${file.uri}`);
      
      return {
        uri: file.uri,
        mimeType: "audio/mp3",
        originalPath: audioFilePath,
        fileName: audioFilePath.split('/').pop()
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }
  
  /**
   * Check if a file exists at the given path
   * @param {string} filePath - Path to the file
   * @returns {boolean} - Whether the file exists
   */
  fileExists(filePath) {
    return fs.existsSync(filePath);
  }
}

export default FileUploadService;