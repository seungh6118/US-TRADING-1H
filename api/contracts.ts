import {
  DashboardData,
  SavedWatchlistItem,
  StockDetailData,
  WatchlistSummary
} from "@/lib/types";

export interface DashboardResponse {
  data: DashboardData;
}

export interface StockDetailResponse {
  data: StockDetailData;
}

export interface WatchlistResponse {
  data: WatchlistSummary;
}

export interface ToggleWatchlistResponse {
  data: SavedWatchlistItem[];
}
