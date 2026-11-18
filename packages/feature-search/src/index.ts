import { PropertyType } from '@nestyk/types';

export interface SearchFilterParams {
  keyword?: string;
  propertyType?: PropertyType[];
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number[];
  stationType?: 'BTS' | 'MRT';
  stationName?: string;
  nearGps?: {
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
  durationMonths?: 1 | 3 | 6 | 12;
  /** Move in now, or within 30 / 90 days. */
  moveIn?: 'now' | '30d' | '90d';
  sortBy?: 'recommended' | 'price_asc' | 'price_desc' | 'newest' | 'distance';
  page?: number;
  limit?: number;
}

export class SearchQueryBuilder {
  private params: SearchFilterParams = {};

  setKeyword(keyword: string) {
    this.params.keyword = keyword.trim();
    return this;
  }

  setPriceRange(min?: number, max?: number) {
    this.params.minPrice = min;
    this.params.maxPrice = max;
    return this;
  }

  setBedrooms(bedrooms: number[]) {
    this.params.bedrooms = bedrooms;
    return this;
  }

  setStation(stationType: 'BTS' | 'MRT', stationName: string) {
    this.params.stationType = stationType;
    this.params.stationName = stationName;
    return this;
  }

  setNearbyGps(latitude: number, longitude: number, radiusKm: number = 5) {
    this.params.nearGps = { latitude, longitude, radiusKm };
    return this;
  }

  build(): SearchFilterParams {
    return {
      page: 1,
      limit: 20,
      sortBy: 'newest',
      ...this.params,
    };
  }
}

export * from './types';
export * from './criteria';
export * from './price-range';
