# Twitter Spaces Summarization

A containerized service for downloading Twitter Spaces audio using yt-dlp and generating summaries with Google's Generative AI.

## Features

- **Download Twitter Spaces**: Automatically download audio from Twitter Spaces using yt-dlp
- **Smart Caching**: Uses hash-based file naming to avoid redownloading content
- **Summarization**: Generate comprehensive summaries of Spaces content using Google's Gemini API
- **Customizable Prompts**: Configure different prompt styles for different summarization needs
- **REST API**: Clean REST API for integration with automation tools like n8n
- **Docker Support**: Ready to deploy as a container in Kubernetes

## Installation

### Prerequisites

- Node.js 18+
- Python 3
- ffmpeg
- Docker (for containerized deployment)

### Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/spaces-summarization.git
   cd spaces-summarization
   ```

2. Install dependencies:
   ```bash
   npm install
   python3 -m pip install -U "yt-dlp[default]"
   ```

3. Install ffmpeg:
   ```bash
   # On macOS
   brew install ffmpeg
   
   # On Ubuntu/Debian
   apt-get update && apt-get install ffmpeg -y
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your Google API key
   ```

## Configuration

### Environment Variables

- `GOOGLE_API_KEY`: Your Google API key for Gemini API access
- `OUTPUT_DIR`: Directory where audio files will be stored (default: audios)
- `PORT`: Port for the API server (default: `3000`)

### Customizing Prompts

Prompts for summarization are stored in prompts.js. You can modify existing prompts or add new ones.

```javascript
export default {
  default: `Your default prompt text here...`,
  formatted: `Your structured format prompt here...`,
  // Add more custom prompt types as needed
};
```

## Usage

### Starting the Service

```bash
node api/index.js
```

### API Endpoints

#### 1. Download Spaces Audio

```bash
curl -X POST http://localhost:3000/download-spaces \
  -H "Content-Type: application/json" \
  -d '{"spacesUrl": "https://twitter.com/i/spaces/YOUR_SPACE_ID"}'
```

Response:
```json
{
  "success": true,
  "outputPath": "/app/audios/1a2b3c4d5e6f7g8h9i0j.mp3",
  "filename": "1a2b3c4d5e6f7g8h9i0j.mp3",
  "cached": false
}
```

#### 2. Summarize Spaces

```bash
curl -X POST http://localhost:3000/summarize-spaces \
  -H "Content-Type: application/json" \
  -d '{
    "spacesUrl": "https://twitter.com/i/spaces/YOUR_SPACE_ID",
    "promptType": "formatted"
  }'
```

Response:
```json
{
  "success": true,
  "summary": "This is the generated summary...",
  "audioFile": {
    "path": "/app/audios/1a2b3c4d5e6f7g8h9i0j.mp3",
    "filename": "1a2b3c4d5e6f7g8h9i0j.mp3",
    "cached": true
  }
}
```

#### 3. Get Available Prompt Types

```bash
curl http://localhost:3000/prompts
```

Response:
```json
{
  "success": true,
  "availablePrompts": {
    "default": "As a secretary, summarize this recorded Spaces in a friendly manner. The summary should inc...",
    "formatted": "As a secretary, create a comprehensive single-post summary of this recorded Spaces using th..."
  }
}
```

### Using Custom Prompts

You can use a custom prompt by including it in the request:

```bash
curl -X POST http://localhost:3000/summarize-spaces \
  -H "Content-Type: application/json" \
  -d '{
    "spacesUrl": "https://twitter.com/i/spaces/YOUR_SPACE_ID",
    "customPrompt": "Create a concise summary of this Twitter Space focusing only on the main topics discussed."
  }'
```

## Docker Deployment

### Building the Docker Image

```bash
docker build -t spaces-summarization .
```

### Running the Container

```bash
docker run -p 3000:3000 \
  -e GOOGLE_API_KEY=your_api_key \
  -v $(pwd)/audios:/app/audios \
  spaces-summarization
```

## Kubernetes Deployment

The repo includes Kubernetes manifest files in the `kubernetes/` directory:

```bash
kubectl apply -f kubernetes/pvc.yaml
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml
```

## Integration with n8n

To use this service with n8n:

1. Add an HTTP Request node
2. Set the method to POST
3. Set the URL to `http://your-service-url/summarize-spaces`
4. Add the JSON body:
   ```json
   {
     "spacesUrl": "{{$json.spacesUrl}}",
     "promptType": "formatted"
   }
   ```
5. Process the `summary` field from the response

## Architecture

- **API Layer**: Express.js REST API (`api/index.js`)
- **Service Layer**: 
  - `YtDlpService`: Handles downloading and caching of Spaces audio
  - `SummarizationService`: Handles audio processing and summarization
- **Configuration**: External configuration for customizable prompts
- **Storage**: Local file system for audio files (mapped to persistent volume in Kubernetes)

## Legacy CLI Usage

For those who prefer the original CLI approach (now deprecated in favor of the API):

```bash
yt-dlp -i <spaces_link> -o ./audios/<output_file_name>.mp3
node spaces_summarize.js
```

## License

MIT

## Acknowledgements

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for audio downloading functionality
- [Google Generative AI](https://ai.google.dev/) for summarization capabilities
- [Claude](https://claude.ai) for "vibe coding" assistance during application development