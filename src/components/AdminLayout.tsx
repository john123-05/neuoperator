import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabaseBrowser } from '../lib/supabase';
import OnboardingTour from './OnboardingTour';

type ThemeMode = 'light' | 'dark';

export default function AdminLayout() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const current = document.documentElement.getAttribute('data-theme');
    return current === 'dark' ? 'dark' : 'light';
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      const { data: userData, error: userError } = await supabaseBrowser.auth.getUser();
      if (userError || !userData.user) {
        await supabaseBrowser.auth.signOut();
        navigate('/login', { replace: true });
        return;
      }

      const { data, error: adminError } = await supabaseBrowser
        .from('admin_users')
        .select('user_id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (adminError) {
        setError(adminError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Kein Admin-Zugriff für diesen User. Bitte in public.admin_users eintragen.');
        setLoading(false);
        return;
      }

      setAuthorized(true);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('lp-theme', theme);
  }, [theme]);

  const tabs = [
    { href: '/parks', label: 'Parks' },
    { href: '/attractions', label: 'Attraktionen' },
    { href: '/cameras', label: 'Kameras' },
    { href: '/website-anfragen', label: 'Website' },
    { href: '/support-ticket-kunden', label: 'Support' },
    { href: '/ingestion-check', label: 'Ingestion' },
    { href: '/system-health', label: 'Health' },
    { href: '/hilfe', label: 'Hilfe' },
  ];

  if (loading) {
    return (
      <div className="container">
        <p>Lade Admin-Sitzung...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="container">
        <h1>Admin-Zugriff verweigert</h1>
        {error && <p className="error">{error}</p>}
        <NavLink to="/login" className="note">
          Zum Login
        </NavLink>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="topbar card">
        <div className="brand">
          <p className="eyebrow">Liftpictures</p>
          <h1>Operator Dashboard</h1>
        </div>
        <div className="nav-links nav-links-single">
          {tabs.map((tab) => (
            <NavLink
              key={tab.href}
              to={tab.href}
              data-tour={tab.href === '/hilfe' ? 'nav-help' : undefined}
              className={location.pathname === tab.href ? 'active' : ''}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="secondary theme-toggle-btn"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Hellen Modus aktivieren' : 'Dunklen Modus aktivieren'}
          >
            {theme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
          </button>
          <button
            className="secondary logout-btn"
            onClick={async () => {
              await supabaseBrowser.auth.signOut();
              window.location.href = '/login';
            }}
          >
            Logout
          </button>
        </div>
      </div>
      <Outlet />
      <OnboardingTour />
    </div>
  );
}
