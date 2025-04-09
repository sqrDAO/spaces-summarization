import YtDlpService from './services/yt-dlp-service.js';
import SummarizationService from './services/summarization-service.js';
import FileUploadService from './services/file-upload-service.js';
import customPrompts from './config/prompts.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Test configuration
const spacesUrl = 'https://x.com/i/broadcasts/1mnxegwvnWAGX'; // Replace with a real space URL
const outputDir = './test-audios';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test the complete Space summarization process using the new split services
 */
async function testSpaceSummarization() {
  try {
    console.log('🚀 Starting test of the Space summarization process...');
    
    // Step 1: Initialize services
    console.log('⚙️  Initializing services...');
    
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is required in .env file');
    }

    const ytDlpService = new YtDlpService({ outputDir });
    
    const fileUploadService = new FileUploadService({
      apiKey: process.env.GOOGLE_API_KEY
    });
    
    const summarizationService = new SummarizationService({
      apiKey: process.env.GOOGLE_API_KEY,
      prompts: customPrompts
    });

    // Step 2: Download the Space audio
    console.log('📥 Downloading Space audio...');
    console.log(`URL: ${spacesUrl}`);
    const downloadResult = await ytDlpService.downloadAudio(spacesUrl);
    
    console.log('✅ Download complete!');
    console.log(`File: ${downloadResult.outputPath}`);
    console.log(`Cached: ${downloadResult.cached ? 'Yes' : 'No'}`);
    
    // Step 3: Upload the file to Google's API
    console.log('\n📤 Uploading file to Google API...');
    const uploadedFile = await fileUploadService.uploadFile(downloadResult.outputPath);
    console.log('✅ Upload complete!');
    console.log(`File URI: ${uploadedFile.uri}`);
    
    // Step 4: Generate summary using the uploaded file
    console.log('\n📝 Generating summary...');
    console.log('This may take a while depending on the length of the audio...');
    
    // You can choose different prompt types
    const options = { promptType: 'formatted' };
    // To use a custom prompt, uncomment the following line:
    // const options = { customPrompt: "Please create a one-paragraph summary of this Space." };
    
    const summary = await summarizationService.summarizeFile(
      uploadedFile, 
      options
    );
    
    console.log('\n✅ Summary generated!\n');
    console.log('========== SUMMARY ==========');
    console.log(summary);
    console.log('========== END SUMMARY ==========');
    
    // Return results for potential further processing
    return { downloadResult, uploadedFile, summary };
  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  }
}

/**
 * Test only the download functionality
 */
async function testDownload() {
  try {
    console.log('🚀 Testing download functionality...');
    const ytDlpService = new YtDlpService({ outputDir });
    
    const result = await ytDlpService.downloadAudio(spacesUrl);
    console.log('✅ Download successful!');
    console.log(`File: ${result.outputPath}`);
    console.log(`Cached: ${result.cached ? 'Yes' : 'No'}`);
    return result;
  } catch (error) {
    console.error('❌ Download failed:', error);
    throw error;
  }
}

/**
 * Test only the upload functionality with a local file
 */
async function testUpload(filePath) {
  try {
    console.log('🚀 Testing upload functionality...');
    
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is required in .env file');
    }
    
    const fileUploadService = new FileUploadService({
      apiKey: process.env.GOOGLE_API_KEY
    });
    
    const result = await fileUploadService.uploadFile(filePath);
    console.log('✅ Upload successful!');
    console.log(`File URI: ${result.uri}`);
    return result;
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  }
}

/**
 * Test only the summarization functionality with an already uploaded file
 */
async function testSummarize(fileUri, promptType = 'default') {
  try {
    console.log('🚀 Testing summarization functionality...');
    
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is required in .env file');
    }
    
    const summarizationService = new SummarizationService({
      apiKey: process.env.GOOGLE_API_KEY,
      prompts: customPrompts
    });
    
    const fileInfo = {
      uri: fileUri,
      mimeType: 'audio/mp3'
    };
    
    const summary = await summarizationService.summarizeFile(
      fileInfo,
      { promptType }
    );
    
    console.log('✅ Summarization successful!');
    console.log('========== SUMMARY ==========');
    console.log(summary);
    console.log('========== END SUMMARY ==========');
    return summary;
  } catch (error) {
    console.error('❌ Summarization failed:', error);
    throw error;
  }
}

// Function to run the selected test based on command line arguments
async function runSelectedTest() {
  // Get command line arguments
  const args = process.argv.slice(2);
  const testType = args[0] || 'full';
  
  switch (testType) {
    case 'download':
      await testDownload();
      break;
    
    case 'upload':
      const filePath = args[1];
      if (!filePath) {
        console.error('❌ Error: File path is required for upload test');
        console.log('Usage: node test-space.js upload ./path/to/file.mp3');
        process.exit(1);
      }
      await testUpload(filePath);
      break;
    
    case 'summarize':
      const fileUri = args[1];
      const promptType = args[2] || 'default';
      if (!fileUri) {
        console.error('❌ Error: File URI is required for summarize test');
        console.log('Usage: node test-space.js summarize file_uri [prompt_type]');
        process.exit(1);
      }
      await testSummarize(fileUri, promptType);
      break;
    
    case 'full':
    default:
      await testSpaceSummarization();
      break;
  }
}

// Run the tests
runSelectedTest()
  .then(() => console.log('✨ Test completed successfully!'))
  .catch(() => process.exit(1));