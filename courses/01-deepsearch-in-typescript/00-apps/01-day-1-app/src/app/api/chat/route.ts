import type { Message } from "ai";
import { streamText, createDataStreamResponse } from "ai";
import { auth } from "~/server/auth";
import { model } from "~/model";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
  };

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const { messages } = body;

      const result = streamText({
        model,
        messages,
        system: `You are a helpful AI assistant with access to web search capabilities through search grounding.

IMPORTANT: Whenever you reference a source or URL, always format it as a markdown link: [title](url). Never show raw URLs—always use markdown link syntax.

When users ask questions that require current information, facts, or recent events, you should use your built-in search capabilities to find relevant information.

Always search when:
- Users ask about current events, news, or recent developments
- Questions require factual information that might be time-sensitive
- Users ask about specific products, services, or companies
- Questions about weather, sports scores, or other real-time data
- Users ask "what is" or "who is" questions about people, places, or things

After searching, always cite your sources with inline links in the format [source name](link). For example: "According to [Wikipedia](https://example.com), the answer is..."

Be thorough in your searches and provide comprehensive, well-sourced answers.`,
        maxSteps: 10,
      });

      result.mergeIntoDataStream(dataStream, {
        sendSources: true,
      });
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
