export interface ProviderApiEnvelope<T> {
  get?: string;
  parameters?: Record<string, string>;
  errors?: unknown[] | Record<string, string>;
  results?: number;
  paging?: {
    current?: number;
    total?: number;
  };
  response?: T[];
}

export interface ProviderFixtureResponse {
  fixture: {
    id: number;
    date?: string;
    timestamp?: number;
    timezone?: string;
    status: {
      short?: string;
      long?: string;
      elapsed?: number | null;
      extra?: number | null;
    };
  };
  league: {
    id: number;
    name?: string;
    country?: string;
    flag?: string | null;
  };
  teams: {
    home: {
      id: number;
      name?: string;
      logo?: string;
    };
    away: {
      id: number;
      name?: string;
      logo?: string;
    };
  };
  goals: {
    home?: number | null;
    away?: number | null;
  };
}

export interface ProviderFixtureEventResponse {
  time: {
    elapsed?: number | null;
    extra?: number | null;
  };
  team?: {
    id?: number | null;
    name?: string | null;
  };
  player?: {
    id?: number | null;
    name?: string | null;
  };
  assist?: {
    id?: number | null;
    name?: string | null;
  };
  type?: string | null;
  detail?: string | null;
  comments?: string | null;
}
