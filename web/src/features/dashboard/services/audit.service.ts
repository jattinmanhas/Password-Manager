import { request } from '../../../lib/api';

export interface AuditEvent {
  id: string;
  event_type: string;
  event_data: Record<string, any>;
  created_at: string;
}

export interface AuditPaginatedResponse {
  events: AuditEvent[];
  total: number;
  has_next: boolean;
}

export interface AuditFilter {
  query?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export const auditService = {
  getLogs: async (limit: number = 20, offset: number = 0, filter?: AuditFilter): Promise<AuditPaginatedResponse> => {
    let url = `/audit?limit=${limit}&offset=${offset}`;
    if (filter) {
      if (filter.query) url += `&query=${encodeURIComponent(filter.query)}`;
      if (filter.category) url += `&category=${encodeURIComponent(filter.category)}`;
      if (filter.startDate) url += `&start_date=${filter.startDate}`;
      if (filter.endDate) url += `&end_date=${filter.endDate}`;
    }
    return request<AuditPaginatedResponse>('GET', url);
  },

  getSummary: async (): Promise<{ status: string }> => {
    return request<{ status: string }>('GET', '/audit/summary');
  },

  clearLogs: async (): Promise<void> => {
    return request<void>('DELETE', '/audit');
  }
};
