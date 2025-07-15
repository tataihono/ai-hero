import { eq, desc } from "drizzle-orm";
import type { Message } from "ai";

import { db } from "./index";
import { chats, messages } from "./schema";

export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title: string;
  messages: Message[];
}) => {
  const { userId, chatId, title, messages: messageList } = opts;

  // Check if chat exists and belongs to the user
  const existingChat = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  if (existingChat.length > 0 && existingChat[0]?.userId !== userId) {
    throw new Error("Chat does not belong to the logged in user");
  }

  // If chat exists, delete all existing messages
  if (existingChat.length > 0) {
    await db.delete(messages).where(eq(messages.chatId, chatId));
  }

  // Insert or update the chat
  await db
    .insert(chats)
    .values({
      id: chatId,
      title,
      userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: chats.id,
      set: {
        title,
        updatedAt: new Date(),
      },
    });

  // Insert all messages
  if (messageList.length > 0) {
    const messageValues = messageList.map((message, index) => ({
      chatId,
      role: message.role,
      parts: message.content,
      order: index,
    }));

    await db.insert(messages).values(messageValues);
  }
};

export const getChat = async (chatId: string) => {
  const chat = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  if (chat.length === 0) {
    return null;
  }

  const chatMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.order);

  // Convert back to Message format
  const messageList: Message[] = chatMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system",
    content: msg.parts as string,
  }));

  return {
    ...chat[0],
    messages: messageList,
  };
};

export const getChats = async (userId: string) => {
  const userChats = await db
    .select({
      id: chats.id,
      title: chats.title,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
    })
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt));

  return userChats;
};
