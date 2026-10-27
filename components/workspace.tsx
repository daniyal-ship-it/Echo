'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  Compass,
  Database,
  FileText,
  Focus,
  Layers,
  Loader2,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { api, post } from '@/lib/client';
import {
  REGION_INFO,
  REGIONS,
  type Citation,
  type Graph,
  type GraphNode,
  type Memory,
  type MemoryDetail,
  type Region,
  type Session,
} from '@/lib/types';
import {
  AuthPanel,
  ImportDialog,
  MemoryPanel,
  Modal,
  NoteDialog,
  SettingsDialog,
  type Settings,
} from './panels';
import type { ViewCommand } from './brain';
const Brain = dynamic(() => import('./brain'), {
  ssr: false,
  loading: () => (
    <div className="scene-fallback">
      <span>Preparing anatomical view…</span>
    </div>
  ),
});
const EMPTY: Graph = { nodes: [], edges: [], total: 0, counts: {}, aggregated: false };
type Retrieval = {
  question: string;
  citations: Citation[];
  outputs?: {
    provider: string;
    model: string;
    text: string;
    inputTokens: number;
    outputTokens: number;
  }[];
  tokens?: number;
};

export default function Workspace() {
  const [user, setUser] = useState<Session | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [canRegister, setCanRegister] = useState(false);
  const [firstUser, setFirstUser] = useState(false);
  const [graph, setGraph] = useState<Graph>(EMPTY);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MemoryDetail | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [command, setCommand] = useState<ViewCommand>({ key: 0, type: 'reset' });
  const [tab, setTab] = useState<'brain' | 'library'>('brain');
  const [modal, setModal] = useState<'note' | 'imports' | 'settings' | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [tag, setTag] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filters, setFilters] = useState(false);
  const [quality, setQuality] = useState<'low' | 'balanced' | 'high'>('balanced');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [question, setQuestion] = useState('');
  const [retrieval, setRetrieval] = useState<Retrieval | null>(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState('search');
  const [consent, setConsent] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const controller = useRef<AbortController | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRequest = useRef(0);
  const graphRequest = useRef(0);
  const libraryRequest = useRef(0);
  const activeWorkspace = useRef<string | null>(null);
  activeWorkspace.current = user?.workspaceId ?? null;
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 7000);
  }, []);
  const move = useCallback(
    (cmd: Omit<ViewCommand, 'key'>) => setCommand((c) => ({ ...cmd, key: c.key + 1 })),
    [],
  );
  useEffect(() => {
    api<{ user: Session | null; canRegister: boolean; firstUser: boolean }>('auth/status')
      .then((r) => {
        setUser(r.user);
        setCanRegister(r.canRegister);
        setFirstUser(r.firstUser);
      })
      .catch((e) => notify(e.message))
      .finally(() => setAuthLoaded(true));
    setReducedMotion(
      localStorage.getItem('echo-reduced-motion') === 'true' ||
        matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    const saved = localStorage.getItem('echo-quality');
    if (saved === 'low' || saved === 'balanced' || saved === 'high') setQuality(saved);
    else if (window.innerWidth < 700) setQuality('low');
    return () => {
      controller.current?.abort();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [notify]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(0);
    }, 220);
    return () => clearTimeout(timer);
  }, [search]);
  const refreshGraph = useCallback(async () => {
    if (!user) return;
    const request = ++graphRequest.current;
    try {
      const result = await api<Graph>(
        `graph?${new URLSearchParams({ region: region || '', q: query, source, tag, from, to })}`,
      );
      if (request === graphRequest.current && activeWorkspace.current === user.workspaceId)
        setGraph(result);
    } catch (e) {
      notify((e as Error).message);
    }
  }, [user, region, query, source, tag, from, to, notify]);
  const refreshLibrary = useCallback(async () => {
    if (!user) return;
    const request = ++libraryRequest.current;
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      region: region || '',
      source,
      tag,
      from,
      to,
    });
    try {
      const r = await api<{ memories: Memory[]; total: number }>(`memories?${params}`);
      if (request !== libraryRequest.current || activeWorkspace.current !== user.workspaceId)
        return;
      setMemories(r.memories);
      setTotal(r.total);
    } catch (e) {
      notify((e as Error).message);
    }
  }, [user, query, page, region, source, tag, from, to, notify]);
  useEffect(() => {
    void refreshGraph();
  }, [refreshGraph]);
  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);
  useEffect(() => {
    if (user)
      api<Settings>('settings')
        .then((result) => {
          if (activeWorkspace.current === user.workspaceId) setSettings(result);
        })
        .catch((e) => notify(e.message));
  }, [user, notify]);
  function refresh() {
    void refreshGraph();
    void refreshLibrary();
  }
  async function openMemory(id: string, version?: number) {
    const req = ++selectedRequest.current;
    try {
      const m = await api<MemoryDetail>(`memories/${id}${version ? `?version=${version}` : ''}`);
      if (req !== selectedRequest.current || activeWorkspace.current !== user?.workspaceId) return;
      setSelected(m);
      setRetrieval(null);
      setMobilePanel(true);
      move({ type: 'memory', position: m.position });
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function focusRegion(value: Region | null) {
    setRegion(value);
    setPage(0);
    move(value ? { type: 'region', region: value } : { type: 'reset' });
  }
  function chooseNode(node: GraphNode) {
    if (node.count > 1) {
      focusRegion(node.region);
      setTab('library');
      notify(
        `${node.count} records in this spatial cluster. Browse individual memories in the library.`,
      );
    } else void openMemory(node.id);
  }
  function onSaved(memory: MemoryDetail) {
    if (!user || activeWorkspace.current !== user.workspaceId) return;
    setSelected(memory);
    setRetrieval(null);
    setMobilePanel(true);
    move({ type: 'memory', position: memory.position });
    refresh();
    notify('Memory saved. Its original and position are preserved.');
  }
  async function createDemo() {
    try {
      onSaved(await post<MemoryDetail>('demo'));
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function logout() {
    try {
      await post('auth/logout');
      clearWorkspace();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function clearWorkspace() {
    activeWorkspace.current = null;
    selectedRequest.current++;
    graphRequest.current++;
    libraryRequest.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setUser(null);
    setGraph(EMPTY);
    setMemories([]);
    setTotal(0);
    setSelected(null);
    setRetrieval(null);
    setSettings(null);
    setModal(null);
    setConsent(false);
    setQuestion('');
    setPendingQuestion('');
    setModel('search');
    setRegion(null);
    setSearch('');
    setQuery('');
    setPage(0);
    setSource('');
    setTag('');
    setFrom('');
    setTo('');
    setFilters(false);
    setToast('');
    move({ type: 'reset' });
  }
  async function ask(e?: FormEvent) {
    e?.preventDefault();
    if (!question.trim() || busy) return;
    if (!user) {
      setMobilePanel(true);
      notify('Sign in to search your private memory.');
      return;
    }
    if (model !== 'search') {
      setPendingQuestion(question.trim());
      setConsent(true);
      return;
    }
    await runQuestion(question.trim());
  }
  async function runQuestion(value: string, providerConsent = false) {
    setBusy(true);
    setQuestion('');
    setSelected(null);
    setMobilePanel(true);
    const requestController = new AbortController();
    controller.current = requestController;
    try {
      if (providerConsent) {
        const r = await api<{
          citations: Citation[];
          outputs: NonNullable<Retrieval['outputs']>;
          tokens: number;
        }>('assistant', {
          method: 'POST',
          body: JSON.stringify({
            question: value,
            providers: model === 'compare' ? ['openai', 'anthropic'] : [model],
            consent: true,
            synthesise: model === 'compare',
          }),
          signal: requestController.signal,
        });
        if (activeWorkspace.current !== user?.workspaceId) return;
        setRetrieval({ question: value, ...r });
        refresh();
      } else {
        const r = await post<{ citations: Citation[] }>('retrieve', { question: value });
        if (activeWorkspace.current !== user?.workspaceId) return;
        setRetrieval({ question: value, citations: r.citations });
        if (r.citations[0]) {
          const node = graph.nodes.find((n) => n.id === r.citations[0].id);
          if (node) move({ type: 'memory', position: node.position });
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') notify((e as Error).message);
    } finally {
      if (controller.current === requestController) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  function changeQuality(q: typeof quality) {
    setQuality(q);
    localStorage.setItem('echo-quality', q);
  }
  function changeMotion(v: boolean) {
    setReducedMotion(v);
    localStorage.setItem('echo-reduced-motion', String(v));
  }
  const selectedId = selected?.id ?? retrieval?.citations[0]?.id ?? null;
  const hasProvider = settings?.providers.some((p) => p.configured);

  return (
    <div
      className={`app-shell ${immersive ? 'immersive' : ''} ${mobileNav ? 'nav-open' : ''} ${mobilePanel ? 'panel-open' : ''}`}
    >
      <header className="topbar">
        <div className="brand">
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Toggle navigation"
          >
            <Menu size={19} />
          </button>
          <div className="brand-icon">
            <BrainCircuit size={25} strokeWidth={1.2} />
          </div>
          <span>ECHO</span>
          <span className="brand-divider" />
          <span className="brand-caption">THE HOLOGRAPHIC BRAIN</span>
        </div>
        <div className="topbar-center">
          <span className={`live-dot ${user ? 'active' : ''}`} />
          {user ? 'Private workspace' : 'Personal memory system'}
        </div>
        <div className="topbar-actions">
          {user ? (
            <>
              <span className="user-name">{user.name}</span>
              <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            </>
          ) : (
            <span className="local-badge">LOCAL DEVELOPMENT</span>
          )}
          <button
            className="icon-button"
            aria-label={immersive ? 'Exit immersive view' : 'Enter immersive view'}
            title={immersive ? 'Exit immersive view' : 'Enter immersive view'}
            onClick={() => setImmersive(!immersive)}
          >
            {immersive ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>
      <aside className="sidebar">
        <div className="workspace-label">
          <span className="eyebrow">WORKSPACE</span>
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          >
            <X size={16} />
          </button>
        </div>
        <nav>
          <button
            className={`nav-item ${tab === 'brain' ? 'active' : ''}`}
            onClick={() => {
              setTab('brain');
              setMobileNav(false);
            }}
          >
            <BrainCircuit size={18} />
            <span>Memory atlas</span>
            <ChevronRight size={14} />
          </button>
          <button
            className={`nav-item ${tab === 'library' ? 'active' : ''}`}
            onClick={() => {
              setTab('library');
              setMobileNav(false);
            }}
          >
            <BookOpen size={18} />
            <span>All memories</span>
            <span className="nav-count">{graph.total}</span>
          </button>
          <button
            className="nav-item"
            onClick={() =>
              user
                ? setModal('imports')
                : (setMobilePanel(true), notify('Create your workspace to import memories.'))
            }
          >
            <Upload size={17} />
            <span>Import history</span>
          </button>
        </nav>
        <div className="sidebar-section">
          <div className="section-label">
            <span className="eyebrow">CEREBRAL REGIONS</span>
            <span className="tiny-label">04</span>
          </div>
          {REGIONS.map((r) => (
            <button
              className={`region-row ${region === r ? 'active' : ''}`}
              onClick={() => focusRegion(region === r ? null : r)}
              key={r}
            >
              <span className="region-dot" style={{ background: REGION_INFO[r].color }} />
              <span>{REGION_INFO[r].name}</span>
              <span className="region-count">{graph.counts[r] || 0}</span>
            </button>
          ))}
          <p className="sidebar-hint">Four perspectives on your knowledge.</p>
        </div>
        <div className="sidebar-section memory-list-section">
          <div className="section-label">
            <span className="eyebrow">
              {tab === 'library' ? 'MEMORY LIBRARY' : 'RECENT MEMORIES'}
            </span>
            <button
              className="icon-button"
              aria-label="New memory"
              onClick={() =>
                user
                  ? setModal('note')
                  : (setMobilePanel(true), notify('Create a workspace to save a memory.'))
              }
            >
              <Plus size={15} />
            </button>
          </div>
          {user && (
            <div className="sidebar-search">
              <Search size={13} />
              <input
                aria-label="Search memory library"
                placeholder="Find a memory…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className={`icon-button ${filters ? 'selected' : ''}`}
                aria-label="Filter memories"
                onClick={() => setFilters(!filters)}
              >
                <SlidersHorizontal size={13} />
              </button>
            </div>
          )}
          {filters && (
            <div className="filters">
              <label>
                Source
                <select
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All sources</option>
                  {['note', 'chatgpt', 'claude', 'markdown', 'assistant', 'demo'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Tag
                <input
                  value={tag}
                  onChange={(e) => {
                    setTag(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Exact tag"
                />
              </label>
              <label>
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <button
                className="text-button"
                onClick={() => {
                  setSource('');
                  setTag('');
                  setFrom('');
                  setTo('');
                  setSearch('');
                  focusRegion(null);
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          <div className="memory-list">
            {memories.slice(0, tab === 'brain' ? 7 : 50).map((m) => (
              <button
                className={`memory-item ${selected?.id === m.id ? 'selected' : ''}`}
                onClick={() => {
                  void openMemory(m.id);
                  setMobileNav(false);
                }}
                key={m.id}
              >
                <FileText size={15} style={{ color: REGION_INFO[m.region].color }} />
                <div>
                  <strong>{m.title}</strong>
                  <span>
                    {m.is_demo ? 'Demonstration' : m.source} ·{' '}
                    {new Date(m.source_at || m.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <ArrowUpRight size={12} />
              </button>
            ))}
            {!memories.length && (
              <div className="sidebar-empty">
                <div className="empty-glyph">
                  <FileText size={22} strokeWidth={1} />
                </div>
                <p>
                  {query || region || source || tag
                    ? 'No matching memories'
                    : 'Your story starts here'}
                </p>
                <span>
                  {user
                    ? 'Keep a thought or import your conversations.'
                    : 'Your memories will appear here once you create a workspace.'}
                </span>
              </div>
            )}
          </div>
          {tab === 'library' && total > 50 && (
            <div className="pagination">
              <button
                className="icon-button"
                aria-label="Previous page"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
              >
                <ArrowLeft size={15} />
              </button>
              <span>
                {page * 50 + 1}–{Math.min((page + 1) * 50, total)} / {total}
              </span>
              <button
                className="icon-button"
                aria-label="Next page"
                disabled={(page + 1) * 50 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          {user && (
            <button className="button secondary full" onClick={() => setModal('note')}>
              <Plus size={15} />
              New memory
            </button>
          )}
          <div className="row">
            <button
              className="text-button"
              onClick={() =>
                user ? setModal('settings') : notify('Sign in to open workspace settings.')
              }
            >
              <Settings2 size={15} />
              Settings
            </button>
            {user && (
              <button
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => void logout()}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <main className="viewport">
        <div className="viewport-top">
          <div className="breadcrumb">
            <button
              onClick={() => {
                focusRegion(null);
                setSelected(null);
                setRetrieval(null);
              }}
            >
              Memory atlas
            </button>
            <ChevronRight size={12} />
            <span>
              {selected
                ? 'Individual memory'
                : region
                  ? `${REGION_INFO[region].name} region`
                  : 'Whole brain'}
            </span>
          </div>
          <div className="view-status">
            <span className={ready ? 'live-dot active' : 'live-dot'} />
            {ready ? '3D ANATOMICAL VIEW' : 'LOADING GEOMETRY'}
          </div>
        </div>
        <div className="scene-title">
          <span className="eyebrow">YOUR KNOWLEDGE, IN PERSPECTIVE</span>
          <h1>{region ? `${REGION_INFO[region].name} cortex` : 'Memory atlas'}</h1>
          <p>{region ? REGION_INFO[region].meaning : 'A living archive. An anatomical canvas.'}</p>
        </div>
        <div className="brain-canvas" data-testid="brain-viewport">
          <Brain
            graph={graph}
            selected={selectedId}
            region={region}
            command={command}
            quality={quality}
            reducedMotion={reducedMotion}
            onSelect={chooseNode}
            onRegion={focusRegion}
            onReady={() => setReady(true)}
          />
        </div>
        <div className="canvas-tools">
          <button
            className="icon-button"
            aria-label="Reset brain view"
            title="Reset view"
            onClick={() => {
              move({ type: 'reset' });
              setRegion(null);
            }}
          >
            <RotateCcw size={17} />
          </button>
          <span />
          <button
            className="view-button"
            title="Anterior view"
            aria-label="Anterior view"
            onClick={() => move({ type: 'front' })}
          >
            A
          </button>
          <button
            className="view-button"
            title="Left lateral view"
            aria-label="Left lateral view"
            onClick={() => move({ type: 'side' })}
          >
            L
          </button>
          <button
            className="view-button"
            title="Three-quarter view"
            aria-label="Three-quarter view"
            onClick={() => move({ type: 'quarter' })}
          >
            <Compass size={17} />
          </button>
        </div>
        <div className="scene-caption">
          <div>
            <span className="scaffold-key" />
            ANATOMICAL SCAFFOLD
            <span className="memory-key" />
            STORED MEMORIES
          </div>
          <p>
            Drag to rotate <span>·</span> Scroll to zoom <span>·</span> Double-click a region
          </p>
        </div>
        {immersive ? (
          <button className="button secondary leave-immersive" onClick={() => setImmersive(false)}>
            <Minimize2 size={15} />
            Show workspace
          </button>
        ) : (
          <div className="composer-wrap">
            <form className="composer" onSubmit={ask}>
              <div className="composer-input">
                <Search size={18} />
                <input
                  aria-label="Ask your memory"
                  placeholder={
                    user ? 'What would you like to remember?' : 'Your memory starts with a thought…'
                  }
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={2000}
                />
                {busy ? (
                  <button
                    type="button"
                    className="send-button"
                    aria-label="Cancel AI request"
                    onClick={() => controller.current?.abort()}
                  >
                    <X size={17} />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    aria-label="Search or ask"
                    disabled={!question.trim()}
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
              <div className="composer-meta">
                <select
                  aria-label="Retrieval mode"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="search">Source search</option>
                  {settings?.providers
                    .filter((p) => p.configured)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.model}
                      </option>
                    ))}
                  {settings?.providers.every((p) => p.configured) && (
                    <option value="compare">Compare + synthesise</option>
                  )}
                </select>
                <span>
                  {busy ? (
                    <>
                      <Loader2 size={11} className="spin" />
                      Retrieving…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={11} />
                      {model === 'search'
                        ? 'Local retrieval · no AI transmission'
                        : 'Permission requested before sending'}
                    </>
                  )}
                </span>
              </div>
            </form>
            <p className="composer-footnote">
              {graph.total.toLocaleString()} {graph.total === 1 ? 'memory' : 'memories'}{' '}
              <span>·</span> {graph.edges.length} confirmed{' '}
              {graph.edges.length === 1 ? 'connection' : 'connections'}
              {graph.aggregated ? ' · clustered view' : ''}
            </p>
          </div>
        )}
      </main>
      <aside className="inspector">
        <button
          className="icon-button mobile-close mobile-only"
          aria-label="Close panel"
          onClick={() => setMobilePanel(false)}
        >
          <X size={19} />
        </button>
        {!authLoaded ? (
          <div className="quiet-empty">
            <Loader2 className="spin" size={20} />
            <p>Opening workspace…</p>
          </div>
        ) : !user ? (
          <AuthPanel
            canRegister={canRegister}
            firstUser={firstUser}
            onAuth={(u) => {
              setUser(u);
              setFirstUser(false);
              setMobilePanel(false);
              notify('Your private workspace is ready.');
            }}
          />
        ) : selected ? (
          <MemoryPanel
            memory={selected}
            onClose={() => {
              setSelected(null);
              setMobilePanel(false);
              move(region ? { type: 'region', region } : { type: 'reset' });
            }}
            onNavigate={(id, v) => void openMemory(id, v)}
            onChanged={refresh}
            onError={notify}
          />
        ) : retrieval ? (
          <>
            <div className="inspector-heading">
              <span className="eyebrow">RETRIEVED FROM YOUR MEMORY</span>
              <button
                className="icon-button"
                aria-label="Close search results"
                onClick={() => setRetrieval(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="retrieval-panel">
              <h2>{retrieval.question}</h2>
              {retrieval.outputs?.map((output, i) => (
                <article className="ai-output" key={i}>
                  <span className="eyebrow">
                    {i === 2 ? 'SYNTHESIS' : output.provider} / {output.model}
                  </span>
                  <p>{output.text}</p>
                  <small>
                    {output.inputTokens + output.outputTokens} tokens · provider-generated response
                  </small>
                </article>
              ))}
              {retrieval.tokens !== undefined && (
                <p className="fine-print">
                  {retrieval.tokens.toLocaleString()} tokens total. Monetary cost depends on your
                  provider pricing; no price estimate configured.
                </p>
              )}
              <span className="status-label">
                {retrieval.outputs
                  ? 'SUPPLIED SOURCE EXCERPTS'
                  : 'SOURCE EXCERPTS · NO GENERATED ANSWER'}
              </span>
              {retrieval.citations.length ? (
                retrieval.citations.map((c, i) => (
                  <button className="citation" key={c.id} onClick={() => void openMemory(c.id)}>
                    <div>
                      <span className="citation-number">{i + 1}</span>
                      <strong>{c.title}</strong>
                      <ArrowUpRight size={14} />
                    </div>
                    <p>{c.excerpt}</p>
                    <span>{c.source} · Open original</span>
                  </button>
                ))
              ) : (
                <div className="quiet-empty">
                  <Search size={24} />
                  <p>No supporting sources found.</p>
                  <span>
                    Try a distinctive word, title, or phrase from the original. No answer has been
                    invented.
                  </span>
                </div>
              )}
              <p className="fine-print">
                Ranked full-text search. Semantic embedding retrieval is not enabled.
              </p>
            </div>
          </>
        ) : (
          <div className="field-guide">
            <div className="inspector-heading">
              <span className="eyebrow">FIELD NOTES</span>
              <Layers size={16} />
            </div>
            <div className="guide-intro">
              <div className="mini-icon">
                <Focus size={22} />
              </div>
              <h2>{graph.total ? 'Follow a connection.' : 'The beginning of an archive.'}</h2>
              <p className="muted">
                {graph.total
                  ? 'Select a luminous memory to open its original. Follow a confirmed connection to see how ideas relate.'
                  : 'The brain is here. Its memories are yours to bring.'}
              </p>
            </div>
            <div className="guide-step">
              <span>01</span>
              <div>
                <strong>Bring your history</strong>
                <p>Import ChatGPT, Claude or Markdown exports. Keep every original.</p>
                <button className="text-button" onClick={() => setModal('imports')}>
                  Import memories
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
            <div className="guide-step">
              <span>02</span>
              <div>
                <strong>Give a thought a place</strong>
                <p>A note becomes a real, selectable point in your atlas.</p>
                <button className="text-button" onClick={() => setModal('note')}>
                  Write a memory
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
            <div className="guide-step">
              <span>03</span>
              <div>
                <strong>Find your way back</strong>
                <p>Search your sources. Inspect connections. Keep context within reach.</p>
              </div>
            </div>
            {!graph.total && (
              <button className="demo-button" onClick={() => void createDemo()}>
                <Plus size={14} />
                Create a labelled demonstration memory
              </button>
            )}
            <div className="scaffold-note">
              <div>
                <span className="scaffold-key" />
                <strong>Scaffold ≠ memories</strong>
              </div>
              <p>
                The fine dots trace real cortical anatomy. Brighter, selectable points represent
                stored records. No memories are generated to fill the brain.
              </p>
              <a href="/anatomy/manifest.json" target="_blank" rel="noreferrer">
                View anatomical provenance
                <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        )}
      </aside>
      <div className="mobile-dock mobile-only">
        <button className="button secondary" onClick={() => setMobileNav(true)}>
          <BookOpen size={15} />
          Memories
        </button>
        <button className="button secondary" onClick={() => setMobilePanel(true)}>
          {user ? <Focus size={15} /> : <ShieldCheck size={15} />}{' '}
          {user ? 'Inspector' : 'Open workspace'}
        </button>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal === 'note' && <NoteDialog onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal === 'imports' && <ImportDialog onClose={() => setModal(null)} onChanged={refresh} />}
      {modal === 'settings' && (
        <SettingsDialog
          settings={settings}
          quality={quality}
          setQuality={changeQuality}
          reducedMotion={reducedMotion}
          setReducedMotion={changeMotion}
          onClose={() => setModal(null)}
          onDeleted={() => {
            clearWorkspace();
            setFirstUser(false);
            setCanRegister(false);
            api<{ firstUser: boolean; canRegister: boolean }>('auth/status')
              .then((status) => {
                setFirstUser(status.firstUser);
                setCanRegister(status.canRegister);
              })
              .catch((error) => notify(error.message));
          }}
        />
      )}
      {consent && (
        <Modal title="Send context to your AI provider?" onClose={() => setConsent(false)}>
          <p className="muted">
            Your question and up to six matching source excerpts will be sent to{' '}
            {model === 'compare'
              ? 'OpenAI and Anthropic'
              : model === 'openai'
                ? 'OpenAI'
                : 'Anthropic'}
            . The generated conversation will be saved as a memory.
          </p>
          <blockquote>{pendingQuestion}</blockquote>
          <p className="fine-print">
            {model === 'compare'
              ? 'At most three calls: two independent responses and one synthesis.'
              : 'One provider request.'}{' '}
            Each response is capped at 1,200 output tokens. API charges apply. You can cancel an
            active request; already processed tokens may still be billed.
          </p>
          <div className="row">
            <button className="button secondary" onClick={() => setConsent(false)}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                setConsent(false);
                void runQuestion(pendingQuestion, true);
              }}
            >
              Send this context
              <ArrowUpRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
