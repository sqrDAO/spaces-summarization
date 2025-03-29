const { NodeOperationError } = require('n8n-workflow');
const YtDlpService = require('../services/yt-dlp-service');

class YtDlpNode {
  constructor() {
    this.name = 'YtDlp';
    this.type = 'action';
    this.group = ['transform'];
    this.version = 1;
    this.description = 'Download Twitter Spaces audio using yt-dlp';
    this.defaults = {
      name: 'Download Spaces Audio',
      color: '#ff6600',
    };
    this.inputs = ['main'];
    this.outputs = ['main'];
    this.properties = [
      {
        displayName: 'Spaces URL',
        name: 'spacesUrl',
        type: 'string',
        default: '',
        required: true,
        description: 'URL of the Twitter Spaces to download',
      },
      {
        displayName: 'Output Filename',
        name: 'outputFilename',
        type: 'string',
        default: '',
        required: false,
        description: 'Name for the output file (without extension)',
      },
      {
        displayName: 'Output Directory',
        name: 'outputDir',
        type: 'string',
        default: './audios',
        required: false,
        description: 'Directory where the audio will be saved',
      },
      {
        displayName: 'YT-DLP Path',
        name: 'ytDlpPath',
        type: 'string',
        default: 'yt-dlp',
        required: false,
        description: 'Path to the yt-dlp executable',
      },
    ];
  }

  async execute(nodeData) {
    const { spacesUrl, outputFilename, outputDir, ytDlpPath } = nodeData.parameters;
    
    try {
      const service = new YtDlpService({
        outputDir: outputDir || './audios',
        ytDlpPath: ytDlpPath || 'yt-dlp',
      });
      
      const outputPath = await service.downloadAudio(spacesUrl, outputFilename);
      
      return {
        json: {
          success: true,
          outputPath,
          filename: path.basename(outputPath),
          mimeType: 'audio/mpeg',
        },
      };
    } catch (error) {
      throw new NodeOperationError(
        nodeData.name,
        `Failed to download audio: ${error.message}`,
        { itemIndex: 0 }
      );
    }
  }
}

module.exports = YtDlpNode;