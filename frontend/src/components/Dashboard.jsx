import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";
import AuthModal from "./AuthModal";
import { 
  Code2, Sparkles, Users, Zap, Terminal, ArrowRight,
  Cpu, PenTool, Trophy, Send, MousePointer2
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

// 1. FLOATING NAVBAR (Updated)
const FloatingNav = ({ user, logout, setAuthOpen }) => (
  <nav className="floating-nav">
    <div className="nav-glass">
      <Link to="/" className="nav-logo">
        <Code2 size={24} className="text-accent" />
        <span className="font-bold">CodePlay</span>
      </Link>

      <div className="nav-links">
        <a href="#features">Features</a>
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

// 2. HERO SECTION
const HeroSection = ({ handleCreateRoom, roomId, setRoomId, handleJoin }) => {
  const mouse = useMousePosition();
  const heroRef = useRef(null);

  const calculateTilt = () => {
    if (!heroRef.current) return { x: 0, y: 0 };
    const rect = heroRef.current.getBoundingClientRect();
    const x = (mouse.x - rect.left - rect.width / 2) / 30;
    const y = -(mouse.y - rect.top - rect.height / 2) / 30;
    return { x, y };
  };

  const tilt = calculateTilt();

  return (
    <section className="hero-section" ref={heroRef}>
      <div className="hero-content">
        <div className="pill-badge">
          <Sparkles size={12} className="text-accent" />
          <span>V2.0 Now Available</span>
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
              <span>CodePlay</span>
            </div>
          </div>
        </div>
        <div className="glow-effect" />
      </div>
    </section>
  );
};

// 3. FEATURES SPOTLIGHT (SYMMETRIC GRID REDESIGN)
const FeaturesSpotlight = () => (
  <section id="features" className="spotlight-section">
    <div className="section-intro">
      <h2>Everything you need</h2>
      <p>Powerful tools designed for modern development workflows.</p>
    </div>

    <div className="spotlight-grid">
        <div className="spotlight-card">
            <div className="spotlight-content">
                <div className="icon-box icon-purple"><Cpu size={24} /></div>
                <h3>AI Copilot</h3>
                <p>Intelligent code completion and debugging assistance powered by Gemini.</p>
            </div>
            <div className="spotlight-visual gradient-purple" />
        </div>

        <div className="spotlight-card">
            <div className="spotlight-content">
                <div className="icon-box icon-blue"><Users size={24} /></div>
                <h3>Real-time Sync</h3>
                <p>Code with your team with zero latency. See every keystroke as it happens.</p>
            </div>
            <div className="spotlight-visual gradient-blue" />
        </div>

        <div className="spotlight-card">
            <div className="spotlight-content">
                <div className="icon-box icon-green"><Trophy size={24} /></div>
                <h3>DSA Mastery</h3>
                <p>Integrated CP-31 and Striver's A2Z sheets to track your progress.</p>
            </div>
            <div className="spotlight-visual gradient-green" />
        </div>

        <div className="spotlight-card">
            <div className="spotlight-content">
                <div className="icon-box icon-orange"><Send size={24} /></div>
                <h3>Direct Submissions</h3>
                <p>Submit solutions to Codeforces and LeetCode directly from the editor.</p>
            </div>
            <div className="spotlight-visual gradient-orange" />
        </div>

        <div className="spotlight-card">
            <div className="spotlight-content">
                <div className="icon-box icon-pink"><PenTool size={24} /></div>
                <h3>Whiteboard</h3>
                <p>Plan algorithms visually with your team using a shared canvas.</p>
            </div>
            <div className="spotlight-visual gradient-pink" />
        </div>

        <div className="spotlight-card">
            <div className="spotlight-content">
                <div className="icon-box icon-yellow"><Zap size={24} /></div>
                <h3>Instant Setup</h3>
                <p>No configuration required. Just create a room and start coding instantly.</p>
            </div>
            <div className="spotlight-visual gradient-yellow" />
        </div>
    </div>
  </section>
);

// 4. FOOTER (SIMPLIFIED)
const Footer = () => (
  <footer className="mega-footer">
    <div className="footer-glow" />
    <div className="footer-container">
        <div className="footer-top">
            <div className="footer-brand">
                <Code2 size={32} className="text-accent" />
                <span className="footer-logo-text">CodePlay</span>
            </div>
            <p className="footer-mission">
                Empowering the next generation of developers <br/> with collaborative tools and AI.
            </p>
        </div>

        <div className="footer-bottom">
            <p>© 2025 CodePlay. All rights reserved.</p>
            <div className="footer-watermark">CODEPLAY</div>
        </div>
    </div>
  </footer>
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
        <FeaturesSpotlight />
      </main>

      <Footer />

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

const cssStyles = `
/* --- VARIABLES --- */
:root {
  --bg-dash: #050505;
  --glass-border: rgba(255,255,255,0.08);
  --glass-bg: rgba(10,10,10,0.6);
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
    radial-gradient(circle at 15% 0%, rgba(139, 92, 246, 0.08), transparent 40%),
    radial-gradient(circle at 85% 30%, rgba(6, 182, 212, 0.08), transparent 40%);
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
  pointer-events: none;
}

.nav-glass {
  pointer-events: auto;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  padding: 10px 24px;
  border-radius: 100px;
  display: flex;
  align-items: center;
  gap: 48px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  transition: transform 0.2s;
}

.nav-glass:hover { transform: translateY(2px); }

.nav-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; color: white; }
.nav-links { display: flex; gap: 24px; }
.nav-links a { color: var(--text-muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
.nav-links a:hover { color: white; }
.nav-actions { display: flex; align-items: center; gap: 16px; }

.btn-accent-sm { background: white; color: black; border: none; padding: 8px 16px; border-radius: 100px; font-weight: 600; font-size: 13px; cursor: pointer; transition: opacity 0.2s; }
.btn-accent-sm:hover { opacity: 0.9; }
.btn-ghost-sm { background: transparent; color: var(--text-muted); border: none; font-size: 13px; cursor: pointer; }
.btn-ghost-sm:hover { color: white; }

.nav-user img { width: 28px; height: 28px; border-radius: 50%; }
.nav-user span { width: 28px; height: 28px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }

/* --- HERO SECTION --- */
.hero-section {
  min-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding-top: 100px;
  perspective: 1000px;
}

.pill-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-radius: 100px;
  background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);
  font-size: 12px; color: var(--text-muted); margin-bottom: 24px;
}

.hero-title { font-size: 80px; font-weight: 800; line-height: 1; letter-spacing: -3px; margin-bottom: 24px; }
.text-gradient { background: linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-sub { font-size: 18px; color: var(--text-muted); max-width: 500px; line-height: 1.6; margin-bottom: 48px; }

.hero-input-group { display: flex; align-items: center; gap: 16px; margin-bottom: 80px; }
.input-wrapper { background: #111; border: 1px solid var(--glass-border); border-radius: 12px; padding: 6px; display: flex; align-items: center; transition: border-color 0.2s; }
.input-wrapper:focus-within { border-color: var(--accent-primary); }
.input-wrapper input { background: transparent; border: none; color: white; padding: 8px; width: 140px; outline: none; }
.btn-join { background: #222; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
.btn-join:hover:not(:disabled) { background: #333; }
.or-divider { color: var(--text-muted); font-size: 14px; }
.btn-create { background: linear-gradient(180deg, #fff 0%, #e5e5e5 100%); color: black; border: none; padding: 14px 24px; border-radius: 12px; font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 0 20px rgba(255,255,255,0.15); transition: transform 0.1s; }
.btn-create:hover { transform: scale(1.02); }

/* --- HERO VISUAL (3D) --- */
.hero-visual { width: 800px; height: 500px; position: relative; transition: transform 0.1s ease-out; }
.visual-window { width: 100%; height: 100%; background: #0a0a0a; border: 1px solid #222; border-radius: 16px; box-shadow: 0 50px 100px -20px rgba(0,0,0,0.5); overflow: hidden; position: relative; z-index: 2; }
.window-bar { height: 40px; background: #111; border-bottom: 1px solid #222; display: flex; align-items: center; padding: 0 16px; }
.dots { display: flex; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.red { background: #ef4444; } .yellow { background: #eab308; } .green { background: #22c55e; }
.window-title { flex: 1; text-align: center; color: #444; font-size: 12px; font-family: monospace; }
.window-content { padding: 24px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: #d4d4d4; }
.code-line { line-height: 1.6; } .indent { padding-left: 20px; } .indent-2 { padding-left: 40px; } .indent-3 { padding-left: 60px; }
.k { color: #c084fc; } .f { color: #f472b6; } .c { color: #6272a4; } .s { color: #f1fa8c; } .t { color: #8be9fd; } .p { color: #ff79c6; }
.cursor-badge { position: absolute; top: 180px; left: 200px; background: rgba(139, 92, 246, 0.2); border: 1px solid #8b5cf6; color: #8b5cf6; padding: 4px 8px; border-radius: 100px; border-top-left-radius: 0; display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; animation: floatCursor 4s ease-in-out infinite; }
@keyframes floatCursor { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(20px, 40px); } }
.glow-effect { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; height: 300px; background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%); filter: blur(60px); z-index: 1; animation: pulseGlow 4s ease-in-out infinite; }
@keyframes pulseGlow { 0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); } }

/* --- FEATURES SPOTLIGHT --- */
.spotlight-section { padding: 120px 0; }
.section-intro { text-align: center; margin-bottom: 60px; }
.section-intro h2 { font-size: 40px; font-weight: 800; margin-bottom: 12px; background: linear-gradient(135deg, #fff 0%, #888 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.section-intro p { font-size: 18px; color: var(--text-muted); }

/* GRID UPDATES: Symmetric 3x2 Grid */
.spotlight-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.spotlight-card {
  background: linear-gradient(145deg, rgba(15,15,15,1) 0%, rgba(8,8,8,1) 100%);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  padding: 28px;
  position: relative;
  overflow: hidden;
  height: 220px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  animation: fadeInUp 0.6s ease-out backwards;
}

.spotlight-card:nth-child(1) { animation-delay: 0.1s; }
.spotlight-card:nth-child(2) { animation-delay: 0.2s; }
.spotlight-card:nth-child(3) { animation-delay: 0.3s; }
.spotlight-card:nth-child(4) { animation-delay: 0.4s; }
.spotlight-card:nth-child(5) { animation-delay: 0.5s; }
.spotlight-card:nth-child(6) { animation-delay: 0.6s; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.spotlight-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 20px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent 50%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.4s;
}

.spotlight-card:hover::before { opacity: 1; }

.spotlight-card:hover { 
  border-color: rgba(255,255,255,0.12); 
  transform: translateY(-8px) scale(1.02); 
  box-shadow: 0 25px 50px rgba(0,0,0,0.4), 0 0 40px rgba(139, 92, 246, 0.08);
}

.spotlight-content { position: relative; z-index: 2; }
.icon-box { 
  width: 48px; 
  height: 48px; 
  border-radius: 12px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  margin-bottom: 20px; 
  position: relative;
  transition: all 0.3s;
}

.spotlight-card:hover .icon-box {
  transform: scale(1.1);
}

.icon-purple { background: rgba(139, 92, 246, 0.15); color: #a78bfa; box-shadow: 0 0 20px rgba(139, 92, 246, 0.2); }
.icon-blue { background: rgba(6, 182, 212, 0.15); color: #22d3ee; box-shadow: 0 0 20px rgba(6, 182, 212, 0.2); }
.icon-green { background: rgba(34, 197, 94, 0.15); color: #4ade80; box-shadow: 0 0 20px rgba(34, 197, 94, 0.2); }
.icon-orange { background: rgba(249, 115, 22, 0.15); color: #fb923c; box-shadow: 0 0 20px rgba(249, 115, 22, 0.2); }
.icon-pink { background: rgba(236, 72, 153, 0.15); color: #f472b6; box-shadow: 0 0 20px rgba(236, 72, 153, 0.2); }
.icon-yellow { background: rgba(234, 179, 8, 0.15); color: #facc15; box-shadow: 0 0 20px rgba(234, 179, 8, 0.2); }

.spotlight-card:hover .icon-purple { box-shadow: 0 0 30px rgba(139, 92, 246, 0.4); }
.spotlight-card:hover .icon-blue { box-shadow: 0 0 30px rgba(6, 182, 212, 0.4); }
.spotlight-card:hover .icon-green { box-shadow: 0 0 30px rgba(34, 197, 94, 0.4); }
.spotlight-card:hover .icon-orange { box-shadow: 0 0 30px rgba(249, 115, 22, 0.4); }
.spotlight-card:hover .icon-pink { box-shadow: 0 0 30px rgba(236, 72, 153, 0.4); }
.spotlight-card:hover .icon-yellow { box-shadow: 0 0 30px rgba(234, 179, 8, 0.4); }

.spotlight-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 10px; color: #fff; }
.spotlight-card p { font-size: 14px; color: var(--text-muted); line-height: 1.6; }

.spotlight-visual { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; opacity: 0.08; transition: opacity 0.4s; }
.spotlight-card:hover .spotlight-visual { opacity: 0.25; }
.gradient-purple { background: radial-gradient(circle at 100% 0%, #8b5cf6, transparent 50%); }
.gradient-blue { background: radial-gradient(circle at 100% 100%, #06b6d4, transparent 50%); }
.gradient-green { background: radial-gradient(circle at 100% 100%, #22c55e, transparent 50%); }
.gradient-orange { background: radial-gradient(circle at 100% 0%, #f97316, transparent 50%); }
.gradient-pink { background: radial-gradient(circle at 100% 0%, #ec4899, transparent 50%); }
.gradient-yellow { background: radial-gradient(circle at 100% 100%, #eab308, transparent 50%); }

/* --- FOOTER --- */
.mega-footer { position: relative; background: linear-gradient(180deg, #030303 0%, #000 100%); padding: 80px 0 40px; border-top: 1px solid rgba(255,255,255,0.05); overflow: hidden; margin-top: 80px; }
.footer-glow { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 40%; height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5), transparent); }
.footer-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 2; }

.footer-top { text-align: center; margin-bottom: 40px; }
.footer-brand { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 16px; }
.footer-brand svg { color: #8b5cf6; }
.footer-logo-text { font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #fff 0%, #888 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.footer-mission { font-size: 15px; color: var(--text-muted); line-height: 1.7; max-width: 400px; margin: 0 auto; }

.footer-bottom { display: flex; justify-content: center; align-items: center; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.05); position: relative; }
.footer-bottom p { color: #555; font-size: 13px; }
.footer-watermark { position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%); font-size: 100px; font-weight: 900; color: rgba(255,255,255,0.02); pointer-events: none; z-index: -1; letter-spacing: 10px; white-space: nowrap; }

/* RESPONSIVE */
@media (max-width: 1024px) {
  .spotlight-grid { grid-template-columns: repeat(2, 1fr); }
  .hero-visual { width: 100%; height: 300px; }
  .hero-title { font-size: 48px; }
}

@media (max-width: 768px) {
  .nav-links { display: none; }
  .spotlight-grid { grid-template-columns: 1fr; }
  .hero-input-group { flex-direction: column; width: 100%; }
  .input-wrapper { width: 100%; }
  .btn-create { width: 100%; justify-content: center; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .footer-watermark { display: none; }
}
`;
