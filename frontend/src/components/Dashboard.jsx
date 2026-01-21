import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";
import AuthModal from "./AuthModal";
import { 
  Code2, Sparkles, Users, Zap, Terminal, ArrowRight,
  Cpu, Github, Twitter, PenTool, ListChecks, Trophy, Send,
  Shield, Play, MousePointer2
} from "lucide-react";

// --- HOOKS ---
const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const updateMousePosition = ev => setMousePosition({ x: ev.clientX, y: ev.clientY });
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);
  return mousePosition;
};

// --- COMPONENTS ---

// 1. FLOATING NAVBAR
const FloatingNav = ({ user, logout, setAuthOpen }) => (
  <nav className="floating-nav">
    <div className="nav-glass">
      <Link to="/" className="nav-logo">
        <Code2 size={24} className="text-accent" />
        <span className="font-bold">CodePlay</span>
      </Link>

      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#community">Community</a>
        <a href="https://github.com/codeplay" target="_blank" rel="noreferrer">GitHub</a>
      </div>

      <div className="nav-actions">
        {user ? (
          <>
            <Link to="/profile" className="nav-user">
              {user.avatar ? <img src={user.avatar} alt={user.username} /> : <span>{user.username[0]}</span>}
            </Link>
            <button onClick={logout} className="btn-ghost-sm">Logout</button>
          </>
        ) : (
          <button onClick={() => setAuthOpen(true)} className="btn-accent-sm">
            Sign In
          </button>
        )}
      </div>
    </div>
  </nav>
);

