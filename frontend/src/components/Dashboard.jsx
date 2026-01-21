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
  Send, PenTool, ListChecks, Trophy, FileCode, CheckCircle2
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
const useTypingEffect = (words, typingSpeed = 80, deletingSpeed = 40, pauseDuration = 2000) => {
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
  const [activeFeature, setActiveFeature] = useState(0);

  const typingText = useTypingEffect([
    "Real Time.",
    "With Friends.",
    "Without Limits.",
    "Like Magic."
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
              <Code2 size={24} color="white" />
            </div>
            <span className="logo-text">CodePlay</span>
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
                <button onClick={logout} className="btn-secondary">Logout</button>
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
            <Sparkles size={14} className="badge-icon" />
            <span>AI-Powered Collaborative Editor</span>
          </div>

          <h1 className="hero-title">
            Code Together,<br />
            <span className="typing-container">
              <span className="gradient-text-animated">{typingText}</span>
              <span className="cursor">|</span>
            </span>
          </h1>

          <p className="hero-subtitle">
            The collaborative IDE designed for the next generation of developers.
            Real-time sync, integrated DSA sheets, and AI assistance that actually helps.
          </p>

          <div className="hero-actions">
            <button onClick={handleCreateRoom} className="btn-primary-large">
              <Rocket size={20} />
              <span>Start Coding Now</span>
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
                <button type="submit" className="join-btn" disabled={!roomId.trim()}>
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>
          </div>

          {/* Tech Stack Pills */}
          <div className="tech-stack">
            <div className="tech-pill"><Trophy size={14} className="tp-icon"/> CP-31 Sheet</div>
            <div className="tech-pill"><ListChecks size={14} className="tp-icon"/> Striver A2Z</div>
            <div className="tech-pill"><Send size={14} className="tp-icon"/> Codeforces</div>
            <div className="tech-pill"><PenTool size={14} className="tp-icon"/> Whiteboard</div>
            <div className="tech-pill"><Cpu size={14} className="tp-icon"/> Gemini AI</div>
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
              <span className="window-title">collaboration.js</span>
              <div className="live-indicator">
                <span className="live-dot" />
                LIVE
              </div>
            </div>
            <div className="code-content">
              <div className="line"><span className="kw">const</span> <span className="var">team</span> = [<span className="str">"you"</span>, <span className="str">"friend"</span>];</div>
              <br/>
              <div className="line"><span className="kw">async function</span> <span className="fn">buildFuture</span>() {"{"}</div>
              <div className="line indent">  <span className="kw">await</span> <span className="fn">connect</span>(<span className="var">team</span>);</div>
              <br/>
              <div className="line indent">  <span className="kw">while</span> (<span className="bool">true</span>) {"{"}</div>
              <div className="line indent-2">    <span className="fn">create</span>();</div>
              <div className="line indent-2">    <span className="fn">learn</span>();</div>
              <div className="line indent-2">    <span className="fn">ship</span>(); <span className="comment">// 🚀</span></div>
              <div className="line indent">  {"}"}</div>
              <div className="line">{"}"}</div>

              <div className="cursor-indicator">
                <div className="cursor-caret" />
                <span className="cursor-label">Alex is typing...</span>
              </div>
            </div>
          </div>

          {/* Floating Elements around code window */}
          <div className="float-card fc-1">
             <div className="fc-icon bg-green"><CheckCircle2 size={16} color="white"/></div>
             <div className="fc-text">
                 <span className="fc-title">Tests Passed</span>
                 <span className="fc-sub">All systems operational</span>
             </div>
          </div>

          <div className="float-card fc-2">
             <div className="fc-icon bg-purple"><Users size={16} color="white"/></div>
             <div className="fc-text">
                 <span className="fc-title">3 Users Connected</span>
                 <div className="fc-avatars">
                    <div className="mini-av" style={{background: '#f43f5e'}}>A</div>
                    <div className="mini-av" style={{background: '#3b82f6'}}>B</div>
                    <div className="mini-av" style={{background: '#22c55e'}}>C</div>
                 </div>
             </div>
          </div>
        </div>
      </section>

      {/* FEATURE SHOWCASE */}
      <section className="features-section">
        <div className="section-header">
          <span className="section-tag">Powerful Features</span>
          <h2 className="section-title">Everything you need to <span className="gradient-text">excel</span></h2>
        </div>

        <div className="features-grid">
            {[
                { icon: <ListChecks />, color: "#8b5cf6", title: "A2Z DSA Sheet", desc: "Complete Striver's A2Z DSA sheet. Track progress directly." },
                { icon: <Trophy />, color: "#eab308", title: "CP-31 Sheet", desc: "Curated problemset to master competitive programming." },
                { icon: <Send />, color: "#22c55e", title: "Judge Integration", desc: "Submit code to Codeforces & LeetCode without leaving the editor." },
                { icon: <PenTool />, color: "#ec4899", title: "Real-time Whiteboard", desc: "Draw, plan, and explain algorithms visually with teammates." },
                { icon: <Cpu />, color: "#f97316", title: "AI Assistant", desc: "Context-aware AI to explain logic, fix bugs, and generate tests." },
                { icon: <Users />, color: "#06b6d4", title: "Voice & Video", desc: "Built-in communication. Code and talk in real-time." }
            ].map((f, i) => (
                <FeatureCard key={i} {...f} />
            ))}
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="cta-section">
        <div className="cta-content">
          <div className="cta-icon">
            <Rocket size={48} />
          </div>
          <h2 className="cta-title">Ready to level up?</h2>
          <p className="cta-subtitle">Join thousands of developers building the future.</p>
          <div className="cta-actions">
            <button onClick={handleCreateRoom} className="btn-primary-large">
              <Sparkles size={20} />
              <span>Start Coding Free</span>
            </button>
          </div>
        </div>
        <div className="cta-decoration">
           <div className="grid-background" style={{ opacity: 0.5 }} />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="logo-icon small">
                <Code2 size={18} color="white" />
              </div>
              <span className="logo-text">CodePlay</span>
            </div>
            <p className="footer-tagline">Built for the builders.</p>
          </div>
          <div className="footer-social">
             <a href="#" className="social-link"><Github size={18}/></a>
             <a href="#" className="social-link"><Twitter size={18}/></a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} CodePlay. Open Source.</p>
        </div>
      </footer>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function FeatureCard({ icon, color, title, desc }) {
  return (
    <div className="feature-card">
      <div className="feature-icon" style={{ background: `${color}15`, color: color, borderColor: `${color}30` }}>
        {icon}
      </div>
      <div>
        <h3 className="feature-title">{title}</h3>
        <p className="feature-desc">{desc}</p>
      </div>
      <div className="feature-hover-glow" style={{ background: color }} />
    </div>
  );
}

const dashboardStyles = `
  .dashboard-wrapper {
    min-height: 100vh;
    background: #050505;
    position: relative;
    overflow-x: hidden;
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
    background: rgba(5, 5, 5, 0.8);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .navbar-content {
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: white;
  }
  .logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #8b5cf6, #3b82f6);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 15px rgba(139, 92, 246, 0.3);
  }
  .logo-icon.small { width: 32px; height: 32px; border-radius: 8px; }
  .logo-text { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }

  .nav-actions { display: flex; gap: 12px; align-items: center; }
  .btn-ghost { background: transparent; color: #a1a1aa; border: none; font-weight: 500; cursor: pointer; transition: color 0.2s; font-size: 14px; }
  .btn-ghost:hover { color: white; }
  .btn-glow {
    background: white; color: black; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px;
    display: flex; align-items: center; gap: 6px; cursor: pointer; transition: transform 0.2s;
    box-shadow: 0 0 15px rgba(255,255,255,0.2);
  }
  .btn-glow:hover { transform: translateY(-1px); box-shadow: 0 0 25px rgba(255,255,255,0.3); }

  .user-pill {
      display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 4px 12px 4px 4px; border-radius: 100px;
      text-decoration: none; border: 1px solid rgba(255,255,255,0.1); transition: background 0.2s;
  }
  .user-pill:hover { background: rgba(255,255,255,0.1); }
  .user-avatar { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: #333; display: flex; align-items: center; justifyContent: center; color: white; font-weight: 600; font-size: 12px; }
  .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .user-name { font-size: 13px; color: white; font-weight: 500; }

  /* HERO */
  .hero {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 120px 20px;
    position: relative;
    max-width: 1280px;
    margin: 0 auto;
    gap: 60px;
  }
  .hero-content { max-width: 600px; z-index: 10; }

  .hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2);
    color: #c4b5fd; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 100px;
    margin-bottom: 24px;
  }
  .badge-icon { color: #8b5cf6; }

  .hero-title {
    font-size: 64px; font-weight: 800; line-height: 1.1; margin-bottom: 24px; letter-spacing: -2px;
  }
  .gradient-text-animated {
    background: linear-gradient(to right, #8b5cf6, #06b6d4, #ffffff);
    background-size: 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: gradientFlow 5s ease infinite;
  }
  @keyframes gradientFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

  .hero-subtitle { font-size: 18px; color: #a1a1aa; line-height: 1.6; margin-bottom: 40px; max-width: 500px; }

  .hero-actions { display: flex; gap: 16px; align-items: stretch; margin-bottom: 48px; }

  .btn-primary-large {
    background: white; color: black; border: none; padding: 0 32px; border-radius: 12px;
    font-weight: 600; font-size: 16px; display: flex; align-items: center; gap: 10px; cursor: pointer;
    transition: transform 0.2s; position: relative; overflow: hidden;
  }
  .btn-primary-large:hover { transform: translateY(-2px); }

  .join-room-wrapper { position: relative; flex: 1; max-width: 300px; }
  .join-room-form {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 4px; display: flex; align-items: center;
    transition: border-color 0.2s, background 0.2s;
  }
  .join-room-form:focus-within { border-color: #8b5cf6; background: rgba(255,255,255,0.05); }
  .input-icon { padding: 0 12px; color: #52525b; }
  .join-input { background: transparent; border: none; color: white; flex: 1; padding: 12px 0; outline: none; font-size: 14px; }
  .join-btn {
    width: 40px; height: 40px; display: flex; align-items: center; justifyContent: center;
    background: #27272a; border: none; color: white; border-radius: 8px; cursor: pointer; transition: background 0.2s;
  }
  .join-btn:hover:not(:disabled) { background: #8b5cf6; }
  .join-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .tech-stack { display: flex; flex-wrap: wrap; gap: 12px; }
  .tech-pill {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    padding: 6px 12px; border-radius: 100px; font-size: 12px; color: #a1a1aa;
    display: flex; align-items: center; gap: 6px; cursor: default; transition: all 0.2s;
  }
  .tech-pill:hover { border-color: rgba(255,255,255,0.2); color: white; background: rgba(255,255,255,0.05); }
  .tp-icon { opacity: 0.7; }

  /* HERO VISUAL */
  .hero-visual { position: relative; z-index: 10; display: none; } /* Show on larger screens */
  @media (min-width: 1024px) { .hero-visual { display: block; } }

  .code-window {
    width: 450px; background: #0a0a0a; border: 1px solid #27272a; border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;
  }
  .animate-float-slow { animation: float 6s ease-in-out infinite; }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }

  .window-header {
    background: #111; padding: 12px 16px; border-bottom: 1px solid #27272a;
    display: flex; align-items: center; gap: 12px;
  }
  .window-dots { display: flex; gap: 6px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot.red { background: #ef4444; } .dot.yellow { background: #eab308; } .dot.green { background: #22c55e; }
  .window-title { flex: 1; text-align: center; color: #52525b; font-size: 12px; font-family: monospace; }
  .live-indicator { display: flex; align-items: center; gap: 6px; color: #22c55e; font-size: 10px; font-weight: 700; }
  .live-dot { width: 6px; height: 6px; background: #22c55e; border-radius: 50%; animation: pulse 2s infinite; }

  .code-content { padding: 20px; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; color: #d4d4d8; }
  .kw { color: #c084fc; } .var { color: #60a5fa; } .str { color: #4ade80; } .fn { color: #f472b6; } .bool { color: #facc15; } .comment { color: #52525b; font-style: italic; }
  .indent { padding-left: 20px; } .indent-2 { padding-left: 40px; }

  .cursor-indicator {
    margin-top: 10px; display: inline-flex; align-items: center; gap: 6px;
    background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3);
    padding: 2px 8px; border-radius: 4px; border-top-left-radius: 0;
  }
  .cursor-caret { width: 2px; height: 14px; background: #8b5cf6; }
  .cursor-label { color: #8b5cf6; font-size: 11px; font-weight: 600; }

  /* FLOATING CARDS */
  .float-card {
    position: absolute; background: rgba(15, 15, 15, 0.8); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 12px;
    display: flex; align-items: center; gap: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    animation: float 5s ease-in-out infinite reverse;
  }
  .fc-1 { top: 40px; right: -40px; animation-delay: 1s; }
  .fc-2 { bottom: 40px; left: -40px; animation-delay: 2s; }
  .fc-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justifyContent: center; }
  .bg-green { background: #22c55e; } .bg-purple { background: #8b5cf6; }
  .fc-title { font-size: 12px; font-weight: 600; color: white; display: block; }
  .fc-sub { font-size: 10px; color: #a1a1aa; }
  .fc-avatars { display: flex; margin-top: 4px; }
  .mini-av { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #111; margin-left: -6px; font-size: 8px; display: flex; align-items: center; justifyContent: center; font-weight: bold; color: white; }

  /* FEATURES */
  .features-section { padding: 80px 20px; max-width: 1280px; margin: 0 auto; }
  .section-header { text-align: center; margin-bottom: 60px; }
  .section-tag { color: #8b5cf6; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; display: block; }
  .section-title { font-size: 40px; font-weight: 700; margin-bottom: 10px; }
  .gradient-text { background: linear-gradient(135deg, #8b5cf6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

  .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px; }
  .feature-card {
    background: #0a0a0a; border: 1px solid #27272a; padding: 24px; border-radius: 16px;
    display: flex; gap: 20px; transition: all 0.3s; position: relative; overflow: hidden;
  }
  .feature-card:hover { border-color: #3f3f46; transform: translateY(-3px); }
  .feature-icon { width: 48px; height: 48px; border-radius: 12px; border: 1px solid; display: flex; align-items: center; justifyContent: center; flex-shrink: 0; }
  .feature-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #f4f4f5; }
  .feature-desc { font-size: 14px; color: #a1a1aa; line-height: 1.5; }
  .feature-hover-glow {
    position: absolute; bottom: -50px; right: -50px; width: 100px; height: 100px;
    border-radius: 50%; filter: blur(60px); opacity: 0; transition: opacity 0.3s;
  }
  .feature-card:hover .feature-hover-glow { opacity: 0.2; }

  /* CTA */
  .cta-section { padding: 100px 20px; text-align: center; position: relative; overflow: hidden; }
  .cta-content { position: relative; z-index: 10; }
  .cta-icon { width: 80px; height: 80px; background: rgba(255,255,255,0.05); border-radius: 24px; display: flex; align-items: center; justifyContent: center; margin: 0 auto 32px; color: white; border: 1px solid rgba(255,255,255,0.1); }
  .cta-title { font-size: 48px; font-weight: 800; margin-bottom: 16px; }
  .cta-subtitle { font-size: 18px; color: #a1a1aa; margin-bottom: 40px; }

  /* FOOTER */
  .footer { border-top: 1px solid #27272a; padding: 60px 20px 30px; background: #050505; }
  .footer-content { max-width: 1280px; margin: 0 auto 40px; display: flex; justify-content: space-between; align-items: flex-start; }
  .footer-tagline { color: #52525b; font-size: 14px; margin-top: 8px; }
  .footer-social { display: flex; gap: 16px; }
  .social-link { color: #71717a; transition: color 0.2s; } .social-link:hover { color: white; }
  .footer-bottom { text-align: center; font-size: 13px; color: #3f3f46; }

  /* RESPONSIVE */
  @media (max-width: 768px) {
    .hero { padding-top: 100px; flex-direction: column; text-align: center; }
    .hero-title { font-size: 40px; }
    .hero-actions { justify-content: center; flex-direction: column; }
    .join-room-wrapper { max-width: 100%; }
    .tech-stack { justify-content: center; }
  }
`;
