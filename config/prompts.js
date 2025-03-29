export default {
  default: `As a secretary, summarize this recorded Spaces in a friendly manner. The summary should include these information: the main speakers and their position if it exists; a brief overview of the main topics discussed during the session; a complete log of all questions and answers from the session, including the question, answer, and the person who asked or answered the question; a list of any key announcements made during the session ; and the main takeaways from the session, including key conclusions, important decisions, and next steps. The summary should be written in a clear and concise manner, with all questions and answers included in chronological order. Just provide the summary, do not provide your ideas or thoughts. Do not use markdown or any other docs format, especially do not use any * or ** or *** for formatting. Do not repeat these requirements in the summary.`,
  
  formatted: `As a secretary, create a comprehensive single-post summary of this recorded Spaces using the following format:

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

Note: While including all Q&As, maintain clarity and readability in the single post format. Do not provide in markdown format. Just provide the post.`
};