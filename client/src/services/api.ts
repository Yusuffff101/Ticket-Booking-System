import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
          { refreshToken }
        );
        const { accessToken, refreshToken: newRefresh } = data.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefresh);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// ── Venues ──────────────────────────────────────────────────────────────────
export const venueApi = {
  list: (page = 1, limit = 20) => api.get(`/venues?page=${page}&limit=${limit}`),
  getById: (id: string) => api.get(`/venues/${id}`),
  create: (data: any) => api.post('/venues', data),
  update: (id: string, data: any) => api.patch(`/venues/${id}`, data),
};

// ── Events ──────────────────────────────────────────────────────────────────
export const eventApi = {
  list: (params?: Record<string, any>) =>
    api.get('/events', { params }),
  getById: (id: string) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  update: (id: string, data: any) => api.patch(`/events/${id}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
};

// ── Shows ───────────────────────────────────────────────────────────────────
export const showApi = {
  getById: (id: string) => api.get(`/shows/${id}`),
  getSeatMap: (showId: string) => api.get(`/shows/${showId}/seatmap`),
  create: (data: any) => api.post('/shows', data),
  delete: (id: string) => api.delete(`/shows/${id}`),
  holdSeats: (showId: string, seatIds: string[]) =>
    api.post(`/shows/${showId}/seats/hold`, { seatIds }),
  releaseSeats: (showId: string, seatIds: string[]) =>
    api.post(`/shows/${showId}/seats/release`, { seatIds }),
};

// ── Bookings ────────────────────────────────────────────────────────────────
export const bookingApi = {
  create: (data: { showId: string; showSeatIds: string[] }) =>
    api.post('/bookings', data),
  getMyBookings: () => api.get('/bookings/my'),
  getByRef: (ref: string) => api.get(`/bookings/${ref}`),
  cancel: (id: string) => api.post(`/bookings/${id}/cancel`),
};

// ── Waitlist ────────────────────────────────────────────────────────────────
export const waitlistApi = {
  join: (showId: string, category: string) =>
    api.post(`/shows/${showId}/waitlist/join`, { category }),
  getOffer: (token: string) => api.get(`/waitlist/offer/${token}`),
  acceptOffer: (token: string) => api.post(`/waitlist/offer/${token}/accept`),
  getMyWaitlists: () => api.get('/waitlist/my'),
};

// ── Organiser & Analytics ───────────────────────────────────────────────────
export const analyticsApi = {
  getDashboard: () => api.get('/organiser/dashboard'),
  getEventSummary: (eventId: string) => api.get(`/organiser/events/${eventId}/summary`),
};

