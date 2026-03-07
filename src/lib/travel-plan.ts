import { z } from "zod";

import type { ChatMessage, TravelPlan } from "@/lib/types";

export const travelPlanSchema = z.object({
  tripType: z.enum(["round_trip", "one_way"]),
  origin: z.string().default(""),
  destination: z.string().default(""),
  departureDate: z.string().default(""),
  returnDate: z.string().nullable().default(null),
  flexibleDates: z.boolean().default(false),
  passengers: z.number().int().min(1).default(1),
  maxStops: z.number().int().min(0).max(2).nullable().default(null),
  budgetUsd: z.number().int().positive().nullable().default(null),
  notes: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  searchReady: z.boolean().default(false),
});

export const assistantTurnSchema = z.object({
  mode: z.enum(["clarify", "search"]),
  assistantMessage: z.string(),
  travelPlan: travelPlanSchema,
  realismWarnings: z.array(z.string()).default([]),
});

export const emptyTravelPlan: TravelPlan = {
  tripType: "round_trip",
  origin: "",
  destination: "",
  departureDate: "",
  returnDate: null,
  flexibleDates: false,
  passengers: 1,
  maxStops: 1,
  budgetUsd: null,
  notes: [],
  assumptions: [],
  searchReady: false,
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function mergeTravelPlan(current: TravelPlan, partial: Partial<TravelPlan>): TravelPlan {
  const next: TravelPlan = {
    ...current,
    ...partial,
    notes: dedupe([...(current.notes ?? []), ...(partial.notes ?? [])]),
    assumptions: dedupe([...(current.assumptions ?? []), ...(partial.assumptions ?? [])]),
  };

  if (next.tripType === "one_way") {
    next.returnDate = null;
  }

  next.searchReady = isSearchReady(next);
  return next;
}

export function isSearchReady(plan: TravelPlan) {
  if (!plan.origin || !plan.destination || !plan.departureDate || !plan.passengers) {
    return false;
  }

  if (plan.tripType === "round_trip" && !plan.returnDate) {
    return false;
  }

  return true;
}

export function getRealismWarnings(plan: TravelPlan): string[] {
  const warnings: string[] = [];
  const departure = safeDate(plan.departureDate);
  const returnDate = safeDate(plan.returnDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (departure && departure < today) {
    warnings.push("Your departure date is in the past. Update it before searching.");
  }

  if (plan.tripType === "round_trip" && departure && returnDate && returnDate <= departure) {
    warnings.push("Your return date needs to be after the departure date.");
  }

  if (plan.budgetUsd && plan.budgetUsd < 300 && /tokyo|london|paris|lisbon|rome/i.test(plan.destination)) {
    warnings.push("That budget may be too aggressive for the destination. Be ready to loosen dates or stops.");
  }

  if (plan.maxStops === 0 && plan.budgetUsd && plan.budgetUsd < 500) {
    warnings.push("Nonstop flights and a very low budget often conflict. You may get fewer results.");
  }

  return warnings;
}

export function fallbackTurn(
  currentPlan: TravelPlan,
  userMessage: string,
  messages: ChatMessage[],
): z.infer<typeof assistantTurnSchema> {
  const inferred = mergeTravelPlan(currentPlan, inferFieldsFromMessage(userMessage, currentPlan));
  const warnings = getRealismWarnings(inferred);

  if (!inferred.origin) {
    return {
      mode: "clarify",
      assistantMessage: "What airport or city are you flying from?",
      travelPlan: inferred,
      realismWarnings: warnings,
    };
  }

  if (!inferred.destination) {
    return {
      mode: "clarify",
      assistantMessage: "What airport or city do you want to fly to?",
      travelPlan: inferred,
      realismWarnings: warnings,
    };
  }

  if (!inferred.departureDate) {
    return {
      mode: "clarify",
      assistantMessage: "What departure date should I use? Exact dates are best for the first search.",
      travelPlan: inferred,
      realismWarnings: warnings,
    };
  }

  if (inferred.tripType === "round_trip" && !inferred.returnDate) {
    return {
      mode: "clarify",
      assistantMessage: "What return date should I use for the round-trip search?",
      travelPlan: inferred,
      realismWarnings: warnings,
    };
  }

  return {
    mode: "search",
    assistantMessage: summarizePlan(inferred, warnings, messages),
    travelPlan: inferred,
    realismWarnings: warnings,
  };
}

function inferFieldsFromMessage(message: string, current: TravelPlan): Partial<TravelPlan> {
  const lower = message.toLowerCase();
  const next: Partial<TravelPlan> = {
    flexibleDates: /\bflexible|any time|around|sometime\b/.test(lower) || current.flexibleDates,
  };

  if (/\bone[- ]?way\b/.test(lower)) {
    next.tripType = "one_way";
  }

  if (/\bround trip\b|\breturn\b/.test(lower)) {
    next.tripType = "round_trip";
  }

  const fromMatch = message.match(/\bfrom\s+([a-zA-Z .-]+?)\s+(?:to|for|on|in)\b/i);
  if (fromMatch?.[1]) {
    next.origin = tidyPlace(fromMatch[1]);
  }

  const toMatch = message.match(/\bto\s+([a-zA-Z .-]+?)\s+(?:for|on|in|around|sometime|$)/i);
  if (toMatch?.[1]) {
    next.destination = tidyPlace(toMatch[1]);
  }

  const isoDates = message.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (isoDates?.length) {
    next.departureDate = isoDates[0];
    if (isoDates[1]) {
      next.returnDate = isoDates[1];
    }
  }

  const mmddyyyy = message.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g);
  if (mmddyyyy?.length) {
    next.departureDate = toIso(mmddyyyy[0]);
    if (mmddyyyy[1]) {
      next.returnDate = toIso(mmddyyyy[1]);
    }
  }

  if (!next.departureDate) {
    const monthMatch = MONTHS.find((month) => lower.includes(month));
    if (monthMatch) {
      const yearMatch = message.match(/\b(20\d{2})\b/);
      const year = yearMatch?.[1] ?? String(new Date().getFullYear());
      const monthIndex = MONTHS.indexOf(monthMatch) + 1;
      next.departureDate = `${year}-${String(monthIndex).padStart(2, "0")}-10`;
      if (current.tripType !== "one_way" && !next.returnDate) {
        next.returnDate = `${year}-${String(monthIndex).padStart(2, "0")}-17`;
      }
      next.assumptions = [
        `Using ${monthMatch} with placeholder dates so we can keep moving. You can tighten them before searching.`,
      ];
    }
  }

  const passengerMatch = message.match(/\b(\d+)\s+(adult|adults|traveler|travelers|passenger|passengers)\b/i);
  if (passengerMatch?.[1]) {
    next.passengers = Number(passengerMatch[1]);
  }

  const budgetMatch = message.match(/\$ ?(\d{2,5})|\bunder\s+\$?(\d{2,5})\b/i);
  const budgetValue = budgetMatch?.[1] ?? budgetMatch?.[2];
  if (budgetValue) {
    next.budgetUsd = Number(budgetValue);
  }

  if (/\bnonstop\b/.test(lower)) {
    next.maxStops = 0;
  } else if (/\b(one stop|1 stop)\b/.test(lower)) {
    next.maxStops = 1;
  }

  if (/\bcheap|cheapest|budget\b/.test(lower)) {
    next.notes = ["Prioritize low price over comfort."];
  }

  if (/\bno crazy layovers|avoid overnight layovers|avoid red-eye|avoid redeye\b/.test(lower)) {
    next.notes = [...(next.notes ?? []), "Avoid punishing layovers or overnight itineraries."];
  }

  return next;
}

function summarizePlan(plan: TravelPlan, warnings: string[], messages: ChatMessage[]) {
  const priorContext = messages.length > 2 ? "I updated your plan based on the latest refinement." : "I have enough detail to search.";
  const route = `${plan.origin} to ${plan.destination}`;
  const dates =
    plan.tripType === "round_trip"
      ? `${plan.departureDate} to ${plan.returnDate}`
      : `departing ${plan.departureDate}`;
  const stopLine = plan.maxStops === 0 ? "nonstop only" : `up to ${plan.maxStops ?? 1} stop`;
  const budgetLine = plan.budgetUsd ? `budget target around $${plan.budgetUsd}` : "no hard budget";
  const warningLine = warnings.length ? ` Heads up: ${warnings.join(" ")}` : "";

  return `${priorContext} I’m searching ${route}, ${dates}, ${plan.passengers} traveler${plan.passengers > 1 ? "s" : ""}, economy, ${stopLine}, ${budgetLine}.${warningLine}`;
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function tidyPlace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toIso(value: string) {
  const [month, day, year] = value.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
