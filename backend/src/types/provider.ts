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
    referee?: string | null;
    date?: string;
    timestamp?: number;
    timezone?: string;
    periods?: {
      first?: number | null;
      second?: number | null;
    };
    venue?: {
      id?: number | null;
      name?: string | null;
      city?: string | null;
    };
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
    logo?: string | null;
    flag?: string | null;
    season?: number;
    round?: string | null;
    standings?: boolean;
  };
  teams: {
    home: {
      id: number;
      name?: string;
      logo?: string;
      winner?: boolean | null;
    };
    away: {
      id: number;
      name?: string;
      logo?: string;
      winner?: boolean | null;
    };
  };
  goals: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    halftime?: {
      home?: number | null;
      away?: number | null;
    };
    fulltime?: {
      home?: number | null;
      away?: number | null;
    };
    extratime?: {
      home?: number | null;
      away?: number | null;
    };
    penalty?: {
      home?: number | null;
      away?: number | null;
    };
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

export interface ProviderFixtureStatisticValue {
  type?: string | null;
  value?: string | number | null;
}

export interface ProviderFixtureStatisticsResponse {
  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
  };
  statistics?: ProviderFixtureStatisticValue[] | null;
}

export interface ProviderLeagueCoverageSeason {
  year?: number;
  current?: boolean;
  coverage?: {
    fixtures?: {
      events?: boolean;
      lineups?: boolean;
      statistics_fixtures?: boolean;
      statistics_players?: boolean;
    };
    standings?: boolean;
    players?: boolean;
    predictions?: boolean;
    odds?: boolean;
  };
}

export interface ProviderLeagueResponse {
  league?: {
    id?: number;
    name?: string | null;
    type?: string | null;
    logo?: string | null;
  };
  country?: {
    name?: string | null;
    code?: string | null;
    flag?: string | null;
  };
  seasons?: ProviderLeagueCoverageSeason[] | null;
}

export interface ProviderFixtureLineupPlayer {
  id?: number | null;
  name?: string | null;
  number?: number | null;
  pos?: string | null;
  grid?: string | null;
}

export interface ProviderFixtureLineupResponse {
  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
    colors?: {
      player?: {
        primary?: string | null;
        number?: string | null;
        border?: string | null;
      };
      goalkeeper?: {
        primary?: string | null;
        number?: string | null;
        border?: string | null;
      };
    };
  };
  formation?: string | null;
  startXI?: Array<{
    player?: ProviderFixtureLineupPlayer | null;
  }> | null;
  substitutes?: Array<{
    player?: ProviderFixtureLineupPlayer | null;
  }> | null;
  coach?: {
    id?: number | null;
    name?: string | null;
    photo?: string | null;
  } | null;
}

export interface ProviderFixturePlayerStatisticResponse {
  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
    update?: string | null;
  };
  players?: Array<{
    player?: {
      id?: number | null;
      name?: string | null;
      photo?: string | null;
    } | null;
    statistics?: Array<{
      games?: {
        minutes?: number | null;
        number?: number | null;
        position?: string | null;
        rating?: string | null;
        captain?: boolean | null;
        substitute?: boolean | null;
      };
      offsides?: number | null;
      shots?: {
        total?: number | null;
        on?: number | null;
      };
      goals?: {
        total?: number | null;
        conceded?: number | null;
        assists?: number | null;
        saves?: number | null;
      };
      passes?: {
        total?: number | null;
        key?: number | null;
        accuracy?: string | null;
      };
      tackles?: {
        total?: number | null;
        blocks?: number | null;
        interceptions?: number | null;
      };
      duels?: {
        total?: number | null;
        won?: number | null;
      };
      dribbles?: {
        attempts?: number | null;
        success?: number | null;
        past?: number | null;
      };
      fouls?: {
        drawn?: number | null;
        committed?: number | null;
      };
      cards?: {
        yellow?: number | null;
        red?: number | null;
      };
      penalty?: {
        won?: number | null;
        committed?: number | null;
        scored?: number | null;
        missed?: number | null;
        saved?: number | null;
      };
    }> | null;
  }> | null;
}

