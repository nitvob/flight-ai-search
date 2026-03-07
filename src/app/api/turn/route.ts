import { NextResponse } from "next/server";
import { z } from "zod";

import { searchFlights } from "@/lib/amadeus";
import { decideNextTurn } from "@/lib/openai";
import { emptyTravelPlan, travelPlanSchema } from "@/lib/travel-plan";

const requestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  travelPlan: travelPlanSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const turn = await decideNextTurn(body.travelPlan ?? emptyTravelPlan, body.messages);

    if (turn.mode === "clarify") {
      return NextResponse.json({
        ...turn,
        flights: [],
      });
    }

    const flights = await searchFlights(turn.travelPlan);

    return NextResponse.json({
      ...turn,
      flights,
    });
  } catch (error) {
    console.error("POST /api/turn failed", error);

    return NextResponse.json(
      {
        message: "Internal Error",
      },
      { status: 500 },
    );
  }
}
