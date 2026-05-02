import { useState, useRef, useEffect } from 'react'

export default function App() {
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [newProject, setNewProject] = useState({ slug: '', name: '', base_url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' })
  const [showNewProject, setShowNewProject] = useState(false)

  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [filePaths, setFilePaths] = useState('')
  const [loading, setLoading] = useState(false)
  const [contextTokens, setContextTokens] = useState(null)

  const [constraints, setConstraints] = useState([])
  const [newConstraintFlash, setNewConstraintFlash] = useState([])

  const bottomRef = useRef(null)

  useEffect(() => { fetchProjects() }, [])

  useEffect(() => {
    if (activeProject) {
      fetchSessions()
      fetchConstraints()
      setActiveSession(null)
      setMessages([])
      setContextTokens(null)
    }
  }, [activeProject])

  useEffect(() => {
    if (activeSession && activeProject) {
      loadSessionMessages(activeSession)
    }
  }, [activeSession])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (newConstraintFlash.length > 0) {
      const t = setTimeout(() => setNewConstraintFlash([]), 3000)
      return () => clearTimeout(t)
    }
  }, [newConstraintFlash])

  async function fetchProjects() {
    const res = await fetch('/projects')
    setProjects(await res.json())
  }

  async function createProject() {
    if (!newProject.slug || !newProject.name) return
    const res = await fetch('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    })
    if (res.ok) {
      setShowNewProject(false)
      setNewProject({ slug: '', name: '', base_url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' })
      await fetchProjects()
      setActiveProject(newProject.slug)
    }
  }

  async function deleteProject(slug) {
    if (!confirm(`Delete project "${slug}"?`)) return
    await fetch(`/projects/${slug}`, { method: 'DELETE' })
    if (activeProject === slug) setActiveProject(null)
    await fetchProjects()
  }

  async function fetchSessions() {
    const res = await fetch(`/projects/${activeProject}/sessions`)
    setSessions(await res.json())
  }

  async function loadSessionMessages(sessionId) {
    const res = await fetch(`/projects/${activeProject}/sessions/${sessionId}/messages`)
    const data = await res.json()
    setMessages(data.map(m => ({ role: m.role, text: m.content })))
    if (data.length > 0) {
      const last = data.filter(m => m.context_tokens > 0).pop()
      if (last) setContextTokens(last.context_tokens)
    }
  }

  async function deleteSession(sessionId) {
    await fetch(`/projects/${activeProject}/sessions/${sessionId}`, { method: 'DELETE' })
    if (activeSession === sessionId) {
      setActiveSession(null)
      setMessages([])
    }
    fetchSessions()
  }

  async function fetchConstraints() {
    const res = await fetch(`/projects/${activeProject}/constraints`)
    setConstraints(await res.json())
  }

  async function deleteConstraint(key) {
    await fetch(`/projects/${activeProject}/constraints?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
    setConstraints(c => c.filter(x => x.key !== key))
  }

  function newChat() {
    setActiveSession(null)
    setMessages([])
    setContextTokens(null)
  }

  async function send() {
    if (!input.trim() || loading || !activeProject) return
    const userMsg = input.trim()
    setInput('')
    setMessages(m => [...m, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const res = await fetch(`/projects/${activeProject}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          file_paths: filePaths.split(',').map(s => s.trim()).filter(Boolean),
          session_id: activeSession,
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(m => [...m, { role: 'assistant', text: data.reply }])
        setContextTokens(data.context_tokens)
        // Set active session if new
        if (!activeSession) {
          setActiveSession(data.session_id)
        }
        if (data.new_constraints?.length > 0) {
          setNewConstraintFlash(data.new_constraints)
          fetchConstraints()
        }
        fetchSessions()
      } else {
        setMessages(m => [...m, { role: 'error', text: data.detail || 'Unknown error' }])
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'error', text: 'Connection error: ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  // --- Project picker ---
  if (!activeProject) {
    return (
      <div style={styles.app}>
        <div style={styles.picker}>
          <div style={styles.logo}>🐂 steerhead</div>
          <div style={styles.pickerSubtitle}>Select a project or create one</div>
          <div style={styles.projectList}>
            {projects.map(p => (
              <div key={p.slug} style={styles.projectCard} onClick={() => setActiveProject(p.slug)}>
                <div style={styles.projectName}>{p.name}</div>
                <div style={styles.projectSlug}>{p.slug}</div>
                <div style={styles.projectMeta}>{p.model}</div>
                <button style={styles.projectDeleteBtn} onClick={e => { e.stopPropagation(); deleteProject(p.slug) }}>×</button>
              </div>
            ))}
          </div>
          {!showNewProject ? (
            <button style={styles.btn} onClick={() => setShowNewProject(true)}>+ New Project</button>
          ) : (
            <div style={styles.newProjectForm}>
              <input style={styles.input} placeholder="slug (e.g. my-app)" value={newProject.slug}
                onChange={e => setNewProject(n => ({ ...n, slug: e.target.value }))} />
              <input style={styles.input} placeholder="name (e.g. My App)" value={newProject.name}
                onChange={e => setNewProject(n => ({ ...n, name: e.target.value }))} />
              <input style={styles.input} placeholder="base URL" value={newProject.base_url}
                onChange={e => setNewProject(n => ({ ...n, base_url: e.target.value }))} />
              <input style={styles.input} placeholder="model" value={newProject.model}
                onChange={e => setNewProject(n => ({ ...n, model: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={styles.btn} onClick={createProject}>Create</button>
                <button style={{ ...styles.btn, background: 'transparent' }} onClick={() => setShowNewProject(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- Main UI ---
  return (
    <div style={styles.app}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>🐂 steerhead</div>
          <button style={styles.backBtn} onClick={() => setActiveProject(null)}>← projects</button>
        </div>

        <div style={styles.projectBadge}>
          <div style={styles.projectBadgeName}>{activeProject}</div>
        </div>

        <button style={styles.newChatBtn} onClick={newChat}>+ New Chat</button>

        {/* Session list */}
        <div style={styles.section}>
          <div style={styles.label}>Chats</div>
          {sessions.length === 0 && (
            <div style={styles.emptyText}>No chats yet</div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              style={{ ...styles.sessionItem, ...(activeSession === s.id ? styles.sessionActive : {}) }}
              onClick={() => setActiveSession(s.id)}
            >
              <div style={styles.sessionTitle}>{s.title}</div>
              <div style={styles.sessionTime}>{new Date(s.updated_at).toLocaleString()}</div>
              <button style={styles.sessionDeleteBtn} onClick={e => { e.stopPropagation(); deleteSession(s.id) }}>×</button>
            </div>
          ))}
        </div>

        {/* File scope */}
        <div style={styles.section}>
          <div style={styles.label}>File Scope</div>
          <input style={styles.input} placeholder="src/auth.py, src/models.py"
            value={filePaths} onChange={e => setFilePaths(e.target.value)} />
          <div style={styles.hint}>comma-separated file paths</div>
        </div>

        {/* Constraints */}
        <div style={styles.section}>
          <div style={styles.label}>Constraints (auto-extracted)</div>
          {newConstraintFlash.length > 0 && (
            <div style={styles.flash}>
              ✨ {newConstraintFlash.length} new constraint{newConstraintFlash.length > 1 ? 's' : ''} learned
            </div>
          )}
          {constraints.length === 0 && (
            <div style={styles.emptyText}>No constraints yet. The agent will learn them from your conversation.</div>
          )}
          {constraints.map(c => (
            <div key={c.key} style={styles.constraint}>
              <div style={styles.constraintKey}>{c.key}</div>
              <div style={styles.constraintVal}>{c.value}</div>
              {c.rationale && <div style={styles.constraintRationale}>{c.rationale}</div>}
              <button style={styles.deleteBtn} onClick={() => deleteConstraint(c.key)} title="Remove">×</button>
            </div>
          ))}
        </div>

        {contextTokens !== null && (
          <div style={styles.tokens}>⚡ {contextTokens} context tokens</div>
        )}
      </div>

      {/* Chat area */}
      <div style={styles.chat}>
        <div style={styles.messages}>
          {messages.length === 0 && (
            <div style={styles.empty}>
              Project: <strong>{activeProject}</strong><br /><br />
              Every message is a fresh single-shot call.<br />
              Constraints are auto-extracted from the agent's decisions.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ ...styles.msg, ...(m.role === 'user' ? styles.userMsg : m.role === 'error' ? styles.errorMsg : styles.assistantMsg) }}>
              <div style={styles.msgRole}>{m.role === 'user' ? 'you' : m.role === 'error' ? '⚠' : '🐂'}</div>
              <pre style={{ ...styles.msgText, ...(m.role === 'error' ? styles.errorText : {}) }}>{m.text}</pre>
            </div>
          ))}
          {loading && <div style={styles.typing}>thinking...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={styles.inputRow}>
          <textarea style={styles.textarea} placeholder={`Message ${activeProject}...`}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={3} />
          <button style={styles.sendBtn} onClick={send} disabled={loading}>
            {loading ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  app: { display: 'flex', height: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'monospace' },
  picker: { margin: 'auto', width: 420, padding: 40, display: 'flex', flexDirection: 'column', gap: 20 },
  pickerSubtitle: { fontSize: 13, color: '#555' },
  projectList: { display: 'flex', flexDirection: 'column', gap: 8 },
  projectCard: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '12px 16px', cursor: 'pointer', position: 'relative' },
  projectName: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  projectSlug: { fontSize: 11, color: '#666', marginTop: 2 },
  projectMeta: { fontSize: 10, color: '#444', marginTop: 4 },
  projectDeleteBtn: { position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 16 },
  newProjectForm: { display: 'flex', flexDirection: 'column', gap: 8, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, padding: 16 },
  sidebar: { width: 300, padding: 16, borderRight: '1px solid #222', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #222' },
  backBtn: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' },
  projectBadge: { background: '#1a1a2a', border: '1px solid #333', borderRadius: 4, padding: '6px 10px' },
  projectBadgeName: { fontSize: 13, color: '#8888ff', fontWeight: 'bold' },
  newChatBtn: { background: '#1a2a1a', border: '1px solid #2a4a2a', color: '#6a6', borderRadius: 4, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'monospace', textAlign: 'center' },
  logo: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  input: { background: '#1a1a1a', border: '1px solid #333', color: '#e0e0e0', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' },
  hint: { fontSize: 10, color: '#444' },
  btn: { background: '#222', border: '1px solid #444', color: '#e0e0e0', padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace' },
  emptyText: { fontSize: 11, color: '#444', fontStyle: 'italic' },

  // Sessions
  sessionItem: { background: '#141414', border: '1px solid #1a1a1a', borderRadius: 4, padding: '8px 10px', cursor: 'pointer', position: 'relative' },
  sessionActive: { background: '#1a1a2a', borderColor: '#333' },
  sessionTitle: { fontSize: 12, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 20 },
  sessionTime: { fontSize: 9, color: '#444', marginTop: 2 },
  sessionDeleteBtn: { position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14 },

  // Constraints
  flash: { background: '#1a2a1a', border: '1px solid #2a4a2a', color: '#6a6', borderRadius: 4, padding: '6px 10px', fontSize: 11, textAlign: 'center' },
  constraint: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' },
  constraintKey: { fontSize: 11, color: '#888', fontWeight: 'bold' },
  constraintVal: { fontSize: 12, color: '#ccc' },
  constraintRationale: { fontSize: 10, color: '#555', fontStyle: 'italic' },
  deleteBtn: { position: 'absolute', top: 4, right: 6, background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 },

  tokens: { fontSize: 11, color: '#555', marginTop: 'auto' },

  // Chat
  chat: { flex: 1, display: 'flex', flexDirection: 'column' },
  messages: { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 },
  empty: { color: '#333', textAlign: 'center', marginTop: 80, fontSize: 13, lineHeight: 1.8 },
  msg: { maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4 },
  userMsg: { alignSelf: 'flex-end' },
  assistantMsg: { alignSelf: 'flex-start' },
  errorMsg: { alignSelf: 'center' },
  msgRole: { fontSize: 10, color: '#555', textTransform: 'uppercase' },
  msgText: { background: '#1a1a1a', border: '1px solid #222', borderRadius: 6, padding: '10px 14px', margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 },
  errorText: { borderColor: '#442222', color: '#cc6666' },
  typing: { color: '#444', fontSize: 12, fontStyle: 'italic' },
  inputRow: { display: 'flex', gap: 8, padding: 16, borderTop: '1px solid #222' },
  textarea: { flex: 1, background: '#1a1a1a', border: '1px solid #333', color: '#e0e0e0', padding: '10px 12px', borderRadius: 6, fontSize: 13, fontFamily: 'monospace', resize: 'none' },
  sendBtn: { background: '#fff', color: '#000', border: 'none', borderRadius: 6, padding: '0 20px', cursor: 'pointer', fontSize: 18, fontWeight: 'bold' },
}
