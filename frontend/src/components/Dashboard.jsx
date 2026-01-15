import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";
import AuthModal from "./AuthModal";
import { 
  Plus, Code2, LogIn, ArrowRight, Sparkles, Users, Zap, 
  Terminal, Palette, Globe, ChevronRight, Star, Rocket,
  MousePointer2, MessageSquare, Cpu, Github, Twitter,
  Play, Layers, Shield, Wifi, Monitor, Braces, BookOpen,
  Send, PenTool, ListChecks, Trophy, FileCode
} from "lucide-react";

// Floating orbs background component
const FloatingOrbs = () => (
  <div className="floating-orbs">
    <div className="orb orb-1" />
    <div className="orb orb-2" />
    <div className="orb orb-3" />
    <div className="orb orb-4" />
  </div>
);

// Animated grid background
const GridBackground = () => (
  <div className="grid-background">
    <div className="grid-fade" />
  </div>
);

// Typing animation hook
const useTypingEffect = (words, typingSpeed = 100, deletingSpeed = 50, pauseDuration = 2000) => {
  const [displayText, setDisplayText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentWord.length) {
          setDisplayText(currentWord.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), pauseDuration);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDuration]);

  return displayText;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  const typingText = useTypingEffect([
    "Real Time.",
    "With Friends.",
    "Anywhere.",
    "Better."
  ]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCreateRoom = async () => {
    if (!user) { setAuthOpen(true); return; }
    
    const randomId = Math.random().toString(36).substring(7);
    
    try {
      const res = await fetch(`${API_URL}/api/rooms/create`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: randomId, username: user.username })
      });
      if (res.ok) {
        navigate(`/editor/${randomId}`);
      } else {
        alert("Failed to create room. Try again.");
      }
    } catch (e) {
      console.error(e);
      alert("Server error.");
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomId.trim()) navigate(`/editor/${roomId}`);
  };

  return (
    <div className="dashboard-wrapper">
      <style>{dashboardStyles}</style>
      
      <FloatingOrbs />
      <GridBackground />

      {/* NAVBAR */}
      <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''}`}>
        <div className="navbar-content">
          <Link to="/" className="logo">
            <div className="logo-icon">
              <Code2 size={24} />
            </div>
            <span className="logo-text">CodePlay</span>
            <span className="logo-badge">BETA</span>
          </Link>

          <div className="nav-actions">
            {user ? (
              <>
                <Link to="/profile" className="user-pill">
                  <div className="user-avatar">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.username} />
                    ) : (
                      <span>{user.username[0].toUpperCase()}</span>
                    )}
                  </div>
                  <span className="user-name">{user.username}</span>
                </Link>
                <button onClick={logout} className="btn-ghost">Logout</button>
              </>
            ) : (
              <>
                <button onClick={() => setAuthOpen(true)} className="btn-ghost">Sign In</button>
                <button onClick={() => setAuthOpen(true)} className="btn-glow">
                  Get Started <Sparkles size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge animate-float">
            <Sparkles size={14} />
            <span>Now with AI-Powered Assistance</span>
            <ChevronRight size={14} />
          </div>

          <h1 className="hero-title">
            Code Together,<br />
            <span className="typing-container">
              <span className="gradient-text-animated">{typingText}</span>
              <span className="cursor">|</span>
            </span>
          </h1>

          <p className="hero-subtitle">
            The collaborative IDE that makes coding feel like magic. ✨<br />
            Real-time sync, AI assistance, and vibes that just hit different.
          </p>

          <div className="hero-actions">
            <button onClick={handleCreateRoom} className="btn-primary-large">
              <Rocket size={20} />
              <span>Start Coding</span>
              <div className="btn-shine" />
            </button>

            <div className="join-room-wrapper">
              <form onSubmit={handleJoin} className="join-room-form">
                <div className="input-icon">
                  <Terminal size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="Enter room code..." 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="join-input"
                />
                <button type="submit" className="join-btn">
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>
          </div>

          {/* Tech Stack Pills */}
          <div className="tech-stack">
            <span className="tech-pill"><Trophy size={14} /> Competitive Programming</span>
            <span className="tech-pill"><ListChecks size={14} /> DSA Sheets</span>
            <span className="tech-pill"><Send size={14} /> Codeforces</span>
            <span className="tech-pill"><PenTool size={14} /> Whiteboard</span>
          </div>
        </div>

        {/* Floating code preview */}
        <div className="hero-visual">
          <div className="code-window animate-float-slow">
            <div className="window-header">
              <div className="window-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <span className="window-title">main.js</span>
              <div className="live-indicator">
                <span className="live-dot" />
                LIVE
              </div>
            </div>
            <div className="code-content">
              <pre>
                <code>
{`const team = ["you", "friend"];

