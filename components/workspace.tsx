'use client';
import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
} from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
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
  PanelRightClose,
  PanelRightOpen,
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
import { api, post, UNAUTHORIZED_EVENT } from '@/lib/client';
import { SectionBoundary } from './error-boundary';
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
import type { RendererStatus, ViewCommand } from './brain';
import TopicPanel from './topic-panel';
import { CanvasNotice, LobeLegend, LobeOverview, MobileBar, TrailBack } from './brain-hud';
import {
  contextOf,
  current as currentPlace,
  depth,
  initialTrail,
  previous as previousPlace,
  travel,
  visit,
  type Trail,
  type TrailLocation,
} from '@/lib/exploration-trail';
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
  mode?: string;
  notice?: string;
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
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
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
  const [untagged, setUntagged] = useState(false);
  const [topicPage, setTopicPage] = useState(0);
  const [topicSearch, setTopicSearch] = useState('');
  const [topicPosition, setTopicPosition] = useState<[number, number, number] | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filters, setFilters] = useState(false);
  const [questionFilters, setQuestionFilters] = useState(false);
  const [quality, setQuality] = useState<'low' | 'balanced' | 'high'>('balanced');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [rendererStatus, setRendererStatus] = useState<RendererStatus>('loading');
  const ready = rendererStatus === 'ready';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [question, setQuestion] = useState('');
  const [retrieval, setRetrieval] = useState<Retrieval | null>(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState('search');
  const [consent, setConsent] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const controller = useRef<AbortController | null>(null);
  const [toast, setToast] = useState('');
  // Every place visited, shared by the breadcrumb, the Back control and the browser's Back.
  const [trail, setTrail] = useState<Trail<Retrieval>>(initialTrail);
  const trailRef = useRef<Trail<Retrieval>>(trail);
  const historyRun = useRef('');
  const [atlasLoaded, setAtlasLoaded] = useState(false);
  const [panelHidden, setPanelHidden] = useState(false);
  const [sheetTall, setSheetTall] = useState(false);
  const askInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRequest = useRef(0);
  const graphRequest = useRef(0);
  const libraryRequest = useRef(0);
  const activeWorkspace = useRef<string | null>(null);
  activeWorkspace.current = user?.workspaceId ?? null;
  const clearOnSessionEnd = useRef(clearWorkspace);
  clearOnSessionEnd.current = clearWorkspace;
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 7000);
  }, []);
  const move = useCallback(
    (cmd: Omit<ViewCommand, 'key'>) => setCommand((c) => ({ ...cmd, key: c.key + 1 })),
    [],
  );
  const record = useCallback((location: TrailLocation<Retrieval>) => {
    const before = trailRef.current;
    const next = visit(before, location);
    trailRef.current = next;
    setTrail(next);
    const state = {
      ...(window.history.state ?? {}),
      echo: next.index,
      echoRun: historyRun.current,
    };
    if (next.index !== before.index) window.history.pushState(state, '');
    else window.history.replaceState(state, '');
  }, []);
  const resetTrail = useCallback(() => {
    const fresh = initialTrail<Retrieval>();
    trailRef.current = fresh;
    setTrail(fresh);
    // Entries left in the browser from an earlier run or account must never be replayed.
    historyRun.current = `${Date.now()}-${Math.random()}`;
    window.history.replaceState(
      { ...(window.history.state ?? {}), echo: 0, echoRun: historyRun.current },
      '',
    );
  }, []);
  useEffect(() => {
    // The server ended the session (expiry, sign-out elsewhere): confirm, then drop stale state.
    const onUnauthorized = () => {
      api<{ user: Session | null }>('auth/status')
        .then((r) => {
          if (r.user || !activeWorkspace.current) return;
          clearOnSessionEnd.current();
          notify('Your session has ended. Sign in again.');
        })
        .catch(() => undefined);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [notify]);
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
    resetTrail();
    setPanelHidden(localStorage.getItem('echo-context-panel') === 'hidden');
    const saved = localStorage.getItem('echo-quality');
    if (saved === 'low' || saved === 'balanced' || saved === 'high') setQuality(saved);
    else if (window.innerWidth < 700) setQuality('low');
    return () => {
      controller.current?.abort();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [notify, resetTrail]);
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
    setGraphLoading(true);
    setGraphError('');
    try {
      const result = await api<Graph>(
        `graph?${new URLSearchParams({
          region: region || '',
          q: query,
          source,
          tag,
          from,
          to,
          untagged: untagged ? '1' : '',
          focus: selected?.id || '',
          view: region && !tag && !untagged ? 'topics' : 'memories',
          topicPage: String(topicPage),
          topicQ: topicSearch,
        })}`,
      );
      if (request === graphRequest.current && activeWorkspace.current === user.workspaceId)
        setGraph(result);
    } catch (e) {
      if (request === graphRequest.current && activeWorkspace.current === user.workspaceId) {
        setGraphError((e as Error).message);
        setGraph((previous) => ({ ...previous, nodes: [], edges: [] }));
      }
    } finally {
      if (request === graphRequest.current && activeWorkspace.current === user.workspaceId) {
        setGraphLoading(false);
        setAtlasLoaded(true);
      }
    }
  }, [user, region, query, source, tag, from, to, untagged, selected?.id, topicPage, topicSearch]);
  const refreshLibrary = useCallback(async () => {
    if (!user) return;
    const request = ++libraryRequest.current;
    setLibraryLoading(true);
    setLibraryError('');
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      region: region || '',
      source,
      tag,
      untagged: untagged ? '1' : '',
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
      if (request === libraryRequest.current && activeWorkspace.current === user.workspaceId) {
        setMemories([]);
        setTotal(0);
        setLibraryError((e as Error).message);
      }
    } finally {
      if (request === libraryRequest.current && activeWorkspace.current === user.workspaceId)
        setLibraryLoading(false);
    }
  }, [user, query, page, region, source, tag, from, to, untagged, notify]);
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
  const context = (): TrailLocation<Retrieval> =>
    contextOf({ kind: 'whole', region, tag, untagged, topicPosition });
  async function loadMemory(id: string, version?: number, passage?: string) {
    const req = ++selectedRequest.current;
    const params = new URLSearchParams();
    if (version) params.set('version', String(version));
    if (passage) params.set('passage', passage);
    const m = await api<MemoryDetail>(`memories/${id}?${params}`).catch((error) => {
      // A superseded Back/Forward request must not clear a newer selection on failure.
      if (req !== selectedRequest.current || activeWorkspace.current !== user?.workspaceId)
        return null;
      throw error;
    });
    if (!m || req !== selectedRequest.current || activeWorkspace.current !== user?.workspaceId)
      return null;
    setSelected(m);
    setRetrieval(null);
    setMobilePanel(true);
    move({ type: 'memory', position: m.position });
    return m;
  }
  async function openMemory(id: string, version?: number, passage?: string) {
    try {
      const m = await loadMemory(id, version, passage);
      if (m)
        record({
          ...context(),
          kind: 'memory',
          memory: { id: m.id, title: m.title, region: m.region, version, passage },
        });
    } catch (e) {
      notify((e as Error).message);
    }
  }
  /** Shows a recorded place again without adding to the trail (Back, Forward). */
  function revisit(place: TrailLocation<Retrieval>) {
    selectedRequest.current++;
    setRegion(place.region);
    setTag(place.tag);
    setUntagged(place.untagged);
    setTopicPosition(place.topicPosition);
    setPage(0);
    setMobileNav(false);
    setMobilePanel(place.kind !== 'whole');
    const settle = () =>
      move(
        place.topicPosition && (place.tag || place.untagged)
          ? { type: 'topic', position: place.topicPosition }
          : place.region
            ? { type: 'region', region: place.region }
            : { type: 'reset' },
      );
    if (place.kind === 'memory' && place.memory) {
      // Keep the current panel until the earlier memory has loaded, then swap.
      loadMemory(place.memory.id, place.memory.version, place.memory.passage).catch((e) => {
        setSelected(null);
        settle();
        notify(`That memory can no longer be opened. ${(e as Error).message}`);
      });
      return;
    }
    setSelected(null);
    setRetrieval(place.kind === 'results' ? (place.results ?? null) : null);
    settle();
  }
  const revisitLatest = useRef(revisit);
  revisitLatest.current = revisit;
  function goBack() {
    if (trailRef.current.index > 0) window.history.back();
  }
  function focusRegion(value: Region | null) {
    selectedRequest.current++;
    setSelected(null);
    setRetrieval(null);
    setRegion(value);
    setTag('');
    setUntagged(false);
    setTopicPosition(null);
    setTopicPage(0);
    setTopicSearch('');
    setPage(0);
    setMobileNav(false);
    setMobilePanel(Boolean(value));
    move(value ? { type: 'region', region: value } : { type: 'reset' });
    record({
      kind: value ? 'region' : 'whole',
      region: value,
      tag: '',
      untagged: false,
      topicPosition: null,
    });
  }
  function wholeBrain() {
    setSearch('');
    setQuery('');
    setSource('');
    setFrom('');
    setTo('');
    focusRegion(null);
  }
  function closeMemory() {
    selectedRequest.current++;
    setSelected(null);
    setRetrieval(null);
    setMobilePanel(Boolean(region));
    record(context());
    move(
      topicPosition
        ? { type: 'topic', position: topicPosition }
        : region
          ? { type: 'region', region }
          : { type: 'reset' },
    );
  }
  function changeFilter() {
    selectedRequest.current++;
    setSelected(null);
    setRetrieval(null);
    setPage(0);
    setTopicPage(0);
  }
  function chooseNode(node: GraphNode) {
    if (node.kind === 'topic') {
      selectedRequest.current++;
      setSelected(null);
      setRetrieval(null);
      setRegion(node.region);
      setTag(node.topic || '');
      setUntagged(node.topic === null);
      setTopicPosition(node.position);
      setPage(0);
      setMobilePanel(true);
      move({ type: 'topic', position: node.position });
      record({
        kind: 'topic',
        region: node.region,
        tag: node.topic || '',
        untagged: node.topic === null,
        topicPosition: node.position,
      });
    } else if (node.kind === 'spatial' || node.count > 1) {
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
    record({
      ...context(),
      kind: 'memory',
      memory: { id: memory.id, title: memory.title, region: memory.region },
    });
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
    setLibraryLoading(false);
    setLibraryError('');
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
    setUntagged(false);
    setTopicPage(0);
    setTopicSearch('');
    setTopicPosition(null);
    setGraphLoading(false);
    setGraphError('');
    setFrom('');
    setTo('');
    setFilters(false);
    setQuestionFilters(false);
    setToast('');
    setAtlasLoaded(false);
    setSheetTall(false);
    resetTrail();
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
    selectedRequest.current++;
    setSelected(null);
    setMobilePanel(true);
    const requestController = new AbortController();
    controller.current = requestController;
    try {
      const scope = questionFilters
        ? { region: region || '', q: query, source, tag, from, to, untagged: untagged ? '1' : '' }
        : {};
      if (providerConsent && model !== 'hybrid') {
        const r = await api<{
          citations: Citation[];
          outputs: NonNullable<Retrieval['outputs']>;
          tokens: number;
          mode?: string;
          notice?: string;
        }>('assistant', {
          method: 'POST',
          body: JSON.stringify({
            question: value,
            providers: model === 'compare' ? ['openai', 'anthropic'] : [model],
            consent: true,
            synthesise: model === 'compare',
            semantic: Boolean(settings?.embeddingConfigured),
            filters: scope,
          }),
          signal: requestController.signal,
        });
        if (activeWorkspace.current !== user?.workspaceId) return;
        const found = { question: value, ...r };
        setRetrieval(found);
        record({ ...context(), kind: 'results', results: found, question: value });
        refresh();
      } else {
        const r = await api<{ citations: Citation[]; mode: string }>('retrieve', {
          method: 'POST',
          body: JSON.stringify({
            question: value,
            mode: model === 'hybrid' ? 'hybrid' : 'keyword',
            consent: providerConsent,
            filters: scope,
          }),
          signal: requestController.signal,
        });
        if (activeWorkspace.current !== user?.workspaceId) return;
        const found = { question: value, ...r };
        setRetrieval(found);
        record({ ...context(), kind: 'results', results: found, question: value });
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
  const activeRegion = selected?.region ?? region;
  const topicLabel = untagged ? 'Untagged memories' : tag ? `#${tag}` : '';
  const topicView = Boolean(region && !tag && !untagged && !selected && !retrieval);
  const hasProvider = settings?.providers.some((p) => p.configured);
  const place = currentPlace(trail);
  const backTo = previousPlace(trail);
  const showingResults = Boolean(retrieval && !selected);
  const level = showingResults
    ? null
    : depth({
        kind: selected ? 'memory' : topicLabel ? 'topic' : region ? 'region' : 'whole',
        region,
        tag,
        untagged,
        topicPosition,
      });
  const lobeName = region ? REGION_INFO[region].name : '';
  const emptyLobe =
    topicView &&
    !graphLoading &&
    !graphError &&
    !topicSearch &&
    graph.mode === 'topics' &&
    !graph.nodes.length;
  // The panel holds memories and results, so those always reveal it; lobes and topics are
  // also visible on the canvas and respect the reader's choice to hide it.
  const panelCollapsed = panelHidden && Boolean(user) && authLoaded && !selected && !retrieval;
  const announcement = selected
    ? `Memory opened: ${selected.title}`
    : showingResults
      ? `${retrieval!.citations.length} retrieved ${retrieval!.citations.length === 1 ? 'source' : 'sources'}`
      : topicLabel
        ? `Topic ${topicLabel}, ${total} ${total === 1 ? 'memory' : 'memories'}`
        : region
          ? `${lobeName} lobe, ${graph.counts[region] || 0} ${(graph.counts[region] || 0) === 1 ? 'memory' : 'memories'}`
          : 'Whole brain';
  function togglePanel() {
    const next = !panelHidden;
    setPanelHidden(next);
    localStorage.setItem('echo-context-panel', next ? 'hidden' : 'shown');
  }
  function closeResults() {
    setRetrieval(null);
    record(context());
  }
  const shortcuts = useRef<(event: KeyboardEvent) => void>(() => undefined);
  shortcuts.current = (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    // Native dialogs handle their own Escape.
    if (document.querySelector('dialog[open]')) return;
    const target = event.target as HTMLElement | null;
    const typing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));
    if (event.key === '/' && !typing) {
      event.preventDefault();
      if (immersive) setImmersive(false);
      setMobileNav(false);
      setMobilePanel(false);
      requestAnimationFrame(() => askInput.current?.focus());
    } else if (event.key === 'Escape') {
      if (typing) return target?.blur();
      if (mobileNav) return setMobileNav(false);
      if (trailRef.current.index > 0) {
        event.preventDefault();
        goBack();
      }
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => shortcuts.current(event);
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { echo?: number; echoRun?: string } | null;
      const target =
        state && state.echoRun === historyRun.current && typeof state.echo === 'number'
          ? state.echo
          : 0;
      const next = travel(trailRef.current, target);
      if (!next || next.index === trailRef.current.index) return;
      trailRef.current = next;
      setTrail(next);
      revisitLatest.current(next.entries[next.index]);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  return (
    <div
      className={`app-shell ${immersive ? 'immersive' : ''} ${mobileNav ? 'nav-open' : ''} ${mobilePanel ? 'panel-open' : ''} ${panelCollapsed ? 'panel-collapsed' : ''} ${sheetTall || !user ? 'sheet-tall' : ''} ${selected || retrieval ? 'has-context' : ''}`}
      data-place={showingResults ? 'results' : place.kind}
      data-reduced-motion={reducedMotion ? 'true' : undefined}
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  changeFilter();
                }}
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
                    changeFilter();
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
                    setUntagged(false);
                    setTopicPosition(null);
                    changeFilter();
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
                    changeFilter();
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
                    changeFilter();
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
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={questionFilters}
                  onChange={(e) => setQuestionFilters(e.target.checked)}
                />
                Use these filters for questions
              </label>
            </div>
          )}
          <div className="memory-list">
            {libraryLoading ? (
              <p role="status" className="fine-print">
                Loading originals…
              </p>
            ) : libraryError ? (
              <div role="alert">
                <p>{libraryError}</p>
                <button className="text-button" onClick={() => void refreshLibrary()}>
                  Retry originals
                </button>
              </div>
            ) : (
              memories.slice(0, tab === 'brain' ? 7 : 50).map((m) => (
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
              ))
            )}
            {!libraryLoading && !libraryError && !memories.length && (
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
      <main
        className="viewport"
        style={
          { '--place': activeRegion ? REGION_INFO[activeRegion].color : '#88b7f5' } as CSSProperties
        }
      >
        <div className="viewport-top">
          <TrailBack to={backTo} onBack={goBack} />
          <nav className="breadcrumb" aria-label="Brain navigation">
            <button onClick={wholeBrain}>Whole brain</button>
            {activeRegion && (
              <>
                <ChevronRight size={12} />
                <button onClick={() => focusRegion(activeRegion)}>
                  {REGION_INFO[activeRegion].name}
                </button>
              </>
            )}
            {topicLabel &&
              (!selected ||
                (selected.region === region &&
                  (untagged ? !selected.tags.length : selected.tags.includes(tag)))) && (
                <>
                  <ChevronRight size={12} />
                  <button onClick={closeMemory}>{topicLabel}</button>
                </>
              )}
            {selected && (
              <>
                <ChevronRight size={12} />
                <span aria-current="page">Memory</span>
              </>
            )}
            {showingResults && (
              <>
                <ChevronRight size={12} />
                <span aria-current="page">Results</span>
              </>
            )}
          </nav>
          <div className="view-status">
            {graphLoading && ready && (
              <span className="view-updating">
                <Loader2 size={10} className="spin" aria-hidden />
                UPDATING VIEW
              </span>
            )}
            <span className={ready ? 'live-dot active' : 'live-dot'} />
            {ready
              ? '3D ANATOMICAL VIEW'
              : rendererStatus === 'unavailable'
                ? '3D VIEW UNAVAILABLE'
                : 'LOADING GEOMETRY'}
          </div>
        </div>
        <div className="scene-title">
          <span className="eyebrow depth-label">
            {level ? (
              <>
                <span className="depth-meter" aria-hidden>
                  {[1, 2, 3, 4].map((n) => (
                    <i key={n} className={n <= level.level ? 'on' : ''} />
                  ))}
                </span>
                {String(level.level).padStart(2, '0')} / {level.name.toUpperCase()}
                <span className="sr-only">
                  , level {level.level} of {level.of}
                </span>
              </>
            ) : (
              'SEARCH RESULTS'
            )}
          </span>
          <h1>
            {selected
              ? 'A memory in context'
              : showingResults
                ? 'Retrieved sources'
                : topicLabel || (region ? `${REGION_INFO[region].name} cortex` : 'Memory atlas')}
          </h1>
          <p>
            {selected
              ? 'Selected original + confirmed neighbours'
              : showingResults
                ? `${retrieval!.citations.length} ${retrieval!.citations.length === 1 ? 'passage' : 'passages'} matched your question`
                : topicLabel
                  ? 'Individual records · grouped by explicit tags'
                  : region
                    ? 'Explore the topics and projects in this lobe.'
                    : 'A living archive. An anatomical canvas.'}
          </p>
        </div>
        <p className="sr-only" aria-live="polite" data-testid="place-announcement">
          {announcement}
        </p>
        <LobeLegend counts={graph.counts} active={activeRegion} onSelect={focusRegion} />
        <div className="brain-canvas" data-testid="brain-viewport">
          <Brain
            graph={graphLoading ? { ...graph, nodes: [], edges: [] } : graph}
            selected={selectedId}
            region={activeRegion}
            command={command}
            quality={quality}
            reducedMotion={reducedMotion}
            onSelect={chooseNode}
            onRegion={focusRegion}
            onStatus={setRendererStatus}
          />
        </div>
        {emptyLobe && (
          <CanvasNotice tone="empty">
            <strong>No memories in the {lobeName} lobe yet.</strong>
            <span>The scaffold is anatomy only. Nothing is drawn here until you add a record.</span>
            <span className="canvas-notice-actions">
              <button className="button secondary small" onClick={() => setModal('note')}>
                <Plus size={13} aria-hidden />
                Write a memory
              </button>
              <button className="text-button" onClick={wholeBrain}>
                Return to the whole brain
              </button>
            </span>
          </CanvasNotice>
        )}
        <div className="canvas-tools">
          <button
            className="icon-button"
            aria-label="Reset brain view"
            title="Reset view"
            onClick={wholeBrain}
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
          {user && (
            <>
              <span className="desktop-only" />
              <button
                className="icon-button desktop-only"
                aria-label={panelCollapsed ? 'Show context panel' : 'Hide context panel'}
                title={panelCollapsed ? 'Show context panel' : 'Hide context panel'}
                aria-pressed={!panelCollapsed}
                disabled={Boolean(selected || retrieval)}
                onClick={togglePanel}
              >
                {panelCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
              </button>
            </>
          )}
        </div>
        <div className="scene-caption">
          <div>
            <span className="scaffold-key" />
            ANATOMICAL SCAFFOLD
            <span className="memory-key" />
            STORED MEMORIES
            {graph.mode === 'topics' && (
              <>
                <span className="topic-key" />
                TAG GROUPS
              </>
            )}
          </div>
          <p className="hint-pointer">
            Drag to rotate <span>·</span> Scroll to zoom <span>·</span> Double-click a region
          </p>
          <p className="hint-touch">
            Drag to rotate <span>·</span> Pinch to zoom <span>·</span> Double-tap a lobe
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
                  ref={askInput}
                  aria-keyshortcuts="/"
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
                  {settings?.embeddingConfigured && (
                    <option value="hybrid">Hybrid source search</option>
                  )}
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
              {graph.mode === 'topics'
                ? ' · explicit tag groups'
                : graph.mode === 'neighborhood'
                  ? ' · selected neighbourhood (up to 100 links)'
                  : graph.aggregated
                    ? ' · spatially clustered view'
                    : ''}
            </p>
            {graphError && !topicView && (
              <div role="alert" className="fine-print">
                {graphError}{' '}
                <button className="text-button" onClick={() => void refreshGraph()}>
                  Retry brain loading
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      <aside className="inspector">
        {user && (
          <button
            className="sheet-handle mobile-only"
            aria-label={sheetTall ? 'Shrink panel' : 'Expand panel'}
            aria-expanded={sheetTall}
            onClick={() => setSheetTall(!sheetTall)}
          >
            <span aria-hidden />
          </button>
        )}
        <button
          className="icon-button mobile-close mobile-only"
          aria-label="Close panel"
          title="Put this panel away. Your place is kept."
          onClick={() => setMobilePanel(false)}
        >
          <ChevronDown size={19} />
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
          <SectionBoundary name="This memory" resetKey={selected} onDismiss={closeMemory}>
            <MemoryPanel
              memory={selected}
              onClose={closeMemory}
              onNavigate={(id, v, passage) => void openMemory(id, v, passage)}
              onChanged={refresh}
              onError={notify}
            />
          </SectionBoundary>
        ) : retrieval ? (
          <>
            <div className="inspector-heading">
              <span className="eyebrow">RETRIEVED FROM YOUR MEMORY</span>
              <button
                className="icon-button"
                aria-label="Close search results"
                onClick={closeResults}
              >
                <X size={16} />
              </button>
            </div>
            <div className="retrieval-panel">
              <h2>{retrieval.question}</h2>
              {retrieval.notice && <p>{retrieval.notice}</p>}
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
                  {retrieval.tokens.toLocaleString()} answer tokens. Query embeddings are billed
                  separately when used. Monetary cost depends on your provider pricing.
                </p>
              )}
              <span className="status-label">
                {retrieval.outputs
                  ? 'SUPPLIED SOURCE EXCERPTS'
                  : 'SOURCE EXCERPTS · NO GENERATED ANSWER'}
              </span>
              {retrieval.citations.length ? (
                retrieval.citations.map((c, i) => (
                  <button
                    className="citation"
                    key={c.chunkId || c.id}
                    onClick={() => void openMemory(c.id, c.version, c.chunkId)}
                  >
                    <div>
                      <span className="citation-number">{i + 1}</span>
                      <strong>{c.title}</strong>
                      <ArrowUpRight size={14} />
                    </div>
                    <p>{c.excerpt}</p>
                    <span>{c.source} · Open original</span>
                    {c.version && (
                      <small>
                        {' '}
                        · Version {c.version}
                        {c.chunkId ? ' · Exact passage' : ''}
                        {c.similarity !== undefined ? ` · cosine ${c.similarity.toFixed(3)}` : ''}
                      </small>
                    )}
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
                {retrieval.mode === 'hybrid-retrieval'
                  ? 'Keyword and semantic matches combined by reciprocal rank. Similarity is relevance evidence, not proof of truth.'
                  : 'Ranked full-text source retrieval. No query embedding was used.'}
              </p>
            </div>
          </>
        ) : topicView && region ? (
          <TopicPanel
            graph={graph.mode === 'topics' ? graph : EMPTY}
            region={region}
            query={topicSearch}
            loading={graphLoading}
            error={graphError}
            onQuery={(value) => {
              setTopicSearch(value);
              setTopicPage(0);
            }}
            onPage={setTopicPage}
            onSelect={chooseNode}
            onRetry={() => void refreshGraph()}
          />
        ) : topicLabel ? (
          <section className="topic-panel" aria-label="Memories in topic">
            <div className="inspector-heading">
              <span className="eyebrow">03 / TOPIC → MEMORY</span>
              <Layers size={16} />
            </div>
            <div className="topic-intro">
              {region && (
                <button className="text-button" onClick={() => focusRegion(region)}>
                  <ArrowLeft size={14} />
                  Back to lobe
                </button>
              )}
              <h2>{topicLabel}</h2>
              <p>
                {total} stored {total === 1 ? 'original' : 'originals'} in this view. Select a point
                or a record below to read its source.
              </p>
              <p className="fine-print">
                {untagged
                  ? 'These records have no explicit tags yet.'
                  : 'Membership comes from a shared tag, not inferred semantic similarity.'}
              </p>
            </div>
            <div className="topic-list">
              {libraryLoading ? (
                <p role="status">Loading originals…</p>
              ) : libraryError ? (
                <div role="alert">
                  <p>{libraryError}</p>
                  <button className="text-button" onClick={() => void refreshLibrary()}>
                    Retry originals
                  </button>
                </div>
              ) : (
                memories.map((memory) => (
                  <button
                    key={memory.id}
                    className="topic-card"
                    onClick={() => void openMemory(memory.id)}
                  >
                    <FileText size={16} />
                    <span>
                      <strong>{memory.title}</strong>
                      {/* The stored extractive preview: opening words of the original, not AI. */}
                      {memory.summary && <em className="topic-preview">{memory.summary}</em>}
                      <small>{memory.source} · Open original</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))
              )}
            </div>
            {!libraryLoading && !libraryError && !memories.length && (
              <p className="topic-intro">
                No matching originals. Adjust your library filters or return to the lobe.
              </p>
            )}
            {total > 50 && (
              <div className="topic-pagination">
                <button
                  className="icon-button"
                  aria-label="Previous topic memories"
                  disabled={!page}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ArrowLeft size={16} />
                </button>
                <span>
                  {page * 50 + 1}–{Math.min((page + 1) * 50, total)} / {total}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next topic memories"
                  disabled={(page + 1) * 50 >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        ) : !atlasLoaded ? (
          <div className="quiet-empty" role="status">
            <Loader2 className="spin" size={20} />
            <p>Opening your atlas…</p>
          </div>
        ) : graph.total > 0 ? (
          <LobeOverview
            counts={graph.counts}
            total={graph.total}
            connections={graph.edges.length}
            onSelect={focusRegion}
            onImport={() => setModal('imports')}
            onWrite={() => setModal('note')}
          />
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
      <MobileBar
        signedIn={Boolean(user)}
        view={mobileNav ? 'memories' : mobilePanel ? 'context' : 'atlas'}
        contextLabel={
          selected
            ? 'Memory'
            : retrieval
              ? 'Results'
              : topicLabel
                ? 'Topic'
                : region
                  ? 'Lobe'
                  : 'Overview'
        }
        onAtlas={() => {
          setMobileNav(false);
          setMobilePanel(false);
          setTab('brain');
        }}
        onMemories={() => {
          setMobilePanel(false);
          setMobileNav(true);
        }}
        onContext={() => {
          setMobileNav(false);
          setMobilePanel(true);
        }}
        onNew={() => setModal('note')}
      />
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
          {model === 'hybrid' ? (
            <p className="muted">
              Your question will be sent to OpenAI to find semantically related passages in this
              workspace. No answer will be generated. Previously indexed originals stay in the
              database.
            </p>
          ) : (
            <p className="muted">
              Your question and up to six matching source excerpts will be sent to{' '}
              {model === 'compare'
                ? 'OpenAI and Anthropic'
                : model === 'openai'
                  ? 'OpenAI'
                  : 'Anthropic'}
              . The generated conversation will be saved as a memory.
            </p>
          )}
          {model !== 'hybrid' && settings?.embeddingConfigured && (
            <p className="fine-print">
              Your question may also be sent to OpenAI for semantic retrieval. Only indexed passages
              in {questionFilters ? 'the selected library scope' : 'your workspace'} can be
              retrieved. The sources themselves are sent only to the answer providers named above.
            </p>
          )}
          <blockquote>{pendingQuestion}</blockquote>
          <p className="fine-print">
            {model === 'hybrid'
              ? 'At most one query embedding request; a saved result can be reused.'
              : model === 'compare'
                ? 'At most three calls: two independent responses and one synthesis.'
                : 'One provider request.'}{' '}
            {model !== 'hybrid' && 'Each response is capped at 1,200 output tokens. '}API charges
            apply. You can cancel an active request; already processed tokens may still be billed.
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
