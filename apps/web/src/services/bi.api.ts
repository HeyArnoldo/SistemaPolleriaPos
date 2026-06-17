import { api } from '@/lib/api';
import type {
  BICommissionsResponse,
  BIDetailResponse,
  BIQueryParams,
  BISummaryResponse,
  BITrendRow,
} from '@/types/models';

/**
 * Builds a plain params object from BIQueryParams.
 * Array fields (paymentMethodIds) are passed as-is so axios can serialize
 * them as repeated keys: paymentMethodIds=1&paymentMethodIds=2.
 */
function buildBIParams(
  params?: BIQueryParams,
): Record<string, string | number | number[]> | undefined {
  if (!params) return undefined;
  const query: Record<string, string | number | number[]> = {};
  if (params.startDate) query.startDate = params.startDate;
  if (params.endDate) query.endDate = params.endDate;
  if (params.period) query.period = params.period;
  if (params.groupBy) query.groupBy = params.groupBy;
  if (Array.isArray(params.paymentMethodIds) && params.paymentMethodIds.length > 0) {
    query.paymentMethodIds = params.paymentMethodIds;
  }
  if (params.page != null) query.page = params.page;
  if (params.limit != null) query.limit = params.limit;
  return query;
}

/**
 * paramsSerializer that repeats array params WITHOUT indices:
 * [1, 2] → "paymentMethodIds=1&paymentMethodIds=2"
 */
function repeatParamsSerializer(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }
    } else if (value != null) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join('&');
}

export const getBISummary = async (params?: BIQueryParams): Promise<BISummaryResponse> => {
  const { data } = await api.get('/bi/summary', {
    params: buildBIParams(params),
    paramsSerializer: repeatParamsSerializer,
  });
  return data as BISummaryResponse;
};

export const getBIDetail = async (params?: BIQueryParams): Promise<BIDetailResponse> => {
  const { data } = await api.get('/bi/detail', {
    params: buildBIParams(params),
    paramsSerializer: repeatParamsSerializer,
  });
  return data as BIDetailResponse;
};

export const getBICommissions = async (params?: BIQueryParams): Promise<BICommissionsResponse> => {
  const { data } = await api.get('/bi/commissions', {
    params: buildBIParams(params),
    paramsSerializer: repeatParamsSerializer,
  });
  return data as BICommissionsResponse;
};

export const getBITrends = async (params?: BIQueryParams): Promise<BITrendRow[]> => {
  const { data } = await api.get('/bi/trends', {
    params: buildBIParams(params),
    paramsSerializer: repeatParamsSerializer,
  });
  return data as BITrendRow[];
};
