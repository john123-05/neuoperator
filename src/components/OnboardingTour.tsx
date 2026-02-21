import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

type TourStep = {
  id: string;
  title: string;
  text: string;
  selector?: string;
};

type Rect = { top: number; left: number; width: number; height: number };

const TOUR_DISABLED_KEY = 'lp-onboarding-tour-disabled';
const TOUR_SESSION_KEY = 'lp-onboarding-tour-session-shown';

const steps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen im Liftpictures Operator Dashboard',
    text: 'Ich zeige dir kurz die wichtigsten Funktionen. Mit "Weiter" gehst du Schritt fuer Schritt durch die wichtigsten Bereiche.',
  },
  {
    id: 'parks',
    selector: '#tour-park-create',
    title: 'Park anlegen',
    text: 'Hier legst du neue Parks an. Name + Slug werden fuer Routing und Datenzuordnung verwendet.',
  },
  {
    id: 'prefix',
    selector: '#tour-prefix-map',
    title: 'Path Prefix Mapping',
    text: 'Der Prefix verbindet Upload-Pfade mit einem Park. So landen neue Bilder im richtigen Park.',
  },
  {
    id: 'support',
    selector: '#tour-support-preview',
    title: 'Support Ticket Kunden',
    text: 'Diese Vorschau zeigt neue synchronisierte Tickets. Von hier springst du direkt in die Detailansicht.',
  },
  {
    id: 'news',
    selector: '#tour-news-feed',
    title: 'News Feed',
    text: 'Im News Feed siehst du neue Events wie neue Anfragen, neue Tickets oder geaenderte Zuordnungen.',
  },
  {
    id: 'help',
    selector: '[data-tour=\"nav-help\"]',
    title: 'Hilfe Bereich',
    text: 'In der Navigation findest du unter Hilfe die FAQ mit Suche und Loesungswegen zu den wichtigsten Themen.',
  },
  {
    id: 'finish',
    title: 'Fertig',
    text: 'Du kannst jederzeit wieder starten, aber wenn du diese Tour nicht mehr sehen willst, klicke auf "Nicht mehr anzeigen".',
  },
];

function getStepRect(selector?: string): Rect | null {
  if (!selector) return null;
  const element = document.querySelector(selector);
  if (!element) return null;
  const r = element.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function OnboardingTour() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = useMemo(() => steps[index], [index]);
  const isLast = index === steps.length - 1;

  useEffect(() => {
    const disabled = window.localStorage.getItem(TOUR_DISABLED_KEY) === 'true';
    const shownInSession = window.sessionStorage.getItem(TOUR_SESSION_KEY) === 'true';
    if (disabled || shownInSession) return;
    if (location.pathname !== '/parks') return;

    setVisible(true);
    window.sessionStorage.setItem(TOUR_SESSION_KEY, 'true');
  }, [location.pathname]);

  useEffect(() => {
    if (!visible) return;

    const update = () => setRect(getStepRect(step.selector));
    update();

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step.selector, visible]);

  if (!visible) return null;

  const onClose = () => setVisible(false);

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Dashboard Walkthrough">
      {rect && (
        <div
          className="tour-spotlight"
          style={{
            top: Math.max(rect.top - 8, 8),
            left: Math.max(rect.left - 8, 8),
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      )}

      <div className="tour-panel card">
        <p className="eyebrow">Walkthrough</p>
        <h3>{step.title}</h3>
        <p className="note">{step.text}</p>

        <div className="tour-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Schliessen
          </button>

          {index > 0 && !isLast && (
            <button type="button" className="secondary" onClick={() => setIndex((v) => Math.max(0, v - 1))}>
              Zurueck
            </button>
          )}

          {!isLast && (
            <button type="button" onClick={() => setIndex((v) => Math.min(steps.length - 1, v + 1))}>
              Weiter
            </button>
          )}

          {isLast && (
            <>
              <button type="button" onClick={onClose}>
                Tour beenden
              </button>
              <button
                type="button"
                className="tour-optout-btn"
                onClick={() => {
                  window.localStorage.setItem(TOUR_DISABLED_KEY, 'true');
                  onClose();
                }}
              >
                Nicht mehr anzeigen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