// 2. HERO SECTION WITH 3D TILT
const HeroSection = ({ handleCreateRoom, roomId, setRoomId, handleJoin }) => {
  const mouse = useMousePosition();
  const heroRef = useRef(null);

  // Calculate tilt based on mouse position
  const calculateTilt = () => {
    if (!heroRef.current) return { x: 0, y: 0 };
    const rect = heroRef.current.getBoundingClientRect();
    const x = (mouse.x - rect.left - rect.width / 2) / 25;
    const y = -(mouse.y - rect.top - rect.height / 2) / 25;
    return { x, y };
  };

  const tilt = calculateTilt();

  return (
    <section className="hero-section" ref={heroRef}>
      <div className="hero-content">
        <div className="pill-badge">
          <Sparkles size={12} className="text-accent" />
          <span>V2.0 is live</span>
        </div>

        <h1 className="hero-title">
          Build faster, <br/>
          <span className="text-gradient">together.</span>
        </h1>

        <p className="hero-sub">
          The open-source collaborative code editor for the next generation.
          Real-time sync, AI assistance, and integrated problem sets.
        </p>

        <div className="hero-input-group">
          <div className="input-wrapper">
            <Terminal size={16} className="input-icon"/>
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room code..."
            />
            <button onClick={handleJoin} disabled={!roomId} className="btn-join">Join</button>
          </div>
          <span className="or-divider">or</span>
          <button onClick={handleCreateRoom} className="btn-create">
            Create Room <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="hero-visual" style={{ transform: `perspective(1000px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}>
        <div className="visual-window">
          <div className="window-bar">
            <div className="dots">
              <div className="dot red"/>
              <div className="dot yellow"/>
              <div className="dot green"/>
            </div>
            <div className="window-title">collaboration.tsx</div>
          </div>
          <div className="window-content">
            <div className="code-line"><span className="k">export default</span> <span className="f">function</span> <span className="c">App</span>() {'{'}</div>
            <div className="code-line indent">  <span className="k">const</span> [user, setUser] = <span className="f">useState</span>(<span className="s">null</span>);</div>
            <div className="code-line indent">  <span className="c">// Real-time magic happens here ✨</span></div>
            <div className="code-line indent">  <span className="k">return</span> (</div>
            <div className="code-line indent-2">    &lt;<span className="t">Editor</span> </div>
            <div className="code-line indent-3">      <span className="p">mode</span>=<span className="s">"multiplayer"</span></div>
            <div className="code-line indent-3">      <span className="p">ai</span>={'{'}<span className="k">true</span>{'}'}</div>
            <div className="code-line indent-2">    /&gt;</div>
            <div className="code-line indent">  );</div>
            <div className="code-line">{'}'}</div>

            <div className="cursor-badge">
              <MousePointer2 size={12} fill="#8b5cf6" />
              <span>Sarah</span>
            </div>
          </div>
        </div>
        <div className="glow-effect" />
      </div>
    </section>
  );
};

// 3. BENTO GRID FEATURES
const BentoGrid = () => (
  <section id="features" className="bento-section">
    <h2 className="section-header">Everything you need</h2>
    <div className="bento-grid">
      {/* LARGE CARD */}
      <div className="bento-card large">
        <div className="card-content">
          <Cpu size={32} className="card-icon text-orange"/>
          <h3>AI Copilot</h3>
          <p>Integrated Gemini AI to debug, explain, and optimize your code in real-time.</p>
        </div>
        <div className="card-visual ai-visual" />
      </div>

      {/* TALL CARD */}
      <div className="bento-card tall">
        <div className="card-content">
          <ListChecks size={32} className="card-icon text-violet"/>
          <h3>DSA Sheets</h3>
          <p>Striver's A2Z & CP-31 built right in.</p>
        </div>
        <div className="list-visual">
          <div className="list-item checked">Two Sum</div>
          <div className="list-item checked">LRU Cache</div>
          <div className="list-item">Merge Intervals</div>
        </div>
      </div>

      {/* MEDIUM CARD */}
      <div className="bento-card medium">
        <div className="card-content">
          <Users size={32} className="card-icon text-blue"/>
          <h3>Real-time Sync</h3>
          <p>Zero latency collaboration with Yjs & WebSockets.</p>
        </div>
      </div>

      {/* MEDIUM CARD */}
      <div className="bento-card medium">
        <div className="card-content">
          <Send size={32} className="card-icon text-green"/>
          <h3>Direct Submit</h3>
          <p>Codeforces & LeetCode integration.</p>
        </div>
      </div>

      {/* WIDE CARD */}
      <div className="bento-card wide">
        <div className="card-content">
          <PenTool size={32} className="card-icon text-pink"/>
          <h3>Infinite Whiteboard</h3>
          <p>Plan algorithms visually with your team using a shared canvas.</p>
        </div>
      </div>
    </div>
  </section>
);

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [roomId, setRoomId] = useState("");

  const handleCreateRoom = async () => {
    if (!user) { setAuthOpen(true); return; }
    const randomId = Math.random().toString(36).substring(7);
    try {
      const res = await fetch(`${API_URL}/api/rooms/create`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: randomId, username: user.username })
      });
      if (res.ok) navigate(`/editor/${randomId}`);
    } catch (e) { console.error(e); }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomId.trim()) navigate(`/editor/${roomId}`);
  };

  return (
    <div className="dashboard-container">
      <style>{cssStyles}</style>
      <div className="bg-gradient" />
      
      <FloatingNav user={user} logout={logout} setAuthOpen={setAuthOpen} />

      <main className="main-content">
        <HeroSection
          handleCreateRoom={handleCreateRoom}
          roomId={roomId}
          setRoomId={setRoomId}
          handleJoin={handleJoin}
        />
        <BentoGrid />
      </main>

      <footer className="footer">
        <div className="footer-links">
          <span>© 2024 CodePlay</span>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
        <div className="footer-socials">
          <Github size={20} />
          <Twitter size={20} />
        </div>
      </footer>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

const cssStyles = `
/* --- VARIABLES --- */
:root {
  --bg-dash: #030303;
  --glass-border: rgba(255,255,255,0.08);
  --glass-bg: rgba(20,20,20,0.6);
  --accent-primary: #8b5cf6;
  --text-main: #ededed;
  --text-muted: #888888;
}

.dashboard-container {
  min-height: 100vh;
  background-color: var(--bg-dash);
  color: var(--text-main);
  font-family: 'Inter', sans-serif;
  overflow-x: hidden;
  position: relative;
}

.bg-gradient {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background:
    radial-gradient(circle at 15% 0%, rgba(139, 92, 246, 0.15), transparent 40%),
    radial-gradient(circle at 85% 30%, rgba(59, 130, 246, 0.15), transparent 40%);
  z-index: 0;
  pointer-events: none;
}

.main-content {
  position: relative;
  z-index: 10;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* --- FLOATING NAV --- */
.floating-nav {
  position: fixed;
  top: 24px;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  z-index: 100;
  pointer-events: none; /* Let clicks pass through outside the pill */
}

.nav-glass {
  pointer-events: auto;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  padding: 12px 24px;
  border-radius: 100px;
  display: flex;
  align-items: center;
  gap: 48px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  transition: transform 0.2s;
}

.nav-glass:hover {
  transform: translateY(2px);
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: white;
}

.nav-links {
  display: flex;
  gap: 24px;
}

.nav-links a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: white;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-accent-sm {
  background: white;
  color: black;
  border: none;
  padding: 8px 16px;
  border-radius: 100px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-accent-sm:hover { opacity: 0.9; }

.nav-user img {
  width: 28px; height: 28px; border-radius: 50%;
}
.nav-user span {
  width: 28px; height: 28px; border-radius: 50%; background: #333; display: flex; align-items: center; justifyContent: center; font-size: 12px; font-weight: bold;
}

/* --- HERO SECTION --- */
.hero-section {
  min-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding-top: 100px;
  perspective: 1000px; /* For 3D tilt */
}

.pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 100px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--glass-border);
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 24px;
}

.hero-title {
  font-size: 80px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -3px;
  margin-bottom: 24px;
}

.text-gradient {
  background: linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-sub {
  font-size: 18px;
  color: var(--text-muted);
  max-width: 500px;
  line-height: 1.6;
  margin-bottom: 48px;
}

.hero-input-group {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 80px;
}

.input-wrapper {
  background: #111;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 6px;
  display: flex;
  align-items: center;
  transition: border-color 0.2s;
}

.input-wrapper:focus-within {
  border-color: var(--accent-primary);
}

.input-wrapper input {
  background: transparent;
  border: none;
  color: white;
  padding: 8px;
  width: 140px;
  outline: none;
}

.btn-join {
  background: #222;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-join:hover:not(:disabled) { background: #333; }

.or-divider {
  color: var(--text-muted);
  font-size: 14px;
}

.btn-create {
  background: linear-gradient(180deg, #fff 0%, #e5e5e5 100%);
  color: black;
  border: none;
  padding: 14px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 0 20px rgba(255,255,255,0.15);
  transition: transform 0.1s;
}
.btn-create:hover { transform: scale(1.02); }

/* --- HERO VISUAL (3D) --- */
.hero-visual {
  width: 800px;
  height: 500px;
  position: relative;
  transition: transform 0.1s ease-out; /* Smooth follow */
}

.visual-window {
  width: 100%;
  height: 100%;
  background: #0a0a0a;
  border: 1px solid #222;
  border-radius: 16px;
  box-shadow: 0 50px 100px -20px rgba(0,0,0,0.5);
  overflow: hidden;
  position: relative;
  z-index: 2;
}

.window-bar {
  height: 40px;
  background: #111;
  border-bottom: 1px solid #222;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.dots { display: flex; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.red { background: #ef4444; } .yellow { background: #eab308; } .green { background: #22c55e; }

.window-title { flex: 1; text-align: center; color: #444; font-size: 12px; font-family: monospace; }

.window-content { padding: 24px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: #d4d4d4; }
.code-line { line-height: 1.6; }
.indent { padding-left: 20px; }
.indent-2 { padding-left: 40px; }
.indent-3 { padding-left: 60px; }

/* Syntax Highlighting */
.k { color: #c084fc; } /* Keyword */
.f { color: #f472b6; } /* Function */
.c { color: #6272a4; } /* Comment/Component */
.s { color: #f1fa8c; } /* String */
.t { color: #8be9fd; } /* Tag */
.p { color: #ff79c6; } /* Prop */

.cursor-badge {
  position: absolute;
  top: 180px;
  left: 200px;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid #8b5cf6;
  color: #8b5cf6;
  padding: 4px 8px;
  border-radius: 100px;
  border-top-left-radius: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  animation: floatCursor 4s ease-in-out infinite;
}

@keyframes floatCursor { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(20px, 40px); } }

.glow-effect {
  position: absolute;
  top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 600px; height: 300px;
  background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%);
  filter: blur(60px);
  z-index: 1;
}

/* --- BENTO GRID --- */
.bento-section {
  padding: 100px 0;
}

.section-header {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 40px;
  text-align: center;
}

.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 300px);
  gap: 24px;
}

.bento-card {
  background: #0a0a0a;
  border: 1px solid #222;
  border-radius: 24px;
  padding: 32px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
}

.bento-card:hover {
  border-color: #333;
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}

.card-content { z-index: 2; }
.card-icon { margin-bottom: 16px; }
.text-orange { color: #f97316; } .text-violet { color: #8b5cf6; }
.text-blue { color: #3b82f6; } .text-green { color: #22c55e; } .text-pink { color: #ec4899; }

.bento-card h3 { font-size: 20px; margin-bottom: 8px; font-weight: 600; }
.bento-card p { color: var(--text-muted); font-size: 14px; line-height: 1.5; }

/* Grid Spans */
.large { grid-column: span 2; }
.tall { grid-row: span 2; }
.medium { grid-column: span 1; }
.wide { grid-column: span 2; }

/* Visuals inside Bento */
.list-visual {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.list-item {
  background: #111; padding: 12px; border-radius: 8px; font-size: 13px; border: 1px solid #222;
  display: flex; align-items: center; gap: 8px;
}
.checked::before { content: "✓"; color: #22c55e; font-weight: bold; }

/* FOOTER */
.footer {
  margin-top: 100px;
  border-top: 1px solid #222;
  padding: 40px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-muted);
  font-size: 14px;
}
.footer-links { display: flex; gap: 24px; }
.footer-links a { color: var(--text-muted); text-decoration: none; }
.footer-socials { display: flex; gap: 16px; }

/* RESPONSIVE */
@media (max-width: 1024px) {
  .bento-grid { grid-template-columns: repeat(2, 1fr); grid-template-rows: auto; }
  .large, .wide, .medium, .tall { grid-column: span 1; grid-row: span 1; }
  .hero-visual { width: 100%; height: 300px; }
  .hero-title { font-size: 48px; }
}

@media (max-width: 768px) {
  .nav-links { display: none; }
  .bento-grid { grid-template-columns: 1fr; }
  .hero-input-group { flex-direction: column; width: 100%; }
  .input-wrapper { width: 100%; }
  .btn-create { width: 100%; justify-content: center; }
}
`;
