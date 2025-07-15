import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  appendResponseMessages,
} from "ai";
import { auth } from "~/server/auth";
import { model } from "~/model";
import { z } from "zod";
import { searchSerper } from "~/serper";
import { upsertChat } from "~/server/db/queries";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
    chatId?: string;
  };

  const { messages, chatId } = body;

  // Create a new chat if chatId is not provided
  let finalChatId = chatId;
  if (!finalChatId) {
    finalChatId = crypto.randomUUID();
    // Create the chat with just the user's message before starting the stream
    const userMessage = messages[messages.length - 1];
    if (userMessage) {
      const title =
        userMessage.content.slice(0, 100) +
        (userMessage.content.length > 100 ? "..." : "");

      await upsertChat({
        userId: session.user.id,
        chatId: finalChatId,
        title,
        messages,
      });
    }
  }

  return createDataStreamResponse({
    execute: async (dataStream) => {
      // Send the new chat ID to the frontend if this is a new chat
      if (!chatId) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: finalChatId,
        });
      }

      const result = streamText({
        model,
        messages,
        system: `You are a helpful AI assistant with access to web search capabilities. 

IMPORTANT: Whenever you reference a source or URL, always format it as a markdown link: [title](url). Never show raw URLs—always use markdown link syntax.

When users ask questions that require current information, facts, or recent events, you should use the search web tool to find relevant information.

Always search the web when:
- Users ask about current events, news, or recent developments
- Questions require factual information that might be time-sensitive
- Users ask about specific products, services, or companies
- Questions about weather, sports scores, or other real-time data
- Users ask "what is" or "who is" questions about people, places, or things

After searching, always cite your sources with inline links in the format [source name](link). For example: "According to [Wikipedia](https://example.com), the answer is..."

Be thorough in your searches and provide comprehensive, well-sourced answers.`,
        maxSteps: 10,
        tools: {
          searchWeb: {
            parameters: z.object({
              query: z.string().describe("The query to search the web for"),
            }),
            execute: async ({ query }, { abortSignal }) => {
              const results = await searchSerper(
                { q: query, num: 10 },
                abortSignal,
              );

              return results.organic.map((result) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
              }));
            },
          },
        },
        onFinish({
          text: _text,
          finishReason: _finishReason,
          usage: _usage,
          response,
        }) {
          const responseMessages = response.messages;

          const updatedMessages = appendResponseMessages({
            messages,
            responseMessages,
          });

          // Save the updated messages to the database
          const userMessage = messages[messages.length - 1];
          if (userMessage) {
            const title =
              userMessage.content.slice(0, 100) +
              (userMessage.content.length > 100 ? "..." : "");

            upsertChat({
              userId: session.user.id,
              chatId: finalChatId,
              title,
              messages: updatedMessages,
            }).catch((error) => {
              console.error("Failed to save chat:", error);
            });
          }
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
