import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import { assistantTurnSchema, fallbackTurn } from "@/lib/travel-plan";
import type { ChatMessage, TravelPlan } from "@/lib/types";

const SYSTEM_PROMPT = `You are a flight-planning assistant.
Turn a user's latest message and current travel plan into a structured next action.
Rules:
- Ask at most one clarification question when required.
- Only support one-way and round-trip economy itineraries.
- Prefer exact dates for the first search, but you may preserve flexibility hints.
- If the plan is complete enough, return mode="search".
- Keep assistantMessage concise and useful.
- Do not invent unsupported features like booking inside the product.`;

export async function decideNextTurn(currentPlan: TravelPlan, messages: ChatMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";

  if (!apiKey || apiKey.includes("stub")) {
    return fallbackTurn(currentPlan, latestUserMessage, messages);
  }

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.parse({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        {
          role: "developer",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            currentPlan,
            messages,
            today: new Date().toISOString().slice(0, 10),
          }),
        },
      ],
      response_format: zodResponseFormat(assistantTurnSchema, "assistant_turn"),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      return fallbackTurn(currentPlan, latestUserMessage, messages);
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI request failed";
    throw new Error(`OpenAI planning failed: ${message}`);
  }
}
