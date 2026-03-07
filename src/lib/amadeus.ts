import type { FlightOption, TravelPlan } from "@/lib/types";

type AmadeusTokenResponse = {
  access_token: string;
};

type AmadeusFlightOffer = {
  id: string;
  itineraries: Array<{
    duration: string;
    segments: Array<{
      carrierCode: string;
      departure: {
        iataCode: string;
        at: string;
      };
      arrival: {
        iataCode: string;
        at: string;
      };
    }>;
  }>;
  price: {
    total: string;
  };
};

type AmadeusSearchResponse = {
  data: AmadeusFlightOffer[];
};

type AmadeusLocationResponse = {
  data: Array<{
    iataCode?: string;
    address?: {
      cityName?: string;
      countryCode?: string;
    };
    name?: string;
  }>;
};

const CITY_TO_AIRPORT: Record<string, string> = {
  "san francisco": "SFO",
  sf: "SFO",
  sfo: "SFO",
  "new york": "JFK",
  nyc: "JFK",
  jfk: "JFK",
  ewr: "EWR",
  lisbon: "LIS",
  tokyo: "HND",
  hnd: "HND",
  nrt: "NRT",
  london: "LHR",
  paris: "CDG",
  rome: "FCO",
  losangeles: "LAX",
  "los angeles": "LAX",
  lax: "LAX",
};

export async function searchFlights(plan: TravelPlan): Promise<FlightOption[]> {
  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret || apiKey.includes("stub") || apiSecret.includes("stub")) {
    return buildMockFlights(plan);
  }

  const token = await fetchAccessToken(apiKey, apiSecret);
  const originCode = await resolveLocationCode(token, plan.origin);
  const destinationCode = await resolveLocationCode(token, plan.destination);

  if (!originCode || !destinationCode) {
    throw new Error("I couldn't resolve one of the airports or cities. Try using a major airport code like SFO or JFK.");
  }

  const params = new URLSearchParams({
    originLocationCode: originCode,
    destinationLocationCode: destinationCode,
    departureDate: plan.departureDate,
    adults: String(plan.passengers),
    currencyCode: "USD",
    max: "5",
    travelClass: "ECONOMY",
    nonStop: String(plan.maxStops === 0),
  });

  if (plan.tripType === "round_trip" && plan.returnDate) {
    params.set("returnDate", plan.returnDate);
  }

  const response = await fetch(
    `https://test.api.amadeus.com/v2/shopping/flight-offers?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Live flight search failed. Please try a different route or date combination.");
  }

  const data = (await response.json()) as AmadeusSearchResponse;
  if (!data.data?.length) {
    return [];
  }

  return data.data.map((offer) => normalizeOffer(offer, plan));
}

async function fetchAccessToken(apiKey: string, apiSecret: string) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: apiSecret,
  });

  const response = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Amadeus token");
  }

  const data = (await response.json()) as AmadeusTokenResponse;
  return data.access_token;
}

function normalizeOffer(offer: AmadeusFlightOffer, plan: TravelPlan): FlightOption {
  const firstItinerary = offer.itineraries[0];
  const firstSegment = firstItinerary.segments[0];
  const lastSegment = firstItinerary.segments[firstItinerary.segments.length - 1];
  const stops = Math.max(firstItinerary.segments.length - 1, 0);
  const bookingUrl = buildSearchLink(plan);

  return {
    id: offer.id,
    priceTotalUsd: Math.round(Number(offer.price.total)),
    airline: firstSegment.carrierCode,
    originAirport: firstSegment.departure.iataCode,
    destinationAirport: lastSegment.arrival.iataCode,
    departureTime: firstSegment.departure.at,
    arrivalTime: lastSegment.arrival.at,
    stops,
    duration: firstItinerary.duration.replace("PT", "").toLowerCase(),
    bookingUrl,
    matchExplanation:
      stops === 0
        ? "Lowest nonstop option that fits the current plan."
        : "Strong price-to-convenience tradeoff for the current plan.",
  };
}

function buildMockFlights(plan: TravelPlan): FlightOption[] {
  const originCode = toAirportCode(plan.origin) || "SFO";
  const destinationCode = toAirportCode(plan.destination) || "LIS";
  const budgetBase = plan.budgetUsd ? Math.max(plan.budgetUsd - 40, 280) : 540;
  const nonstopStops = plan.maxStops === 0 ? 0 : 1;

  return [
    {
      id: "mock-1",
      priceTotalUsd: budgetBase,
      airline: "Demo Air",
      originAirport: originCode,
      destinationAirport: destinationCode,
      departureTime: `${plan.departureDate}T08:20`,
      arrivalTime: `${plan.departureDate}T19:05`,
      stops: nonstopStops,
      duration: nonstopStops === 0 ? "11h 45m" : "14h 10m",
      bookingUrl: buildSearchLink(plan),
      matchExplanation: "Mock result while API keys are missing. The structure matches the live provider output.",
    },
    {
      id: "mock-2",
      priceTotalUsd: budgetBase + 88,
      airline: "Budget Hopper",
      originAirport: originCode,
      destinationAirport: destinationCode,
      departureTime: `${plan.departureDate}T12:45`,
      arrivalTime: `${plan.departureDate}T23:15`,
      stops: 0,
      duration: "10h 30m",
      bookingUrl: buildSearchLink(plan),
      matchExplanation: "Faster itinerary with a slightly higher fare.",
    },
    {
      id: "mock-3",
      priceTotalUsd: budgetBase + 142,
      airline: "SkyLink",
      originAirport: originCode,
      destinationAirport: destinationCode,
      departureTime: `${plan.departureDate}T18:15`,
      arrivalTime: `${plan.departureDate}T08:10`,
      stops: 1,
      duration: "16h 55m",
      bookingUrl: buildSearchLink(plan),
      matchExplanation: "Later departure with weaker convenience but still within the typical budget band.",
    },
  ];
}

function toAirportCode(input: string) {
  if (!input) return "";
  const normalized = input.trim().toLowerCase();
  if (/^[a-z]{3}$/i.test(normalized)) {
    return normalized.toUpperCase();
  }
  return CITY_TO_AIRPORT[normalized] ?? "";
}

async function resolveLocationCode(token: string, input: string) {
  const direct = toAirportCode(input);
  if (direct) {
    return direct;
  }

  const params = new URLSearchParams({
    keyword: input,
    subType: "AIRPORT,CITY",
    "page[limit]": "1",
    view: "LIGHT",
  });

  const response = await fetch(
    `https://test.api.amadeus.com/v1/reference-data/locations?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Airport lookup failed. Try a major city or airport code.");
  }

  const data = (await response.json()) as AmadeusLocationResponse;
  return data.data[0]?.iataCode ?? "";
}

function buildSearchLink(plan: TravelPlan) {
  const route = `Flights from ${plan.origin} to ${plan.destination}`;
  const dates =
    plan.tripType === "round_trip" && plan.returnDate
      ? ` departing ${plan.departureDate} returning ${plan.returnDate}`
      : ` on ${plan.departureDate}`;

  return `https://www.google.com/travel/flights?q=${encodeURIComponent(`${route}${dates}`)}`;
}
