"use client";

import { ArrowRight, LoaderCircle, Plane, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { emptyTravelPlan } from "@/lib/travel-plan";
import type { ChatMessage, FlightOption, TravelPlan } from "@/lib/types";

type TurnResponse = {
  mode: "clarify" | "search";
  assistantMessage: string;
  travelPlan: TravelPlan;
  realismWarnings?: string[];
  flights: FlightOption[];
};

const QUICK_PROMPTS = [
  "I want to go from SFO to Tokyo in October for a week. Cheapest possible, but avoid crazy layovers.",
  "One-way from JFK to Lisbon on 2026-09-12 for 1 adult, nonstop if possible.",
  "Round trip from LAX to London 2026-07-02 to 2026-07-10 under $800.",
];

const WELCOME_MESSAGE =
  "Tell me where you want to go and roughly when. I’ll help narrow it down and surface flight options you can open right away.";

export function FlightPlannerApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
    },
  ]);
  const [travelPlan, setTravelPlan] = useState<TravelPlan>(emptyTravelPlan);
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const planSummary = useMemo(() => {
    const items = [
      travelPlan.origin && `From ${travelPlan.origin}`,
      travelPlan.destination && `To ${travelPlan.destination}`,
      travelPlan.departureDate && `Depart ${travelPlan.departureDate}`,
      travelPlan.tripType === "round_trip" && travelPlan.returnDate && `Return ${travelPlan.returnDate}`,
      `Passengers ${travelPlan.passengers}`,
      `Economy`,
      typeof travelPlan.maxStops === "number" &&
        (travelPlan.maxStops === 0 ? "Nonstop" : `Up to ${travelPlan.maxStops} stop`),
      typeof travelPlan.budgetUsd === "number" && `Budget $${travelPlan.budgetUsd}`,
    ].filter((value): value is string => Boolean(value));

    return items.length ? items : ["No active itinerary yet"];
  }, [travelPlan]);

  async function submitMessage(rawMessage?: string) {
    const content = (rawMessage ?? input).trim();
    if (!content || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          travelPlan,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "Turn failed");
      }

      const data = (await response.json()) as TurnResponse;
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.assistantMessage,
      };

      setMessages((current) => [...current, assistantMessage]);
      setTravelPlan(data.travelPlan);
      setWarnings(data.realismWarnings ?? []);
      setFlights(data.flights);
    } catch (submissionError) {
      console.error("Flight planner submission failed", submissionError);
      setError("Internal Error");
    } finally {
      setIsLoading(false);
    }
  }

  function resetSession() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: WELCOME_MESSAGE,
      },
    ]);
    setTravelPlan(emptyTravelPlan);
    setFlights([]);
    setInput("");
    setError(null);
    setWarnings([]);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.55),_transparent_35%),linear-gradient(180deg,_#fffdf6_0%,_#f3f4f6_55%,_#eef2ff_100%)] px-4 py-8 text-[var(--color-ink)] sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.45fr_0.9fr]">
        <section className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Find better flights without the usual search-form grind.
                </h1>
                <p className="max-w-2xl text-base text-[var(--color-muted)] sm:text-lg">
                  Start with a rough idea, refine it in a few messages, and compare flight options that actually fit the trip you want.
                </p>
              </div>
            </div>
            <Button className="shrink-0 whitespace-nowrap" variant="secondary" onClick={resetSession}>
              <RotateCcw className="mr-2 size-4" />
              Start over
            </Button>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[color:var(--color-border)] bg-white/70">
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                Everything below is ephemeral. Reload the page and the session disappears.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="max-h-[480px] space-y-4 overflow-y-auto pr-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-7 shadow-sm ${
                        message.role === "assistant"
                          ? "border border-slate-200 bg-slate-100 text-[var(--color-ink)]"
                          : "bg-[var(--color-ink)] text-white"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-3xl bg-white px-4 py-3 text-sm text-[var(--color-muted)]">
                      <LoaderCircle className="size-4 animate-spin" />
                      Thinking through the next step...
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 rounded-3xl border border-[color:var(--color-border)] bg-white/65 p-3">
                <Textarea
                  placeholder="Example: I need to go from SFO to Tokyo in October for about a week, cheapest possible, but no awful layovers."
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
                      onClick={() => {
                        setInput(prompt);
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--color-muted)]">
                    Live search runs when your API keys are available. Sample results only appear if keys are missing.
                  </p>
                  <Button size="lg" onClick={() => submitMessage()}>
                    Search
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
                {error && <p className="text-sm text-rose-700">{error}</p>}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[var(--color-accent-strong)]" />
                <CardTitle>Current Travel Plan</CardTitle>
              </div>
              <CardDescription>Structured state under the chat UI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {planSummary.map((item) => (
                  <Badge key={item}>{item}</Badge>
                ))}
              </div>
              {!!travelPlan.assumptions.length && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--color-muted)]">
                    Active assumptions
                  </p>
                  <div className="space-y-2">
                    {travelPlan.assumptions.map((assumption) => (
                      <p key={assumption} className="text-sm text-[var(--color-muted)]">
                        {assumption}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {!!warnings.length && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plane className="size-4 text-[var(--color-accent-strong)]" />
                <CardTitle>Flight Options</CardTitle>
              </div>
              <CardDescription>Top outbound links for the current plan.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[720px] space-y-4 overflow-y-auto pr-2">
              {!flights.length && (
                <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                  Run a search-ready conversation turn to populate results here.
                </div>
              )}

              {flights.map((flight) => (
                <div key={flight.id} className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-2xl font-semibold">${flight.priceTotalUsd}</p>
                      <p className="text-sm text-[var(--color-muted)]">{flight.airline}</p>
                    </div>
                    <Badge>{flight.stops === 0 ? "Nonstop" : `${flight.stops} stop`}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {flight.originAirport} to {flight.destinationAirport}
                      </p>
                      <p className="text-[var(--color-muted)]">{flight.duration}</p>
                    </div>
                    <div className="text-right">
                      <p>{formatDateTime(flight.departureTime)}</p>
                      <p className="text-[var(--color-muted)]">{formatDateTime(flight.arrivalTime)}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-[var(--color-muted)]">{flight.matchExplanation}</p>
                  <a
                    href={flight.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center text-sm font-medium text-[var(--color-accent-strong)]"
                  >
                    Open booking/search link
                    <ArrowRight className="ml-2 size-4" />
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}
