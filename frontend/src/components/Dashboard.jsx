import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";
import AuthModal from "./AuthModal";
import { 
  Code2, Sparkles, Users, Zap, Terminal, ArrowRight,
  Cpu, PenTool, Trophy, Send, MousePointer2, User,
  Download, ExternalLink, Chrome, Puzzle
} from "lucide-react";
import "./Dashboard.css";

// --- FLOATING NAVBAR ---
const FloatingNav = ({ user, logout, setAuthOpen }) => {
  const [scrolled, setScrolled] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`floating-nav ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-glass">
        <Link to="/" className="nav-logo">
          <Code2 size={22} />
          <span>CodePlay</span>
        </Link>

        <div className="nav-links">
          <a href="#features">Features</a>
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/profile" className="nav-avatar">
                {user.avatar && !avatarError ? (
                  <img src={user.avatar} alt="" onError={() => setAvatarError(true)} />
                ) : (
                  <div className="avatar-placeholder">
                    <User size={14} />
                  </div>
                )}
              </Link>
              <button onClick={logout} className="btn-nav-ghost">Logout</button>
            </>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="btn-nav-primary">
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

// --- HERO SECTION ---
const HeroSection = ({ handleCreateRoom, roomId, setRoomId, handleJoin }) => {
  const visualRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!visualRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 8;
      const y = -(e.clientY / window.innerHeight - 0.5) * 8;
      visualRef.current.style.transform = `perspective(1200px) rotateY(${x}deg) rotateX(${y}deg)`;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section className="hero">
      <div className="hero-badge">
        <Sparkles size={12} />
        <span>V2.0 — Now with AI Copilot</span>
      </div>

      <h1 className="hero-title">
        Code together.<br />
        <span className="gradient-text">Build faster.</span>
      </h1>

      <p className="hero-subtitle">
        The collaborative code editor for the next generation of developers.
        Real-time sync, AI assistance, and integrated problem solving.
      </p>

      <div className="hero-actions">
        <div className="input-group">
          <Terminal size={16} className="input-icon" />
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room code..."
            onKeyDown={(e) => e.key === "Enter" && roomId.trim() && handleJoin(e)}
          />
          <button onClick={handleJoin} disabled={!roomId.trim()} className="btn-join">
            Join
          </button>
        </div>
        <span className="or-text">or</span>
        <button onClick={handleCreateRoom} className="btn-create">
          Create Room <ArrowRight size={16} />
        </button>
      </div>

      {/* 3D Code Editor Visual */}
      <div className="hero-visual-wrapper">
        <div className="hero-visual" ref={visualRef}>
          <div className="visual-window">
            <div className="window-titlebar">
              <div className="traffic-lights">
                <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
              </div>
              <div className="window-tab">
                <span className="tab-icon">TSX</span>
                <span>collaboration.tsx</span>
              </div>
              <div className="window-spacer" />
            </div>

            <div className="editor-body">
              <div className="line-numbers">
                {Array.from({ length: 18 }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <div className="code-area">
                <div className="code-line"><span className="kw">import</span> {"{ Editor, useCollaboration }"} <span className="kw">from</span> <span className="str">'codeplay-sdk'</span>;</div>
                <div className="code-line"><span className="cmt">// Welcome to the next generation of coding</span></div>
                <div className="code-line"><span className="kw">export default function</span> <span className="fn">LiveSession</span>() {"{"}</div>
                <div className="code-line i1"><span className="kw">const</span> {"{ peers, isSynced }"} = <span className="fn">useCollaboration</span>(<span className="str">'room-88'</span>);</div>
                <div className="code-line" />
                <div className="code-line i1"><span className="kw">return</span> (</div>
                <div className="code-line i2">&lt;<span className="tp">div</span> <span className="pr">className</span>=<span className="str">"workspace"</span>&gt;</div>
                <div className="code-line i3">&lt;<span className="tp">Editor</span></div>
                <div className="code-line i4"><span className="pr">filename</span>=<span className="str">"collaboration.tsx"</span></div>
                <div className="code-line i4"><span className="pr">theme</span>=<span className="str">"vs-dark"</span></div>
                <div className="code-line i4"><span className="pr">mode</span>=<span className="str">"live-share"</span></div>
                <div className="code-line i4"><span className="pr">ai</span>={"{{ suggestions: "}<span className="kw">true</span>{" }}"}</div>
                <div className="code-line i4"><span className="pr">cursors</span>={"{peers.map(p => p.cursor)}"}</div>
                <div className="code-line i3">/&gt;</div>
                <div className="code-line i2">&lt;/<span className="tp">div</span>&gt;</div>
                <div className="code-line i1">);</div>
                <div className="code-line">{"}"}</div>

                <div className="cursor-overlay">
                  <MousePointer2 size={12} fill="#fff" />
                  <span>CodePlay</span>
                </div>
              </div>
            </div>

            <div className="status-bar">
              <div className="sb-left">
                <span><Zap size={10} /> main</span>
                <span>0 errors</span>
              </div>
              <div className="sb-right">
                <span>Ln 18, Col 1</span>
                <span>UTF-8</span>
                <span>TypeScript React</span>
                <span><Users size={10} /> 2 online</span>
              </div>
            </div>
          </div>
          <div className="visual-glow" />
        </div>
      </div>
    </section>
  );
};

// --- EXTENSION CTA BANNER ---
const EXTENSION_URL = "https://chromewebstore.google.com/detail/codeplay-helper/ldkpphfppokocibnlbdbkiohgocfgelb";

const ExtensionBanner = () => (
  <section className="extension-banner">
    <div className="extension-banner-glow" />
    <div className="extension-banner-inner">
      <div className="extension-badge">
        <Zap size={12} />
        <span>Required for Submissions</span>
      </div>

      <div className="extension-content">
        <div className="extension-icon-wrapper">
          <div className="extension-icon-ring">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" fill="url(#chromeGrad)" />
              <circle cx="24" cy="24" r="8" fill="#fff" />
              <path d="M24 4a20 20 0 0 1 17.32 10H24V4z" fill="#EA4335" />
              <path d="M41.32 14A20 20 0 0 1 24 44l7-12.12L41.32 14z" fill="#34A853" />
              <path d="M24 44A20 20 0 0 1 6.68 14l10.32 18L24 44z" fill="#4285F4" />
              <path d="M6.68 14A20 20 0 0 1 24 4v10H6.68z" fill="#FBBC05" />
              <circle cx="24" cy="24" r="8" fill="#fff" />
              <defs>
                <radialGradient id="chromeGrad" cx="0.5" cy="0.5" r="0.5">
                  <stop stopColor="#fff" />
                  <stop offset="1" stopColor="#f0f0f0" />
                </radialGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="extension-text">
          <h3>Install CodePlay Helper Extension</h3>
          <p>
            Submit code directly to <strong>Codeforces</strong> and <strong>LeetCode</strong> from the editor.
            The browser extension is required to enable direct submissions.
          </p>
        </div>

        <a
          href={EXTENSION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="extension-cta-btn"
        >
          <Download size={16} />
          <span>Add to Chrome</span>
          <ExternalLink size={12} className="ext-link-icon" />
        </a>
      </div>

      <div className="extension-steps">
        <div className="ext-step">
          <div className="ext-step-num">1</div>
          <span>Install the extension</span>
        </div>
        <div className="ext-step-arrow">→</div>
        <div className="ext-step">
          <div className="ext-step-num">2</div>
          <span>Log in to CF / LC</span>
        </div>
        <div className="ext-step-arrow">→</div>
        <div className="ext-step">
          <div className="ext-step-num">3</div>
          <span>Submit from CodePlay</span>
        </div>
      </div>
    </div>
  </section>
);

// --- FEATURES GRID ---
const features = [
  { icon: Cpu, title: "AI Copilot", desc: "Intelligent code completion and debugging powered by Gemini.", color: "#c084fc", bg: "rgba(192,132,252,0.1)" },
  { icon: Users, title: "Real-time Sync", desc: "Code with your team seamlessly. See every keystroke live.", color: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
  { icon: Trophy, title: "DSA Mastery", desc: "Integrated CP-31 and A2Z sheets with progress tracking.", color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  { icon: Send, title: "Direct Submissions", desc: "Submit to Codeforces and LeetCode directly from the editor.", color: "#fb923c", bg: "rgba(251,146,60,0.1)", link: EXTENSION_URL, linkText: "Get Extension" },
  { icon: PenTool, title: "Whiteboard", desc: "Plan algorithms visually with your team on a shared canvas.", color: "#f472b6", bg: "rgba(244,114,182,0.1)" },
  { icon: Zap, title: "Instant Setup", desc: "No configuration. Create a room and start coding instantly.", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
];

const FeaturesSection = () => (
  <section id="features" className="features-section">
    <div className="section-header">
      <h2>Everything you need.</h2>
      <p>Powerful tools designed for modern development workflows.</p>
    </div>

    <div className="features-grid">
      {features.map((f, i) => (
        <div key={i} className="feature-card" style={{ "--card-color": f.color, "--card-bg": f.bg, animationDelay: `${i * 0.08}s` }}>
          <div className="feature-icon" style={{ background: f.bg, color: f.color }}>
            <f.icon size={24} />
          </div>
          <h3>{f.title}</h3>
          <p>{f.desc}</p>
          {f.link && (
            <a href={f.link} target="_blank" rel="noopener noreferrer" className="feature-ext-link" style={{ color: f.color }}>
              <Download size={13} />
              {f.linkText}
              <ExternalLink size={11} />
            </a>
          )}
          <div className="feature-glow" />
        </div>
      ))}
    </div>
  </section>
);

// --- FOOTER ---
const Footer = () => (
  <footer className="site-footer">
    <div className="footer-glow-line" />
    <div className="footer-inner">
      <div className="footer-brand">
        <Code2 size={28} />
        <span className="footer-logo">CodePlay</span>
      </div>
      <p className="footer-tagline">
        Empowering the next generation of developers<br />with collaborative tools and AI.
      </p>
      <div className="footer-divider" />
      <p className="footer-copy">© 2025 CodePlay. All rights reserved.</p>
    </div>
  </footer>
);

// --- MAIN DASHBOARD ---
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [roomId, setRoomId] = useState("");

  const handleCreateRoom = async () => {
    if (!user) { setAuthOpen(true); return; }
    // Cryptographically stronger room ID
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    const randomId = Array.from(array, b => b.toString(36).padStart(2, "0")).join("").slice(0, 10);

    try {
      const token = localStorage.getItem("codeplay_token");
      const res = await fetch(`${API_URL}/api/rooms/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ roomId: randomId, username: user.username }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create room");
      }
      navigate(`/editor/${randomId}`);
    } catch (e) {
      console.error("Room creation failed:", e);
      alert("Failed to create room. Please try again.");
    }
  };

  const handleJoin = (e) => {
    e?.preventDefault?.();
    const cleaned = roomId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    if (cleaned) navigate(`/editor/${cleaned}`);
  };

  return (
    <div className="dashboard">
      <div className="bg-mesh" />

      <FloatingNav user={user} logout={logout} setAuthOpen={setAuthOpen} />

      <main className="dash-main">
        <HeroSection
          handleCreateRoom={handleCreateRoom}
          roomId={roomId}
          setRoomId={setRoomId}
          handleJoin={handleJoin}
        />
        <ExtensionBanner />
        <FeaturesSection />
      </main>

      <Footer />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
