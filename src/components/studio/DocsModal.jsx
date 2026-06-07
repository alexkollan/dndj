import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import '../../styles/studio/DocsModal.css';

const TABS = [
  { id: 'user-guide', label: 'User Guide', home: 'user-guide/README.md' },
  { id: 'technical',  label: 'Technical Guide', home: 'technical/README.md' },
];

// Resolve a relative markdown href against the directory of the current doc.
// Returns { path, hash }. Uses a fake URL base to reuse the browser's own
// path normalization (handles ./, ../, etc).
function resolveDocPath(currentPath, href) {
  const hashIdx = href.indexOf('#');
  const rel = hashIdx === -1 ? href : href.slice(0, hashIdx);
  const hash = hashIdx === -1 ? null : href.slice(hashIdx + 1);
  if (!rel) return { path: currentPath, hash }; // pure "#anchor"
  const base = new URL('doc://r/' + currentPath);
  const url = new URL(rel, base);
  const path = url.pathname.replace(/^\/+/, '');
  return { path, hash };
}

// A rehype plugin factory that wraps every occurrence of `query` (outside code)
// in a <mark class="docs-hl"> so search matches are highlighted in the rendered
// document. Works on the hast tree, so React renders it natively.
function makeHighlighter(query) {
  const q = (query || '').toLowerCase();
  function splitText(value) {
    const lower = value.toLowerCase();
    if (!q || !lower.includes(q)) return null;
    const parts = [];
    let i = 0;
    while (i <= value.length) {
      const idx = lower.indexOf(q, i);
      if (idx === -1) { parts.push({ type: 'text', value: value.slice(i) }); break; }
      if (idx > i) parts.push({ type: 'text', value: value.slice(i, idx) });
      parts.push({
        type: 'element', tagName: 'mark',
        properties: { className: ['docs-hl'] },
        children: [{ type: 'text', value: value.slice(idx, idx + q.length) }],
      });
      i = idx + q.length;
    }
    return parts;
  }
  function walk(node) {
    if (!node.children || !node.children.length) return;
    const next = [];
    for (const child of node.children) {
      if (child.type === 'text') {
        const split = splitText(child.value);
        if (split) next.push(...split); else next.push(child);
      } else {
        if (child.tagName !== 'code' && child.tagName !== 'pre') walk(child);
        next.push(child);
      }
    }
    node.children = next;
  }
  return () => (tree) => { if (q) walk(tree); };
}

