import YtDlpService from './services/yt-dlp-service.js';
import SummarizationService from './services/summarization-service.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Test configuration
const spacesUrl = 'https://x.com/i/spaces/1rmxPywblayKN'; // Replace with a real space URL
const outputDir = './test-audios';

async function testSpaceSummarization() {
  try {
    console.log('🚀 Starting test of the Space summarization process...');
    
    // Step 1: Initialize services
    console.log('⚙️  Inißtializing services...');
    const ytDlpService = new YtDlpService({ outputDir });
    
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is required in .env file');
    }
    
    const summarizationService = new SummarizationService({
      apiKey: process.env.GOOGLE_API_KEY
    });

    // Step 2: Download the Space audio
    console.log('📥 Downloading Space audio...');
    console.log(`URL: ${spacesUrl}`);
    const downloadResult = await ytDlpService.downloadAudio(spacesUrl);
    
    console.log('✅ Download complete!');
    console.log(`File: ${downloadResult.outputPath}`);
    console.log(`Cached: ${downloadResult.cached ? 'Yes' : 'No'}`);
    
    // Step 3: Summarize the audio
    console.log('\n📝 Generating summary...');
    console.log('This may take a while depending on the length of the audio...');
    
    const summary = await summarizationService.summarizeAudio(
      downloadResult.outputPath,
      { promptType: 'default' }
    );
    
    console.log('\n✅ Summary generated!\n');
    console.log('========== SUMMARY ==========');
    console.log(summary);
    console.log('========== END SUMMARY ==========');
    
    return { downloadResult, summary };
  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  }
}

// Run the test
testSpaceSummarization()
  .then(() => console.log('✨ Test completed successfully!'))
  .catch(() => process.exit(1));