import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
    let prompt;
    if (options.customPrompt) {
      // Use the provided custom prompt
      prompt = options.customPrompt;
    } else if (options.promptType && this.prompts[options.promptType]) {
      // Use a predefined prompt type
      prompt = this.prompts[options.promptType];
    } else {
      // Use default prompt
      prompt = this.prompts.default;
    }

    // Initialize Google AI services
    const fileManager = new GoogleAIFileManager(this.apiKey);

    // Upload the audio file
    console.log(`Uploading file ${audioFilePath}...`);
    const uploadResult = await fileManager.uploadFile(audioFilePath, {
      mimeType: "audio/mp3",
      displayName: "Spaces audio",
    });

    // Wait for processing to complete
    let file = await fileManager.getFile(uploadResult.file.name);
    while (file.state === FileState.PROCESSING) {
      process.stdout.write(".");
      // Sleep for 10 seconds
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      // Fetch the file from the API again
      file = await fileManager.getFile(uploadResult.file.name);
    }

    // Check for processing errors
    if (file.state === FileState.FAILED) {
      throw new Error("Audio processing failed.");
    }
    
    console.log(`\nAudio processing completed. Generating summary...`);

    // Generate summary using the processed audio
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ 
      model: options.model || "gemini-1.5-flash" 
    });
    
    const result = await model.generateContent([
      prompt,
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: "audio/mp3",
        },
      },
    ]);

    console.log("Summary generated successfully.");
    return result.response.text();
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