// Render a snippet string with the query term emphasised.
function Snippet({ text, query }) {
  const q = (query || '').toLowerCase();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const out = [];
  let i = 0, key = 0;
  while (i <= text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) { out.push(text.slice(i)); break; }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(<mark key={key++} className="docs-hl">{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
  }
  return <>{out}</>;
}

export default function DocsModal({ onClose }) {
  const [tab, setTab] = useState('user-guide');
  // Remember the open doc per tab so switching tabs preserves position.
  const [paths, setPaths] = useState({
    'user-guide': 'user-guide/README.md',
    'technical': 'technical/README.md',
  });
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlight, setHighlight] = useState('');     // term highlighted in the open doc
  const pendingHash = useRef(null);
  const bodyRef = useRef(null);
  const searchRef = useRef(null);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);

  const currentPath = paths[tab];

  // Load the current doc whenever the active path changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    window.dndj.docsRead(currentPath)
      .then(md => { if (!cancelled) { setContent(md); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err.message || String(err)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [currentPath]);

  // After content renders: scroll to pending anchor, else first highlight, else top.
  useEffect(() => {
    if (loading || showResults) return;
    const el = bodyRef.current;
    if (!el) return;
    if (pendingHash.current) {
      const target = el.querySelector(`#${CSS.escape(pendingHash.current)}`);
      pendingHash.current = null;
      if (target) { target.scrollIntoView({ block: 'start' }); return; }
    }
    if (highlight) {
      const hit = el.querySelector('.docs-hl');
      if (hit) { hit.scrollIntoView({ block: 'center' }); return; }
    }
    el.scrollTop = 0;
  }, [content, loading, highlight, showResults]);

  // Debounced search across the active section.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await window.dndj.docsSearch({ section: tab, query: q });
      setResults(r || []);
      setSearching(false);
    }, 180);
    return () => clearTimeout(t);
  }, [query, tab]);

  // Escape: close results first, then the modal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (showResults) { setShowResults(false); }
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showResults]);

  const navigate = useCallback((targetPath, hash, hl = '') => {
    pendingHash.current = hash || null;
    setHighlight(hl);
    const section = targetPath.startsWith('technical/') ? 'technical' : 'user-guide';
    setPaths(prev => ({ ...prev, [section]: targetPath }));
    setTab(section);
  }, []);

  const goHome = useCallback(() => {
    navigate(TABS.find(t => t.id === tab).home, null);
  }, [tab, navigate]);

  const openResult = useCallback((res) => {
    setShowResults(false);
    navigate(res.path, null, query.trim());
  }, [navigate, query]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setHighlight('');
    searchRef.current?.focus();
  }, []);

  // Custom link handling: external → browser, .md → in-app nav, #hash → scroll.
  const LinkRenderer = useCallback(({ href = '', children }) => {
    const onClick = (e) => {
      e.preventDefault();
      if (/^https?:\/\//i.test(href)) { window.dndj.openExternal(href); return; }
      if (href.startsWith('#')) {
        const el = bodyRef.current?.querySelector(`#${CSS.escape(href.slice(1))}`);
        el?.scrollIntoView({ block: 'start' });
        return;
      }
      const { path, hash } = resolveDocPath(currentPath, href);
      navigate(path, hash);
    };
    return <a href={href} onClick={onClick}>{children}</a>;
  }, [currentPath, navigate]);

  const activeLabel = TABS.find(t => t.id === tab).label;

  return (
    <div className="docs-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="docs-dialog">
        <div className="docs-dialog__header">
          <span className="docs-dialog__title">📖 DNDj Guides</span>
          <button className="docs-dialog__close" onClick={onClose} title="Close (Esc)">×</button>
        </div>

        <div className="docs-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`docs-tab ${tab === t.id ? 'docs-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <div className="docs-tabs__spacer" />
          <button
            className="docs-home-btn"
            onClick={goHome}
            disabled={!showResults && currentPath === TABS.find(t => t.id === tab).home}
            title="Back to this guide's index"
          >
            ⌂ Index
          </button>
        </div>

        <div className="docs-search">
          <span className="docs-search__icon">🔍</span>
          <input
            ref={searchRef}
            className="docs-search__input"
            placeholder={`Search ${activeLabel}…`}
            value={query}
            onChange={e => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => { if (query.trim()) setShowResults(true); }}
          />
          {query && (
            <button className="docs-search__clear" onClick={clearSearch} title="Clear">×</button>
          )}
        </div>

        <div className="docs-dialog__body" ref={bodyRef}>
          {showResults && query.trim() ? (
            <div className="docs-results">
              <p className="docs-results__head">
                {searching ? 'Searching…'
                  : results.length === 0 ? `No matches in ${activeLabel}.`
                  : `${results.reduce((n, r) => n + r.count, 0)} match(es) in ${results.length} page(s)`}
              </p>
              {results.map(res => (
                <button key={res.path} className="docs-result" onClick={() => openResult(res)}>
                  <div className="docs-result__title">
                    {res.title}
                    <span className="docs-result__count">{res.count}</span>
                  </div>
                  {res.snippets.map((s, i) => (
                    <div key={i} className="docs-result__snippet">
                      <Snippet text={s} query={query.trim()} />
                    </div>
                  ))}
                </button>
              ))}
            </div>
          ) : loading ? (
            <p className="docs-status">Loading…</p>
          ) : error ? (
            <p className="docs-status docs-status--error">{error}</p>
          ) : (
            <div className="docs-md">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug, makeHighlighter(highlight)]}
                components={{ a: LinkRenderer }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
