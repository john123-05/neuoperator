import { FormEvent, useEffect, useState } from 'react';
import { appendActivityEvent } from '../lib/activity-feed';

type WebsiteRequest = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  website: string;
  note: string;
};

const STORAGE_KEY = 'lp-website-requests-v1';

function readRequests(): WebsiteRequest[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function WebsiteAnfragenPage() {
  const [rows, setRows] = useState<WebsiteRequest[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setRows(readRequests());
  }, []);

  const onAdd = (e: FormEvent) => {
    e.preventDefault();

    const next: WebsiteRequest = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      name: name.trim(),
      email: email.trim(),
      website: website.trim(),
      note: note.trim(),
    };

    const merged = [next, ...rows].slice(0, 300);
    setRows(merged);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    setName('');
    setEmail('');
    setWebsite('');
    setNote('');

    appendActivityEvent({
      title: 'Neue Website-Anfrage',
      details: `${next.name} (${next.email})`,
      level: 'success',
    });
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2>Website Anfragen</h2>
        <p className="note">Manuell erfassbare Liste für Website-Anfragen.</p>
        <form className="grid two" onSubmit={onAdd}>
          <div>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label>E-Mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Website</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label>Notiz</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kurze Anmerkung" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit">Anfrage hinzufügen</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Tabelle: Website Anfragen</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Website</th>
                <th>Notiz</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.website || '-'}</td>
                  <td>{row.note || '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="note">Noch keine Einträge.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card coming-soon-card">
        <h3>Tabelle: Email Leads</h3>
        <p className="note">Coming soon: automatische Erfassung, Status-Workflow, Import/Export und Duplikat-Erkennung.</p>
        <span className="coming-soon-pill">Coming Soon</span>
      </div>
    </div>
  );
}