async function collaborate() {
  await connect(team);
  
  while (true) {
    code();
    laugh();
    ship(); // 🚀
  }
}`}
                </code>
              </pre>
              <div className="cursor-indicator">
                <MousePointer2 size={12} />
                <span>Collaborator is typing...</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-it-works">
        <div className="section-header">
          <span className="section-tag">🚀 How It Works</span>
          <h2 className="section-title">Start coding in <span className="gradient-text">seconds</span></h2>
        </div>

        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-icon"><Plus size={24} /></div>
            <h3>Create a Room</h3>
            <p>Click "Start Coding" to instantly create a new collaborative workspace</p>
          </div>
          <div className="step-connector" />
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-icon"><Users size={24} /></div>
            <h3>Share the Link</h3>
            <p>Invite teammates by sharing your unique room code</p>
          </div>
          <div className="step-connector" />
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-icon"><Code2 size={24} /></div>
            <h3>Code Together</h3>
            <p>Write, debug, and ship code with real-time collaboration</p>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="features-section">
        <div className="section-header">
          <span className="section-tag">✨ Features</span>
          <h2 className="section-title">Everything you need to <span className="gradient-text">master DSA</span></h2>
          <p className="section-subtitle">Built for competitive programmers and DSA enthusiasts</p>
        </div>

        <div className="features-grid">
          <FeatureCard 
            icon={<ListChecks />}
            color="#8b5cf6"
            title="A2Z DSA Sheet"
            desc="Complete Striver's A2Z DSA sheet with 450+ problems. Track your progress as you go."
          />
          <FeatureCard 
            icon={<Trophy />}
            color="#fbbf24"
            title="CP-31 Sheet"
            desc="Curated CP-31 problemset for competitive programming mastery."
          />
          <FeatureCard 
            icon={<BookOpen />}
            color="#06b6d4"
            title="All Sheets in One"
            desc="Access multiple DSA sheets in one place. No more switching between tabs."
          />
          <FeatureCard 
            icon={<Send />}
            color="#22c55e"
            title="Direct Submissions"
            desc="Submit solutions directly to online judges like Codeforces without leaving the editor."
          />
          <FeatureCard 
            icon={<PenTool />}
            color="#ec4899"
            title="Whiteboard"
            desc="Draw diagrams, visualize algorithms, and explain your approach visually."
          />
          <FeatureCard 
            icon={<Cpu />}
            color="#f97316"
            title="AI Assistant"
            desc="Gemini AI to help you understand problems, debug code, and learn concepts."
          />
        </div>
      </section>

      {/* LANGUAGES SECTION */}
      <section className="languages-section">
        <div className="section-header">
          <span className="section-tag">💻 Languages</span>
          <h2 className="section-title">Write code in <span className="gradient-text">any language</span></h2>
        </div>

        <div className="languages-grid">
          <div className="language-card">
            <div className="lang-icon cpp">C++</div>
            <span>C++</span>
          </div>
          <div className="language-card">
            <div className="lang-icon py">Py</div>
            <span>Python</span>
          </div>
          <div className="language-card">
            <div className="lang-icon java">Jv</div>
            <span>Java</span>
          </div>
          <div className="language-card">
            <div className="lang-icon js">JS</div>
            <span>JavaScript</span>
          </div>
          <div className="language-card">
            <div className="lang-icon html">{"<>"}</div>
            <span>HTML/CSS</span>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="cta-section">
        <div className="cta-content">
          <div className="cta-icon">
            <Rocket size={40} />
          </div>
          <h2 className="cta-title">Ready to code differently?</h2>
          <p className="cta-subtitle">Create your first collaborative room in seconds. No credit card required.</p>
          <div className="cta-actions">
            <button onClick={handleCreateRoom} className="btn-primary-large">
              <Sparkles size={20} />
              <span>Start Coding Free</span>
              <div className="btn-shine" />
            </button>
          </div>
          <div className="cta-features">
            <span><Shield size={14} /> Free forever</span>
            <span><Zap size={14} /> No setup needed</span>
            <span><Users size={14} /> Unlimited collaborators</span>
          </div>
        </div>
        <div className="cta-decoration">
          <div className="cta-orb cta-orb-1" />
          <div className="cta-orb cta-orb-2" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="logo-icon">
                <Code2 size={20} />
              </div>
              <span className="logo-text">CodePlay</span>
            </div>
            <p className="footer-tagline">Code together. Ship faster. Have fun.</p>
            <div className="footer-social">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="social-btn">
                <Github size={18} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-btn">
                <Twitter size={18} />
              </a>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} CodePlay. Made with 💜 for developers.</p>
        </div>
      </footer>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function FeatureCard({ icon, color, title, desc }) {
  return (
    <div className="feature-card">
      <div className="feature-icon" style={{ background: `${color}20`, color }}>
        {icon}
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
      <div className="feature-glow" style={{ background: color }} />
    </div>
  );
}

const dashboardStyles = `
  .dashboard-wrapper {
    height: 100vh;
    background: #09090b;
    overflow-x: hidden;
    overflow-y: auto;
    position: relative;
  }

  /* FLOATING ORBS */
  .floating-orbs {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.5;
    animation: float 20s ease-in-out infinite;
  }

  .orb-1 {
    width: 600px;
    height: 600px;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    top: -200px;
    right: -200px;
    animation-delay: 0s;
  }

  .orb-2 {
    width: 400px;
    height: 400px;
    background: linear-gradient(135deg, #06b6d4, #0ea5e9);
    bottom: -100px;
    left: -100px;
    animation-delay: -5s;
  }

  .orb-3 {
    width: 300px;
    height: 300px;
    background: linear-gradient(135deg, #ec4899, #f43f5e);
    top: 50%;
    left: 30%;
    animation-delay: -10s;
  }

  .orb-4 {
    width: 200px;
    height: 200px;
    background: linear-gradient(135deg, #22c55e, #10b981);
    bottom: 30%;
    right: 20%;
    animation-delay: -15s;
  }

  @keyframes float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(50px, -50px) scale(1.1); }
    50% { transform: translate(-30px, 30px) scale(0.9); }
    75% { transform: translate(-50px, -30px) scale(1.05); }
  }

  /* GRID BACKGROUND */
  .grid-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: 
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
    z-index: 0;
  }

  .grid-fade {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(to bottom, transparent 0%, #09090b 100%);
  }

  /* NAVBAR */
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 16px 32px;
    transition: all 0.3s ease;
  }

  .navbar-scrolled {
    background: rgba(9, 9, 11, 0.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .navbar-content {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: white;
  }

  .logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
  }

  .logo-text {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .logo-badge {
    font-size: 10px;
    background: linear-gradient(135deg, #f43f5e, #ec4899);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .nav-links {
    display: flex;
    gap: 32px;
  }

  .nav-link {
    color: #a1a1aa;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: color 0.2s;
  }

  .nav-link:hover {
    color: white;
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 12px 6px 6px;
    border-radius: 100px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .user-pill:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: white;
    overflow: hidden;
  }

  .user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .user-name {
    color: white;
    font-weight: 500;
    font-size: 14px;
  }

  .btn-ghost {
    background: transparent;
    border: none;
    color: #a1a1aa;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 8px;
  }

  .btn-ghost:hover {
    color: white;
    background: rgba(255, 255, 255, 0.05);
  }

  .btn-glow {
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border: none;
    color: white;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s;
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
  }

  .btn-glow:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 30px rgba(139, 92, 246, 0.5);
  }

  /* HERO */
  .hero {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 120px 32px 80px;
    position: relative;
    z-index: 1;
    gap: 60px;
  }

  .hero-content {
    max-width: 600px;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    padding: 8px 16px;
    border-radius: 100px;
    font-size: 13px;
    color: #a78bfa;
    margin-bottom: 24px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .hero-badge:hover {
    background: rgba(139, 92, 246, 0.25);
  }

  .animate-float {
    animation: floatBadge 3s ease-in-out infinite;
  }

  @keyframes floatBadge {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  .hero-title {
    font-size: 72px;
    font-weight: 800;
    line-height: 1.05;
    margin: 0 0 24px;
    letter-spacing: -2px;
  }

  .typing-container {
    display: inline-block;
    min-width: 350px;
  }

  .gradient-text-animated {
    background: linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899);
    background-size: 200% 200%;
    animation: gradientShift 3s ease infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  .cursor {
    display: inline-block;
    color: #8b5cf6;
    animation: blink 1s step-end infinite;
    margin-left: 2px;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .hero-subtitle {
    font-size: 20px;
    color: #a1a1aa;
    line-height: 1.6;
    margin-bottom: 40px;
  }

  .hero-actions {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }

  .btn-primary-large {
    position: relative;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border: none;
    color: white;
    padding: 16px 32px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.3s;
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
    overflow: hidden;
  }

  .btn-primary-large:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 40px rgba(139, 92, 246, 0.5);
  }

  .btn-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    animation: shine 3s infinite;
  }

  @keyframes shine {
    0% { left: -100%; }
    50%, 100% { left: 100%; }
  }

  .join-room-wrapper {
    flex: 1;
    min-width: 250px;
  }

  .join-room-form {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 4px;
    transition: all 0.3s;
  }

  .join-room-form:focus-within {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
  }

  .input-icon {
    padding: 12px;
    color: #71717a;
  }

  .join-input {
    flex: 1;
    background: transparent;
    border: none;
    color: white;
    font-size: 14px;
    outline: none;
    padding: 12px 0;
  }

  .join-input::placeholder {
    color: #71717a;
  }

  .join-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .join-btn:hover {
    background: #8b5cf6;
  }

  .hero-users {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 48px;
  }

  .avatar-stack {
    display: flex;
  }

  .avatar-stack-item {
    width: 40px;
    height: 40px;
    background: #27272a;
    border: 2px solid #09090b;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    margin-left: -12px;
    animation: popIn 0.3s ease backwards;
  }

  .avatar-stack-item:first-child {
    margin-left: 0;
  }

  @keyframes popIn {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .hero-users-text {
    color: #71717a;
    font-size: 14px;
  }

  .highlight {
    color: white;
    font-weight: 600;
  }

  /* HERO VISUAL */
  .hero-visual {
    flex-shrink: 0;
    position: relative;
  }

  .code-window {
    background: rgba(24, 24, 27, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    width: 420px;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(20px);
  }

  .animate-float-slow {
    animation: floatSlow 6s ease-in-out infinite;
  }

  @keyframes floatSlow {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(1deg); }
  }

  .window-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    gap: 12px;
  }

  .window-dots {
    display: flex;
    gap: 6px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dot.red { background: #ef4444; }
  .dot.yellow { background: #fbbf24; }
  .dot.green { background: #22c55e; }

  .window-title {
    flex: 1;
    color: #71717a;
    font-size: 12px;
    font-family: var(--font-mono);
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #22c55e;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    background: #22c55e;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }

  .code-content {
    padding: 20px;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.7;
    color: #e4e4e7;
    position: relative;
  }

  .code-content pre {
    margin: 0;
  }

  .code-content code {
    color: #a78bfa;
  }

  .cursor-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
    padding: 8px 12px;
    background: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.3);
    border-radius: 8px;
    font-size: 11px;
    color: #06b6d4;
    font-family: var(--font-main);
    animation: fadeInOut 2s infinite;
  }

  @keyframes fadeInOut {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }

  /* FEATURES SECTION */
  .features-section {
    padding: 120px 32px;
    position: relative;
    z-index: 1;
  }

  .section-header {
    text-align: center;
    margin-bottom: 64px;
  }

  .section-tag {
    display: inline-block;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    padding: 6px 16px;
    border-radius: 100px;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 48px;
    font-weight: 700;
    margin: 0 0 16px;
    letter-spacing: -1px;
  }

  .section-subtitle {
    color: #71717a;
    font-size: 18px;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .feature-card {
    position: relative;
    background: rgba(24, 24, 27, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    padding: 32px;
    transition: all 0.3s;
    overflow: hidden;
  }

  .feature-card:hover {
    transform: translateY(-5px);
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(24, 24, 27, 0.8);
  }

  .feature-tag {
    position: absolute;
    top: 16px;
    right: 16px;
    font-size: 10px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 4px;
    color: white;
    letter-spacing: 0.5px;
  }

  .feature-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .feature-title {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 12px;
  }

  .feature-desc {
    color: #71717a;
    font-size: 14px;
    line-height: 1.6;
    margin: 0;
  }

  .feature-glow {
    position: absolute;
    bottom: -50%;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 200px;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0;
    transition: opacity 0.3s;
  }

  .feature-card:hover .feature-glow {
    opacity: 0.15;
  }

  /* STATS SECTION */
  .stats-section {
    padding: 80px 32px;
    position: relative;
    z-index: 1;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 32px;
    max-width: 1000px;
    margin: 0 auto;
  }

  .stat-card {
    text-align: center;
    padding: 32px;
  }

  .stat-value {
    font-size: 48px;
    font-weight: 800;
    background: linear-gradient(135deg, #8b5cf6, #06b6d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 8px;
  }

  .stat-label {
    color: #71717a;
    font-size: 14px;
    font-weight: 500;
  }

  /* TESTIMONIALS */
  .testimonials-section {
    padding: 120px 32px;
    position: relative;
    z-index: 1;
  }

  .testimonials-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .testimonial-card {
    background: rgba(24, 24, 27, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    padding: 32px;
    transition: all 0.3s;
  }

  .testimonial-card:hover {
    transform: translateY(-5px);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .testimonial-stars {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
  }

  .testimonial-text {
    font-size: 16px;
    line-height: 1.6;
    color: #e4e4e7;
    margin: 0 0 24px;
  }

  .testimonial-author {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .testimonial-avatar {
    width: 40px;
    height: 40px;
    background: #27272a;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }

  .testimonial-name {
    font-weight: 600;
    font-size: 14px;
  }

  .testimonial-role {
    color: #71717a;
    font-size: 12px;
  }

  /* CTA SECTION */
  .cta-section {
    padding: 120px 32px;
    position: relative;
    z-index: 1;
    text-align: center;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .cta-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .cta-title {
    font-size: 56px;
    font-weight: 800;
    margin: 0 0 16px;
    letter-spacing: -1px;
  }

  .cta-subtitle {
    color: #71717a;
    font-size: 20px;
    margin-bottom: 40px;
  }

  .cta-decoration {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .cta-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
  }

  .cta-orb-1 {
    width: 400px;
    height: 400px;
    background: #8b5cf6;
    opacity: 0.2;
    top: 50%;
    left: 30%;
    transform: translate(-50%, -50%);
  }

  .cta-orb-2 {
    width: 300px;
    height: 300px;
    background: #06b6d4;
    opacity: 0.2;
    top: 50%;
    left: 70%;
    transform: translate(-50%, -50%);
  }

  /* FOOTER */
  .footer {
    padding: 80px 32px 32px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;
    z-index: 1;
  }

  .footer-content {
    display: flex;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto 48px;
  }

  .footer-tagline {
    color: #71717a;
    font-size: 14px;
    margin-top: 12px;
  }

  .footer-links {
    display: flex;
    gap: 80px;
  }

  .footer-column h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 16px;
    color: white;
  }

  .footer-column a {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #71717a;
    text-decoration: none;
    font-size: 14px;
    margin-bottom: 12px;
    transition: color 0.2s;
  }

  .footer-column a:hover {
    color: white;
  }

  .footer-bottom {
    text-align: center;
    padding-top: 32px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .footer-bottom p {
    color: #52525b;
    font-size: 13px;
  }

  /* TECH STACK PILLS */
  .tech-stack {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 32px;
  }

  .tech-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 8px 14px;
    border-radius: 100px;
    font-size: 13px;
    color: #a1a1aa;
    transition: all 0.2s;
  }

  .tech-pill:hover {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
  }

  /* FLOATING ELEMENTS */
  .floating-element {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(24, 24, 27, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    color: #a1a1aa;
    backdrop-filter: blur(10px);
    animation: floatElement 4s ease-in-out infinite;
    white-space: nowrap;
  }

  .fe-1 {
    top: 40px;
    right: -80px;
    color: #22c55e;
    animation-delay: 0s;
  }

  .fe-2 {
    bottom: 120px;
    left: -80px;
    color: #8b5cf6;
    animation-delay: -1.5s;
  }

  .fe-3 {
    bottom: 40px;
    right: -60px;
    color: #fbbf24;
    animation-delay: -3s;
  }

  @keyframes floatElement {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  /* HOW IT WORKS */
  .how-it-works {
    padding: 100px 32px;
    position: relative;
    z-index: 1;
  }

  .steps-container {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 20px;
    max-width: 1000px;
    margin: 0 auto;
  }

  .step {
    flex: 1;
    text-align: center;
    padding: 32px 24px;
    position: relative;
  }

  .step-number {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 28px;
    height: 28px;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
  }

  .step-icon {
    width: 64px;
    height: 64px;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8b5cf6;
    margin: 20px auto 20px;
    transition: all 0.3s;
  }

  .step:hover .step-icon {
    transform: scale(1.1);
    background: rgba(139, 92, 246, 0.2);
  }

  .step h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .step p {
    color: #71717a;
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
  }

  .step-connector {
    width: 60px;
    height: 2px;
    background: linear-gradient(90deg, #8b5cf6, #06b6d4);
    margin-top: 75px;
    opacity: 0.3;
  }

  /* LANGUAGES SECTION */
  .languages-section {
    padding: 80px 32px;
    position: relative;
    z-index: 1;
  }

  .languages-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
    max-width: 800px;
    margin: 0 auto;
  }

  .language-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 16px 24px;
    border-radius: 12px;
    transition: all 0.3s;
    cursor: default;
  }

  .language-card:hover {
    transform: translateY(-3px);
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
  }

  .lang-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-mono);
  }

  .lang-icon.js { background: #fbbf2420; color: #fbbf24; }
  .lang-icon.py { background: #3b82f620; color: #3b82f6; }
  .lang-icon.cpp { background: #06b6d420; color: #06b6d4; }
  .lang-icon.java { background: #f9731620; color: #f97316; }
  .lang-icon.html { background: #ef444420; color: #ef4444; }
  .lang-icon.ts { background: #3b82f620; color: #60a5fa; }

  .language-card span {
    font-size: 14px;
    font-weight: 500;
    color: #e4e4e7;
  }

  /* CTA ENHANCEMENTS */
  .cta-icon {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2));
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a78bfa;
    margin: 0 auto 24px;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.2); }
    50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.4); }
  }

  .cta-actions {
    margin-bottom: 24px;
  }

  .cta-features {
    display: flex;
    justify-content: center;
    gap: 32px;
    flex-wrap: wrap;
  }

  .cta-features span {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #71717a;
    font-size: 14px;
  }

  /* FOOTER SOCIAL */
  .footer-social {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }

  .social-btn {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #71717a;
    transition: all 0.2s;
  }

  .social-btn:hover {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.3);
    color: #a78bfa;
    transform: translateY(-2px);
  }

  /* RESPONSIVE */
  @media (max-width: 1024px) {
    .hero {
      flex-direction: column;
      text-align: center;
    }

    .hero-content {
      max-width: 100%;
    }

    .hero-title {
      font-size: 48px;
    }

    .hero-actions {
      justify-content: center;
    }

    .hero-visual {
      display: none;
    }

    .tech-stack {
      justify-content: center;
    }

    .features-grid {
      grid-template-columns: 1fr 1fr;
    }

    .steps-container {
      flex-direction: column;
      align-items: center;
    }

    .step-connector {
      width: 2px;
      height: 40px;
      margin: 0;
    }

    .nav-links {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .hero-title {
      font-size: 36px;
    }

    .typing-container {
      min-width: auto;
    }

    .section-title {
      font-size: 32px;
    }

    .cta-title {
      font-size: 36px;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }

    .cta-features {
      flex-direction: column;
      gap: 12px;
    }

    .footer-content {
      flex-direction: column;
      gap: 48px;
      text-align: center;
    }

    .footer-social {
      justify-content: center;
    }
  }
`;

