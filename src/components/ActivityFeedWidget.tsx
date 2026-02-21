import { useEffect, useState } from 'react';
import { ActivityEvent, readActivityEvents, subscribeActivityEvents } from '../lib/activity-feed';

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

export default function ActivityFeedWidget() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    setEvents(readActivityEvents().slice(0, 10));
    return subscribeActivityEvents((next) => setEvents(next.slice(0, 10)));
  }, []);

  return (
    <div className="card">
      <h2>News Feed</h2>
      <p className="note">Neue Aktionen, Leads und System-Ereignisse.</p>

      {events.length === 0 && <p className="support-empty">Noch keine Events.</p>}

      {events.length > 0 && (
        <ul className="activity-list">
          {events.map((event) => (
            <li key={event.id} className="activity-item">
              <div className="activity-head">
                <strong>{event.title}</strong>
                <span className="note">{formatDateTime(event.created_at)}</span>
              </div>
              {event.details && <p className="note">{event.details}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
