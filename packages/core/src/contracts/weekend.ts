export type InterestTopic = {
  id: string;
  name: string;
  summary?: string;
  weight?: number;
  tags?: string[];
  vibeHints?: string[];
};

export type UserTravelProfile = {
  userId: string;
  displayName?: string;
  homeBase?: string;
  preferredLanguages: string[];
  bioSummary: string;
  interests: InterestTopic[];
};

export type TripWindow = {
  city: string;
  region?: string;
  country?: string;
  startDate: string;
  endDate: string;
  timezone?: string;
  notes?: string;
};

export type WeekendScouterRequest = {
  profile: UserTravelProfile;
  trip: TripWindow;
  deliverableFormat?: "markdown" | "json";
};

export type BudgetAllocation = {
  interestId: string;
  interestName: string;
  totalCalls: number;
  usedCalls: number;
};

export type WeekendRecommendation = {
  id: string;
  title: string;
  description: string;
  location: string;
  timeframe?: {
    start?: string;
    end?: string;
  };
  tags?: string[];
  vibe?: string;
  bookingInfo?: string;
  sources: Array<{
    label: string;
    url: string;
  }>;
};

export type WeekendScouterResult = {
  workspacePath: string;
  budget: BudgetAllocation[];
  report: string;
  recommendations: WeekendRecommendation[];
};

