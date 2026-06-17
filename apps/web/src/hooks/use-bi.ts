import { useQuery } from '@tanstack/react-query';
import * as biApi from '@/services/bi.api';
import { QUERY_KEYS } from './query-keys';
import type { BIQueryParams } from '@/types/models';

const STALE_TIME = 15_000;

export const useGetBISummary = (params?: BIQueryParams) =>
  useQuery({
    queryKey: QUERY_KEYS.biSummary(params),
    queryFn: () => biApi.getBISummary(params),
    staleTime: STALE_TIME,
  });

export const useGetBIDetail = (params?: BIQueryParams) =>
  useQuery({
    queryKey: QUERY_KEYS.biDetail(params),
    queryFn: () => biApi.getBIDetail(params),
    staleTime: STALE_TIME,
  });

export const useGetBICommissions = (params?: BIQueryParams) =>
  useQuery({
    queryKey: QUERY_KEYS.biCommissions(params),
    queryFn: () => biApi.getBICommissions(params),
    staleTime: STALE_TIME,
  });

export const useGetBITrends = (params?: BIQueryParams) =>
  useQuery({
    queryKey: QUERY_KEYS.biTrends(params),
    queryFn: () => biApi.getBITrends(params),
    staleTime: STALE_TIME,
  });
