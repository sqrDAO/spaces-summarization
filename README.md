# spaces-summarization

## Install dependencies

You must install [ffmpeg](https://www.ffmpeg.org/download.html) before running the scripts.

Run the following command:

```bash
npm i
```

## Download Spaces audio

```bash
./tools/yt-dlp -i <spaces_link> -o ./audios/<output_file_name>.mp3
```

## Summarize audio

Rename `.env_example` to `.env` and update the `GOOGLE_API_KEY` with your Google API key.

Change the `AUDIO_FILE` in `spaces_summarize.js` to the audio file you want to summarize (for example, `./audios/<output_file_name>.mp3`).Run the following command:

```bash
node spaces_summarize.js
```
