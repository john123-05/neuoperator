import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import ParksPage from './pages/ParksPage';
import AttractionsPage from './pages/AttractionsPage';
import CamerasPage from './pages/CamerasPage';
import SupportTicketKundenPage from './pages/SupportTicketKundenPage';
import IngestionCheckPage from './pages/IngestionCheckPage';
import HelpPage from './pages/HelpPage';
import WebsiteAnfragenPage from './pages/WebsiteAnfragenPage';
import SystemHealthPage from './pages/SystemHealthPage';

try {
  const savedTheme = window.localStorage.getItem('lp-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
} catch {
  // no-op when storage is unavailable
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/parks" replace />} />
          <Route path="/parks" element={<ParksPage />} />
          <Route path="/attractions" element={<AttractionsPage />} />
          <Route path="/cameras" element={<CamerasPage />} />
          <Route path="/support-ticket-kunden" element={<SupportTicketKundenPage />} />
          <Route path="/ingestion-check" element={<IngestionCheckPage />} />
          <Route path="/website-anfragen" element={<WebsiteAnfragenPage />} />
          <Route path="/system-health" element={<SystemHealthPage />} />
          <Route path="/hilfe" element={<HelpPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/parks" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
