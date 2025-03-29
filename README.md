# spaces-summarization

## install YT-DLP
https://github.com/yt-dlp/yt-dlp

```bash
python3 -m pip install -U "yt-dlp[default]"

```

## Install dependencies

First install ffmpeg
```
brew install ffmpeg
```

Then
```bash
npm i
```

## Download Spaces audio

```bash
yt-dlp -i <spaces_link> -o ./audios/<output_file_name>.mp3
```

## Summarize audio

Rename `.env_example` to `.env` and update the `GOOGLE_API_KEY` with your Google API key.

Change the `AUDIO_FILE` in `spaces_summarize.js` to the audio file you want to summarize (for example, `./audios/<output_file_name>.mp3`).Run the following command:

```bash
node spaces_summarize.js
```
