export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  answer?: string;
  provider: string;
}

export interface SearchOptions {
  numResults?: number;
  recencyFilter?: "day" | "week" | "month" | "year";
  signal?: AbortSignal;
}

export interface FetchResult {
  url: string;
  title?: string;
  content: string;
}

export interface WebSearchConfig {
  exaApiKey?: string;
  anySearchApiKey?: string;
  tavilyApiKey?: string;
}
