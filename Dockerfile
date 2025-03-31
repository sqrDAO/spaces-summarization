# Base image
FROM node:18-alpine3.19

# Install Python and other dependencies
RUN apk add --no-cache python3 py3-pip 
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci

# Create and use a virtual environment for yt-dlp
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install --no-cache-dir 'yt-dlp[default]'

# Create directory for audio files
RUN mkdir -p /app/audios

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV OUTPUT_DIR=/app/audios

# Expose port
EXPOSE 3000

# Set volume for persistent storage
VOLUME [ "/app/audios" ]

# Start the service
CMD ["node", "api/index.js"]