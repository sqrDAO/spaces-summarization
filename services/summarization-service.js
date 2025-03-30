import { GoogleGenAI} from "@google/genai";
import fs from "fs";
import defaultPrompts from "../config/prompts.js";

class SummarizationService {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    if (!this.apiKey) {
      throw new Error("Google API Key is required");
    }
    
    // Load prompts from config, with option to override
    this.prompts = config.prompts || defaultPrompts;
  }

  /**
   * Summarize an audio file using Google's Generative AI
   * @param {string} audioFilePath - Path to the audio file
   * @param {Object} options - Options for summarization
   * @returns {Promise<string>} - The summarization text
   */
  async summarizeAudio(audioFilePath, options = {}) {
    // Validate file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    // Get the prompt to use
    let prompt = this.getPrompt(options);
    
    console.log(`Audio file loaded: ${audioFilePath}`);
    console.log('Processing with Gemini API...');

    // Initialize the Gemini API client
    const genAI = new GoogleGenAI(this.apiKey);
    
    // Upload the file
    console.log(`Uploading file ${audioFilePath}...`);
    const file = await genAI.files.upload({
      file: audioFilePath,
      config:{ mimeType: "audio/mp3"},
    });

    // Wait for processing to complete by displaying dots
    process.stdout.write("Processing");
    let dots = 0;
    const interval = setInterval(() => {
      process.stdout.write(".");
      dots++;
      if (dots > 50) {
        process.stdout.write("\n");
        dots = 0;
      }
    }, 1000);

    try {
      // Generate content with the file
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            parts: [
              { text: prompt },
              { fileData: { fileUri: file.uri, mimeType: "audio/mp3" } }
            ]
          }
        ]
      });
      
      clearInterval(interval);
      process.stdout.write("\n");
      console.log("Summary generated successfully.");
      
      return result.text;
    } catch (error) {
      clearInterval(interval);
      process.stdout.write("\n");
      console.error("Error generating summary:", error);
      throw error;
    }
  }

  getPrompt(options) {
    if (options.customPrompt) {
      return options.customPrompt;
    } else if (options.promptType && this.prompts[options.promptType]) {
      return this.prompts[options.promptType];
    } else {
      return this.prompts.default;
    }
  }

  /**
   * Get available prompt types
   * @returns {Object} - Object with available prompt types
   */
  getAvailablePrompts() {
    return Object.keys(this.prompts).reduce((acc, key) => {
      // Return just the first 100 characters of each prompt to avoid large responses
      acc[key] = this.prompts[key].substring(0, 100) + "...";
      return acc;
    }, {});
  }
}

export default SummarizationService;