'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  FileText,
  Link2,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api, post } from '@/lib/client';
import {
  REGION_INFO,
  REGIONS,
  type Job,
  type Memory,
  type MemoryDetail,
  type Region,
  type Session,
} from '@/lib/types';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">ECHO / WORKSPACE</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function AuthPanel({
  canRegister,
  firstUser,
  onAuth,
}: {
  canRegister: boolean;
  firstUser: boolean;
  onAuth: (user: Session) => void;
}) {
  const [register, setRegister] = useState(firstUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setRegister(firstUser), [firstUser]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await post<{ user: Session }>(
        `auth/${register ? 'register' : 'login'}`,
        Object.fromEntries(data),
      );
      onAuth(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-panel">
      <div className="mini-icon">
        <LockKeyhole size={21} />
      </div>
      <span className="eyebrow">YOUR PRIVATE MEMORY</span>
      <h2>{register ? 'Begin your archive.' : 'Welcome back.'}</h2>
      <p className="muted">A place for the conversations, ideas and decisions you want to keep.</p>
      <form onSubmit={submit} className="stack">
        {register && (
          <label>
            Your name
            <input name="name" autoComplete="name" required maxLength={80} placeholder="Name" />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={register ? 12 : undefined}
            maxLength={200}
            autoComplete={register ? 'new-password' : 'current-password'}
            required
            placeholder={register ? 'At least 12 characters' : 'Your password'}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? <Loader2 className="spin" size={16} /> : null}
          {register ? 'Create private workspace' : 'Sign in'}
          <ArrowUpRight size={16} />
        </button>
      </form>
      {canRegister && !firstUser && (
        <button className="text-button" onClick={() => setRegister(!register)}>
          {register ? 'Already have an account? Sign in' : 'Create an account'}
        </button>
      )}
      <div className="auth-note">
        <ShieldCheck size={15} />
        <span>No accounts connected. Nothing imported without your choice.</span>
      </div>
    </div>
  );
}

export function NoteDialog({
  onClose,
  onSaved,
  initial,
}: {
  onClose: () => void;
  onSaved: (memory: MemoryDetail) => void;
  initial?: MemoryDetail;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const payload = {
        title: d.get('title'),
        content: d.get('content'),
        region: initial?.region || d.get('region'),
        tags: String(d.get('tags'))
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const memory = initial
        ? await api<MemoryDetail>(`memories/${initial.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await post<MemoryDetail>('memories', payload);
      onSaved(memory);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={initial ? 'Add a new version' : 'Keep a thought'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>
          Title
          <input
            name="title"
            placeholder="What would you like to remember?"
            defaultValue={initial?.title}
            required
            maxLength={300}
            autoFocus
          />
        </label>
        <label>
          Original note
          <textarea
            name="content"
            aria-label="Original note"
            placeholder="Write in your own words. Your original will be preserved."
            defaultValue={initial?.content}
            rows={8}
            required
            maxLength={500000}
          />
        </label>
        <div className="form-grid">
          <label>
            Primary region
            <select name="region" defaultValue={initial?.region || 'parietal'} disabled={!!initial}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {REGION_INFO[r].name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tags, separated by commas
            <input
              name="tags"
              placeholder="project, research"
              defaultValue={initial?.tags.join(', ')}
            />
          </label>
        </div>
        {initial && (
          <p className="fine-print">
            Earlier versions remain available. This memory keeps its existing anatomical anchor.
          </p>
        )}
        <p className="fine-print">
          Regions organise your knowledge metaphorically. Each saved note gets a stable point on the
          anatomical scaffold.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}Save memory
        </button>
      </form>
    </Modal>
  );
}

export function ImportDialog({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<'chatgpt' | 'claude' | 'markdown'>('chatgpt');
  const cancelled = useRef(false);
  const refresh = () =>
    api<Job[]>('jobs')
      .then(setJobs)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
    return () => {
      cancelled.current = true;
    };
  }, []);
  async function run(id: string) {
    setBusy(true);
    setError('');
    cancelled.current = false;
    try {
      let job: Job;
      do {
        job = await post<Job>(`jobs/${id}/run`);
        setStatus(`${job.processed} / ${job.total} records processed`);
        await refresh();
        onChanged();
      } while (job.status === 'running' && !cancelled.current);
      setStatus(
        cancelled.current
          ? 'Paused. Resume this import any time.'
          : `${job.added} records added · ${job.duplicates} duplicates skipped`,
      );
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setError('');
    setBusy(true);
    setStatus('Uploading and validating the original archive…');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Maximum file size is 20 MiB.');
      const job = await api<Job & { alreadyImported?: boolean }>(
        `import?filename=${encodeURIComponent(file.name)}`,
        { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' } },
      );
      if (job.status === 'completed') {
        setStatus('This exact archive is already imported. No records were duplicated.');
        setBusy(false);
        await refresh();
      } else await run(job.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function remove(job: Job) {
    if (!confirm('Delete the retained original archive? Imported memories will remain.')) return;
    try {
      await api(`jobs/${job.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title="Bring your history with you"
      onClose={() => {
        cancelled.current = true;
        onClose();
      }}
      wide
    >
      <p className="muted">
        Import an export you own. Original content, metadata and conversation branches stay attached
        to every memory.
      </p>
      <div className="segmented">
        {(['chatgpt', 'claude', 'markdown'] as const).map((p) => (
          <button key={p} className={provider === p ? 'active' : ''} onClick={() => setProvider(p)}>
            {p === 'chatgpt' ? 'ChatGPT' : p === 'claude' ? 'Claude' : 'Notes / Obsidian'}
          </button>
        ))}
      </div>
      <div className="import-guide">
        <span className="status-label">ONE-TIME IMPORT</span>
        <h3>
          {provider === 'chatgpt'
            ? 'Your ChatGPT archive'
            : provider === 'claude'
              ? 'Your Claude archive'
              : 'Your notes, connected'}
        </h3>
        <p>
          {provider === 'chatgpt'
            ? 'In ChatGPT, open Settings → Data controls → Export data. Download the archive from your export email. Upload the ZIP or its conversations.json file.'
            : provider === 'claude'
              ? 'In Claude, use Settings → Privacy → Export data. Download your export and upload the ZIP or conversations.json file. Export controls may vary by account.'
              : 'Upload a Markdown or text file, or a ZIP of your Obsidian vault. Folder paths, #tags and [[links]] are preserved. Attachments remain in the retained archive; they are not analysed.'}
        </p>
        <p className="fine-print">
          API keys do not grant access to past consumer chats. This import does not establish live
          synchronisation.
        </p>
      </div>
      <label
        className={`dropzone ${busy ? 'disabled' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) void upload(e.dataTransfer.files[0]);
        }}
      >
        <Upload size={26} />
        <strong>{busy ? 'Processing your archive…' : 'Choose a file or drop it here'}</strong>
        <span>JSON, ZIP, Markdown or text · up to 20 MiB</span>
        <input
          type="file"
          accept=".json,.zip,.md,.txt"
          disabled={busy}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      {status && (
        <p className="status-message" role="status">
          {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />} {status}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <button
          className="button secondary"
          onClick={() => {
            cancelled.current = true;
          }}
        >
          Pause after current batch
        </button>
      )}
      {jobs.length > 0 && (
        <div className="job-list">
          <h3>Import history</h3>
          {jobs.map((job) => (
            <div className="job" key={job.id}>
              <FileText size={17} />
              <div className="grow">
                <strong>{job.filename}</strong>
                <span>
                  {job.status} · {job.processed}/{job.total} processed · {job.added} added
                  {job.error ? ` · ${job.error}` : ''}
                </span>
              </div>
              {['queued', 'running', 'failed'].includes(job.status) && (
                <button className="text-button" disabled={busy} onClick={() => void run(job.id)}>
                  Resume
                </button>
              )}
              <a
                className="icon-button"
                href={`/api/jobs/${job.id}/original`}
                title="Download original archive"
                aria-label="Download original archive"
              >
                <ArrowDownToLine size={15} />
              </a>
              <button
                className="icon-button"
                onClick={() => void remove(job)}
                title="Delete retained archive"
                aria-label="Delete retained archive"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function MemoryPanel({
  memory,
  onClose,
  onNavigate,
  onChanged,
  onError,
}: {
  memory: MemoryDetail;
  onClose: () => void;
  onNavigate: (id: string, version?: number) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState<'original' | 'connections' | 'versions'>('original');
  const [branch, setBranch] = useState(false);
  const [link, setLink] = useState(false);
  const [editing, setEditing] = useState(false);
  const [targets, setTargets] = useState<Memory[]>([]);
  useEffect(() => {
    setTab('original');
    setBranch(false);
  }, [memory.id]);
  async function remove() {
    if (
      !confirm(
        'Delete this memory and its versions and connections? The original import archive, if any, is retained separately in Imports.',
      )
    )
      return;
    try {
      await api(`memories/${memory.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      onClose();
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    }
  }
  async function edge(id: string, status: 'confirmed' | 'dismissed') {
    try {
      await api(`edges/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      onNavigate(memory.id);
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    }
  }
  async function addLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await post('edges', {
        sourceId: memory.id,
        targetId: d.get('target'),
        relationship: d.get('relationship'),
        evidence: d.get('evidence'),
      });
      setLink(false);
      onNavigate(memory.id);
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify(memory.raw, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `echo-original-${memory.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="inspector-heading">
        <span className="eyebrow">MEMORY / ORIGINAL SOURCE</span>
        <button className="icon-button" aria-label="Close memory" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="memory-intro">
        <div className="memory-meta">
          <span className="region-dot" style={{ background: REGION_INFO[memory.region].color }} />
          {REGION_INFO[memory.region].name}
          <span>·</span>
          {memory.source}
        </div>
        <h2>{memory.title}</h2>
        {memory.is_demo && <span className="demo-badge">Demonstration data</span>}
        <time>
          {new Date(memory.source_at || memory.created_at).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </time>
        <div className="tags">
          {memory.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </div>
      <div className="panel-tabs">
        {(['original', 'connections', 'versions'] as const).map((t) => (
          <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>
            {t === 'connections'
              ? `Links (${memory.edges.length})`
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="inspector-scroll">
        {memory.viewed_version !== memory.version && (
          <p className="version-notice">
            Viewing source version {memory.viewed_version} of {memory.version}.{' '}
            <button className="text-button" onClick={() => onNavigate(memory.id)}>
              Return to latest
            </button>
          </p>
        )}
        {tab === 'original' && (
          <>
            <div className="extract">
              <span className="eyebrow">EXTRACTIVE PREVIEW</span>
              <p>{memory.summary}</p>
              <span className="fine-print">
                Opening text from the source. Not an AI-generated summary.
              </span>
            </div>
            {memory.messages.length > 0 ? (
              <>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={branch}
                    onChange={(e) => setBranch(e.target.checked)}
                  />
                  Include other conversation branches
                </label>
                <div className="messages">
                  {memory.messages
                    .filter((m) => branch || m.active)
                    .map((m, i) => (
                      <article key={`${m.id}-${i}`} className="message">
                        <div>
                          <span>{m.role}</span>
                          {!m.active && <small>alternate branch</small>}
                          {m.timestamp && <time>{new Date(m.timestamp).toLocaleString()}</time>}
                        </div>
                        <p>{m.content || '[Non-text message; inspect the original JSON.]'}</p>
                        {m.model && <small>{m.model}</small>}
                      </article>
                    ))}
                </div>
              </>
            ) : (
              <div className="original-content">{memory.content}</div>
            )}
            {memory.source === 'note' && memory.viewed_version === memory.version && (
              <button
                className="button secondary full"
                style={{ marginBottom: 12 }}
                onClick={() => setEditing(true)}
              >
                <Pencil size={15} />
                Edit as a new version
              </button>
            )}
            <button className="button secondary full" onClick={download}>
              <ArrowDownToLine size={15} />
              Download original JSON
            </button>
          </>
        )}
        {tab === 'connections' && (
          <>
            <p className="fine-print">
              Every link has evidence. Candidate links remain invisible in the brain until
              confirmed. Confidence is not proof.
            </p>
            {memory.edges.length === 0 && (
              <div className="quiet-empty">
                <Link2 size={24} />
                <p>No connections yet.</p>
                <span>
                  Add a connection with an explanation, or import notes with shared explicit tags
                  and links.
                </span>
              </div>
            )}
            {memory.edges.map((e) => (
              <article className="edge-card" key={e.id}>
                <div className="row">
                  <span className="status-label">{e.status}</span>
                  <span className="fine-print">{Math.round(e.confidence * 100)}% confidence</span>
                </div>
                <button
                  className="text-button link-title"
                  onClick={() => onNavigate(e.source_id === memory.id ? e.target_id : e.source_id)}
                >
                  {e.source_id === memory.id ? e.target_title : e.source_title}
                  <ArrowUpRight size={14} />
                </button>
                <strong>{e.relationship}</strong>
                <p>{e.evidence}</p>
                <div className="row">
                  {e.status === 'candidate' && (
                    <button className="button small" onClick={() => void edge(e.id, 'confirmed')}>
                      <Check size={13} />
                      Confirm link
                    </button>
                  )}
                  <button className="text-button" onClick={() => void edge(e.id, 'dismissed')}>
                    {e.status === 'candidate' ? 'Dismiss' : 'Disconnect'}
                  </button>
                </div>
              </article>
            ))}
            <button
              className="button secondary full"
              onClick={async () => {
                try {
                  const d = await api<{ memories: Memory[] }>('memories');
                  setTargets(d.memories.filter((m) => m.id !== memory.id));
                  setLink(true);
                } catch (e) {
                  onError((e as Error).message);
                }
              }}
            >
              <Plus size={15} />
              Connect another memory
            </button>
          </>
        )}
        {tab === 'versions' && (
          <>
            <p className="fine-print">
              Source versions are retained. Reimporting an identical record never creates a
              duplicate.
            </p>
            {memory.versions.map((v) => (
              <button
                className="version-row"
                key={v.version}
                onClick={() => onNavigate(memory.id, v.version)}
              >
                <div>
                  <strong>Version {v.version}</strong>
                  <span>{new Date(v.created_at).toLocaleString()}</span>
                </div>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </>
        )}
      </div>
      <div className="inspector-footer">
        <span>
          <LockKeyhole size={12} /> Private to your workspace
        </span>
        <button
          className="icon-button danger"
          onClick={() => void remove()}
          aria-label="Delete memory"
          title="Delete memory"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {link && (
        <Modal title="Make a meaningful connection" onClose={() => setLink(false)}>
          <form className="stack" onSubmit={addLink}>
            <label>
              Related memory
              <select name="target" required>
                {targets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Relationship
              <input
                name="relationship"
                required
                maxLength={80}
                placeholder="supports, develops, contradicts…"
              />
            </label>
            <label>
              Evidence or explanation
              <textarea
                name="evidence"
                required
                minLength={5}
                maxLength={2000}
                rows={4}
                placeholder="Why do these memories belong together?"
              />
            </label>
            <button className="button primary" disabled={!targets.length}>
              Save connection
            </button>
          </form>
        </Modal>
      )}
      {editing && (
        <NoteDialog
          initial={memory}
          onClose={() => setEditing(false)}
          onSaved={() => {
            onNavigate(memory.id);
            onChanged();
          }}
        />
      )}
    </>
  );
}

export type Settings = {
  providers: { id: string; name: string; configured: boolean; model: string | null }[];
  storage: string;
  embeddingConfigured: boolean;
  limits: { uploadMiB: number; memoriesPerImport: number };
};
export function SettingsDialog({
  settings,
  quality,
  setQuality,
  reducedMotion,
  setReducedMotion,
  onClose,
  onDeleted,
}: {
  settings: Settings | null;
  quality: 'low' | 'balanced' | 'high';
  setQuality: (q: 'low' | 'balanced' | 'high') => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  async function remove(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await api('account', { method: 'DELETE', body: JSON.stringify(Object.fromEntries(d)) });
      onDeleted();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title="Workspace settings" onClose={onClose} wide>
      <div className="settings-section">
        <h3>Rendering</h3>
        <div className="setting-row">
          <div>
            <strong>Graphics quality</strong>
            <p>Adjust anatomical point density and display resolution.</p>
          </div>
          <select
            aria-label="Graphics quality"
            value={quality}
            onChange={(e) => setQuality(e.target.value as typeof quality)}
          >
            <option value="low">Low</option>
            <option value="balanced">Balanced</option>
            <option value="high">High</option>
          </select>
        </div>
        <label className="setting-row check-label">
          <div>
            <strong>Reduced motion</strong>
            <p>Skip camera animation and damped movement.</p>
          </div>
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
          />
        </label>
      </div>
      <div className="settings-section">
        <h3>AI providers</h3>
        <p className="fine-print">
          Source search works without a model. Provider requests send your question and retrieved
          excerpts only after your approval.
        </p>
        {settings?.providers.map((p) => (
          <div className="setting-row" key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <p>{p.model || 'No model configured'}</p>
            </div>
            <span className={`status-pill ${p.configured ? 'connected' : ''}`}>
              {p.configured ? 'Configured · not yet verified' : 'Not connected'}
            </span>
          </div>
        ))}
        <p className="fine-print">
          Configure server-side API credentials and model IDs using the deployment guide. Consumer
          subscriptions do not include API access. No credentials are entered into this page.
        </p>
      </div>
      <div className="settings-section">
        <h3>Data & ownership</h3>
        <p className="muted">
          {settings?.storage}. This development instance has no external storage or accounts
          connected.
        </p>
        <a href="/api/export" className="button secondary">
          <ArrowDownToLine size={15} />
          Export memories & original records
        </a>
        <p className="fine-print">
          Retained upload archives are downloaded or deleted separately in Import history.
        </p>
        <button className="text-button danger" onClick={() => setDeleting(!deleting)}>
          Delete account and workspace
        </button>
        {deleting && (
          <form className="stack danger-zone" onSubmit={remove}>
            <p>
              This permanently deletes your account, memories, versions, archives, graph and
              sessions from this instance. Deployment backups follow their own retention policy.
            </p>
            <label>
              Type DELETE MY WORKSPACE
              <input name="confirm" required pattern="DELETE MY WORKSPACE" />
            </label>
            <label>
              Confirm your password
              <input type="password" name="password" required autoComplete="current-password" />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="button destructive">Permanently delete workspace</button>
          </form>
        )}
      </div>
      <div className="settings-section">
        <h3>Anatomical provenance</h3>
        <p className="muted">
          FreeSurfer fsaverage5 · Desikan–Killiany parcels · 20,484 vertices. Original surface
          topology preserved. Cortex only; no cerebellum or brainstem. Group-average anatomy, not a
          clinical model.
        </p>
        <div className="row">
          <a className="text-button" href="/anatomy/manifest.json" target="_blank" rel="noreferrer">
            Asset manifest
            <ArrowUpRight size={13} />
          </a>
          <a
            className="text-button"
            href="/licenses/FREESURFER.txt"
            target="_blank"
            rel="noreferrer"
          >
            FreeSurfer licence
            <ArrowUpRight size={13} />
          </a>
          <a className="text-button" href="/licenses/CBIG.txt" target="_blank" rel="noreferrer">
            CBIG licence
            <ArrowUpRight size={13} />
          </a>
        </div>
        <p className="fine-print">
          Lobe colours are a software metaphor. Cingulate and insular parcels remain neutral. The
          paracentral parcel is grouped with parietal cortex.
        </p>
      </div>
      <div className="settings-section">
        <h3>Integration availability</h3>
        <p className="muted">
          Historical ChatGPT, Claude and Markdown imports are available. Live voice, meeting
          transcription, Google Calendar, Gmail, Drive and Notion OAuth are not implemented in this
          release.
        </p>
      </div>
    </Modal>
  );
}
