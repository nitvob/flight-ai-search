export type AirportOption = {
  code: string;
  city?: string;
};

export type TripType = "round_trip" | "one_way";

export type TravelPlan = {
  tripType: TripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  flexibleDates: boolean;
  passengers: number;
  maxStops: number | null;
  budgetUsd: number | null;
  notes: string[];
  assumptions: string[];
  searchReady: boolean;
};

export type FlightOption = {
  id: string;
  priceTotalUsd: number;
  airline: string;
  originAirport: string;
  destinationAirport: string;
  departureTime: string;
  arrivalTime: string;
  stops: number;
  duration: string;
  bookingUrl: string;
  matchExplanation: string;
};

export type AssistantTurn =
  {
    mode: "clarify" | "search";
    assistantMessage: string;
    travelPlan: TravelPlan;
    realismWarnings: string[];
  };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
