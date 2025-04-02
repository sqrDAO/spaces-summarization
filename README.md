# Twitter Spaces Summarization

A service for downloading Twitter Spaces audio and generating summaries with Google's Generative AI (Gemini).

## Prerequisites

- Node.js (v16+)
- Python 3
- ffmpeg

## Quick Start

### Local Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/spaces-summarization.git
cd spaces-summarization

# Install dependencies
npm install
pip install -U yt-dlp

# Configure environment
cp .env.example .env
# Edit .env with your Google API key

# Start the service
npm start
```

### Docker Setup

```bash
# Build the Docker image
docker build -t spaces-summarization .

# Run the container
docker run -p 3000:3000 \
  -e GOOGLE_API_KEY=your_api_key \
  -e API_KEY_REQUIRED=true \
  -e AUTHORIZED_API_KEYS=your-secret-key \
  -v $(pwd)/audios:/app/audios \
  spaces-summarization
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_API_KEY` | Your Google API key for Gemini AI | (required) |
| `OUTPUT_DIR` | Directory where audio files will be stored | audios |
| `PORT` | Port for the API server | `3000` |
| `API_KEY_REQUIRED` | Enable/disable API key authentication | `true` |
| `AUTHORIZED_API_KEYS` | Comma-separated list of valid API keys | (required if auth enabled) |

## API Usage

### Authentication

Include your API key in the header of all requests:

```
X-API-Key: your-secret-key
```

## Synchronous API (Not recommended for large files)

### Download a Twitter Space

```bash
curl -X POST http://localhost:3000/api/download-spaces \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "spacesUrl": "https://twitter.com/i/spaces/YOUR_SPACE_ID"
  }'
```

### Summarize a Twitter Space

```bash
curl -X POST http://localhost:3000/api/summarize-spaces \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "spacesUrl": "https://twitter.com/i/spaces/YOUR_SPACE_ID",
    "promptType": "formatted"
  }'
```

## Asynchronous API (Recommended)

For long downloads or when handling multiple requests, use the asynchronous endpoints:

### Start an Asynchronous Download

```bash
curl -X POST http://localhost:3000/api/async/download-spaces \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "spacesUrl": "https://twitter.com/i/spaces/YOUR_SPACE_ID"
  }'
```

### Start an Asynchronous Summarization

```bash
curl -X POST http://localhost:3000/api/async/summarize-spaces \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "spacesUrl": "https://twitter.com/i/spaces/YOUR_SPACE_ID",
    "promptType": "formatted"
  }'
```

Async requests return immediately with a job ID:
```json
{
  "success": true,
  "message": "Job started",
  "jobId": "job_1647582390_a1b2c3"
}
```

## Job Management

### Check Job Status

```bash
curl -X GET http://localhost:3000/api/jobs/job_1647582390_a1b2c3 \
  -H "X-API-Key: your-secret-key"
```

### List All Jobs

```bash
curl -X GET http://localhost:3000/api/jobs \
  -H "X-API-Key: your-secret-key"
```

### Check Queue Status

```bash
curl -X GET http://localhost:3000/api/queue-status \
  -H "X-API-Key: your-secret-key"
```

### Job Monitoring Dashboard

A web-based job monitoring dashboard is available at:
```
http://localhost:3000/jobs.html
```

## Advanced API Features

### Upload an Audio File

Upload an existing audio file without downloading from Twitter:

```bash
curl -X POST http://localhost:3000/api/upload-audio \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "filePath": "/path/to/local/audio.mp3"
  }'
```

### Summarize an Uploaded File

Summarize an already uploaded file using its URI:

```bash
curl -X POST http://localhost:3000/api/summarize-uploaded \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "fileUri": "gs://genai-files/abcdef123456",
    "promptType": "formatted"
  }'
```

### Using Custom Prompts

Any summarization endpoint supports custom prompts:

```bash
curl -X POST http://localhost:3000/api/summarize-spaces \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "spacesUrl": "https://twitter.com/i/spaces/YOUR_SPACE_ID",
    "customPrompt": "Create a concise summary of this Twitter Space focusing only on the main topics discussed."
  }'
```

### Get Available Prompt Types

```bash
curl -X GET http://localhost:3000/api/prompts \
  -H "X-API-Key: your-secret-key"
```

## API Documentation

Access the Swagger UI documentation at `http://localhost:3000/api-docs`

You can also import the API directly into Postman using:
```
http://localhost:3000/swagger.json
```

## Testing

Run the built-in tests to verify your setup:

```bash
# Test the full pipeline (download + upload + summarize)
node test-space.js

# Test specific components
node test-space.js download
node test-space.js upload ./path/to/file.mp3
node test-space.js summarize gs://genai-files/your-file-uri formatted
```

## Getting a Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create or sign in with your Google account
3. Click "Get API key" and copy the key
4. Add the API key to your .env file

## License

MIT