import { apiRequest } from './client';

export const adminApi = {
  featureFlags() {
    return apiRequest<{ flags: any[] }>('/admin/feature-flags');
  },

  toggleFlag(id: string, is_enabled: boolean) {
    return apiRequest<{ flag: any }>(`/admin/feature-flags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_enabled }),
    });
  },

  profiles() {
    return apiRequest<{ profiles: any[] }>('/admin/profiles');
  },
};
