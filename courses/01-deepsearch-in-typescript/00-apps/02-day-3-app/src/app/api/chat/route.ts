import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  appendResponseMessages,
} from "ai";
import { model } from "~/model";
import { auth } from "~/server/auth";
import { searchSerper } from "~/serper";
import { bulkCrawlWebsites } from "~/scraper";
import { z } from "zod";
import { upsertChat } from "~/server/db/queries";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { chats } from "~/server/db/schema";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { cacheWithRedis } from "~/server/redis/redis";

const langfuse = new Langfuse({
  environment: env.NODE_ENV,
});

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
    chatId: string;
    isNewChat: boolean;
  };

  const { messages, chatId, isNewChat } = body;

  if (!messages.length) {
    return new Response("No messages provided", { status: 400 });
  }

  // Determine the current chat ID - if it's a new chat, we'll use the provided chatId
  // If it's not a new chat, we'll use the existing chatId from the request
  const currentChatId = chatId;

  // Create a trace for this chat session
  const trace = langfuse.trace({
    sessionId: currentChatId,
    name: "chat",
    userId: session.user.id,
  });

  // If this is a new chat, create it with the user's message
  if (isNewChat) {
    const createChatSpan = trace.span({
      name: "create-new-chat",
      input: {
        userId: session.user.id,
        chatId: chatId,
        title: messages[messages.length - 1]!.content.slice(0, 50) + "...",
        messageCount: messages.length,
      },
    });

    try {
      await upsertChat({
        userId: session.user.id,
        chatId: chatId,
        title: messages[messages.length - 1]!.content.slice(0, 50) + "...",
        messages: messages, // Only save the user's message initially
      });

      createChatSpan.end({
        output: {
          success: true,
          chatId: chatId,
        },
      });
    } catch (error) {
      createChatSpan.end({
        output: {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    }
  } else {
    // Verify the chat belongs to the user
    const verifyChatSpan = trace.span({
      name: "verify-chat-ownership",
      input: {
        chatId: chatId,
        userId: session.user.id,
      },
    });

    try {
      const chat = await db.query.chats.findFirst({
        where: eq(chats.id, chatId),
      });

      if (!chat || chat.userId !== session.user.id) {
        verifyChatSpan.end({
          output: {
            success: false,
            error: "Chat not found or unauthorized",
            chatFound: !!chat,
            chatUserId: chat?.userId,
          },
        });
        return new Response("Chat not found or unauthorized", { status: 404 });
      }

      verifyChatSpan.end({
        output: {
          success: true,
          chatId: chat.id,
          chatTitle: chat.title,
        },
      });
    } catch (error) {
      verifyChatSpan.end({
        output: {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    }
  }

  return createDataStreamResponse({
    execute: async (dataStream) => {
      // If this is a new chat, send the chat ID to the frontend
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: chatId,
        });
      }

      const currentDate = new Date().toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });

      const result = streamText({
        model,
        messages,
        maxSteps: 10,
        experimental_telemetry: {
          isEnabled: true,
          functionId: `agent`,
          metadata: {
            langfuseTraceId: trace.id,
          },
        },
        system: `You are a helpful AI assistant with access to real-time web search capabilities and web scraping tools. 

CURRENT DATE AND TIME: ${currentDate}

When answering questions:

1. Always search the web for up-to-date information when relevant
2. ALWAYS format URLs as markdown links using the format [title](url)
3. Be thorough but concise in your responses
4. If you're unsure about something, search the web to verify
5. When providing information, always include the source where you found it using markdown links
6. Never include raw URLs - always use markdown link format
7. Use the scrapePages tool when you need to extract the full content from specific web pages that you've found through search
8. IMPORTANT: After finding relevant URLs from search results, ALWAYS use the scrapePages tool to get the full content of those pages. Never rely solely on search snippets
9. When users ask for "up to date" information, "current" information, or "latest" news, reference the current date and time (${currentDate}) to provide context about what "up to date" means
10. When search results include publication dates, mention these dates to help users understand how recent the information is

Remember to use the searchWeb tool whenever you need to find current information, and use scrapePages when you need to extract detailed content from specific pages.`,
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
                date: result.date,
              }));
            },
          },
          scrapePages: {
            parameters: z.object({
              urls: z
                .array(z.string())
                .describe("Array of URLs to scrape for full content"),
            }),
            execute: async ({ urls }, { abortSignal }) => {
              const scrapePagesWithCache = cacheWithRedis(
                "scrapePages",
                async (urlsToScrape: string[]) => {
                  const result = await bulkCrawlWebsites({
                    urls: urlsToScrape,
                  });

                  if (result.success) {
                    return result.results.map(
                      ({ url, result: crawlResult }) => ({
                        url,
                        content: crawlResult.data,
                        success: true,
                      }),
                    );
                  } else {
                    return result.results.map(
                      ({ url, result: crawlResult }) => ({
                        url,
                        content: crawlResult.success
                          ? crawlResult.data
                          : `Error: ${crawlResult.error}`,
                        success: crawlResult.success,
                      }),
                    );
                  }
                },
              );

              return await scrapePagesWithCache(urls);
            },
          },
        },
        onFinish: async ({ response }) => {
          // Merge the existing messages with the response messages
          const updatedMessages = appendResponseMessages({
            messages,
            responseMessages: response.messages,
          });

          const lastMessage = messages[messages.length - 1];
          if (!lastMessage) {
            return;
          }

          // Save the complete chat history
          const saveChatHistorySpan = trace.span({
            name: "save-chat-history",
            input: {
              userId: session.user.id,
              chatId: chatId,
              title: lastMessage.content.slice(0, 50) + "...",
              messageCount: updatedMessages.length,
            },
          });

          try {
            await upsertChat({
              userId: session.user.id,
              chatId: chatId,
              title: lastMessage.content.slice(0, 50) + "...",
              messages: updatedMessages,
            });

            saveChatHistorySpan.end({
              output: {
                success: true,
                chatId: chatId,
                savedMessageCount: updatedMessages.length,
              },
            });
          } catch (error) {
            saveChatHistorySpan.end({
              output: {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              },
            });
            throw error;
          }

          // Flush the trace to Langfuse
          await langfuse.flushAsync();
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occurred!";
    },
  });
}