export interface ProviderStandingRow {
  rank?: number | null;
  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
  } | null;
  points?: number | null;
  goalsDiff?: number | null;
  group?: string | null;
  form?: string | null;
  status?: string | null;
  description?: string | null;
  all?: {
    played?: number | null;
    win?: number | null;
    draw?: number | null;
    lose?: number | null;
    goals?: {
      for?: number | null;
      against?: number | null;
    };
  } | null;
  home?: {
    played?: number | null;
    win?: number | null;
    draw?: number | null;
    lose?: number | null;
    goals?: {
      for?: number | null;
      against?: number | null;
    };
  } | null;
  away?: {
    played?: number | null;
    win?: number | null;
    draw?: number | null;
    lose?: number | null;
    goals?: {
      for?: number | null;
      against?: number | null;
    };
  } | null;
  update?: string | null;
}

export interface ProviderStandingsResponse {
  league?: {
    id?: number | null;
    name?: string | null;
    country?: string | null;
    logo?: string | null;
    flag?: string | null;
    season?: number | null;
    standings?: ProviderStandingRow[][] | null;
  } | null;
}

export interface ProviderTeamStatisticsResponse {
  league?: {
    id?: number | null;
    name?: string | null;
    country?: string | null;
    logo?: string | null;
    flag?: string | null;
    season?: number | null;
  } | null;
  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
  } | null;
  form?: string | null;
  fixtures?: {
    played?: {
      total?: number | null;
      home?: number | null;
      away?: number | null;
    };
    wins?: {
      total?: number | null;
      home?: number | null;
      away?: number | null;
    };
    draws?: {
      total?: number | null;
      home?: number | null;
      away?: number | null;
    };
    loses?: {
      total?: number | null;
      home?: number | null;
      away?: number | null;
    };
  } | null;
  goals?: {
    for?: {
      total?: {
        total?: number | null;
        home?: number | null;
        away?: number | null;
      };
    };
    against?: {
      total?: {
        total?: number | null;
        home?: number | null;
        away?: number | null;
      };
    };
  } | null;
  clean_sheet?: {
    total?: number | null;
    home?: number | null;
    away?: number | null;
  } | null;
  failed_to_score?: {
    total?: number | null;
    home?: number | null;
    away?: number | null;
  } | null;
  biggest?: {
    streak?: {
      wins?: number | null;
      draws?: number | null;
      loses?: number | null;
    } | null;
    wins?: {
      home?: string | null;
      away?: string | null;
    } | null;
    loses?: {
      home?: string | null;
      away?: string | null;
    } | null;
  } | null;
}

export interface ProviderPredictionResponse {
  predictions?: {
    winner?: {
      id?: number | null;
      name?: string | null;
      comment?: string | null;
    } | null;
    win_or_draw?: boolean | null;
    under_over?: string | null;
    goals?: {
      home?: string | null;
      away?: string | null;
    } | null;
    advice?: string | null;
    percent?: {
      home?: string | null;
      draw?: string | null;
      away?: string | null;
    } | null;
  } | null;
  comparison?: Record<string, string | null> | null;
  teams?: {
    home?: {
      id?: number | null;
      name?: string | null;
      logo?: string | null;
      last_5?: {
        form?: string | null;
        att?: string | null;
        def?: string | null;
        goals?: {
          for?: {
            total?: number | null;
            average?: string | null;
          } | null;
          against?: {
            total?: number | null;
            average?: string | null;
          } | null;
        } | null;
      } | null;
      league?: {
        form?: string | null;
      } | null;
    } | null;
    away?: {
      id?: number | null;
      name?: string | null;
      logo?: string | null;
      last_5?: {
        form?: string | null;
        att?: string | null;
        def?: string | null;
        goals?: {
          for?: {
            total?: number | null;
            average?: string | null;
          } | null;
          against?: {
            total?: number | null;
            average?: string | null;
          } | null;
        } | null;
      } | null;
      league?: {
        form?: string | null;
      } | null;
    } | null;
  } | null;
}
