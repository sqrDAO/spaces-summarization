import dotenv from "dotenv";
dotenv.config();
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
  const AUDIO_FILE = "./audios/file.mp3";
  const API_KEY = process.env.GOOGLE_API_KEY;

  const prompt = `As a secretary, create a comprehensive single-post summary of this recorded Spaces using the following format:

🎯 SPACES OVERVIEW
Title:
Date & Time:
Host: @[hostname]

🎤 SPEAKERS & PARTICIPANTS
Main speakers: @[usernames]
Notable participants: @[usernames]
Approximate attendee count:

💡 DISCUSSION SUMMARY
Brief overview of main topics:
1. [First major topic]
2. [Second major topic]
[Continue with major points]

💬 COMPLETE Q&A LOG
[List all questions chronologically]

Q1 from @[username]: [Question]
A: [Answer] by @[username]

Q2 from @[username]: [Question]
A: [Answer] by @[username]

[Continue with all Q&As from the session]

📢 KEY ANNOUNCEMENTS
- [Important updates]
- [Future plans]

🎯 MAIN TAKEAWAYS
1. [Key conclusion]
2. [Important decision]
3. [Next steps]

Additional guidelines:
- Include ALL questions and answers from the session
- Maintain chronological order of Q&As
- Use @ mentions for all participants
- Keep answers as complete as possible while being concise
- Include any shared links
- Use line breaks for better readability

Note: While including all Q&As, maintain clarity and readability in the single post format. Do not provide in markdown format. Just provide the post.
`;

  const prompt2 = `As a secretary, summarize this recorded Spaces in a friendly manner. The summary should include these information: the main speakers and their position if it exists; a brief overview of the main topics discussed during the session; a complete log of all questions and answers from the session, including the question, answer, and the person who asked or answered the question; a list of any key announcements made during the session ; and the main takeaways from the session, including key conclusions, important decisions, and next steps. The summary should be written in a clear and concise manner, with all questions and answers included in chronological order. Just provide the summary, do not provide your ideas or thoughts. Do not use markdown or any other docs format, especially do not use any * or ** or *** for formatting. Do not repeat these requirements in the summary.`;

  /*
   * Upload an audio file to the API.
   * This will return a file object that contains the file's name and state.
   */
  const fileManager = new GoogleAIFileManager(API_KEY);

  const uploadResult = await fileManager.uploadFile(AUDIO_FILE, {
    mimeType: "audio/mp3",
    displayName: "Audio sample",
  });

  let file = await fileManager.getFile(uploadResult.file.name);

  while (file.state === FileState.PROCESSING) {
    process.stdout.write(".");
    // Sleep for 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    // Fetch the file from the API again
    file = await fileManager.getFile(uploadResult.file.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error("Audio processing failed.");
  }
  // View the response.
  console.log(
    `Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`
  );

  /*
   * Generate a response using the audio file.
   */
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent([
    prompt2,
    {
      fileData: {
        fileUri: uploadResult.file.uri,
        mimeType: "audio/mp3",
      },
    },
  ]);
  console.log(result.response.text());
}

main();
