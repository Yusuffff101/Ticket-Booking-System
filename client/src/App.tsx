import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Navbar from './components/common/Navbar';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import MyBookingsPage from './pages/MyBookingsPage';
import OrganiserDashboard from './pages/OrganiserDashboard';
import ClaimOfferPage from './pages/ClaimOfferPage';
import LoginPage from './pages/LoginPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="/events/:id" element={<EventDetailPage />} />
                  <Route path="/bookings" element={<MyBookingsPage />} />
                  <Route path="/organiser" element={<OrganiserDashboard />} />
                  <Route path="/waitlist/offer/:token" element={<ClaimOfferPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  {/* Redirect unmatched routes */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-600">
                TicketVerse © {new Date().getFullYear()} — Real-time seat booking platform
              </footer>
            </div>
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
