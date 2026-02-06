import React, { useState, useEffect, useMemo } from 'react';
import a2zData from './a2z.json';
import a2zCache from './a2z-cache.json';
import { 
    ChevronDown, ChevronRight, CheckCircle, Circle, Play, ExternalLink, 
    Youtube, Search, Filter, BookOpen, Target, Flame, Trophy, X, Loader2
} from 'lucide-react';
import { API_URL } from '../config';

// Helper to extract slug from platform URL
const extractSlug = (url, platform) => {
    try {
        if (platform === 'leetcode') {
            // https://leetcode.com/problems/two-sum/ -> two-sum
            const match = url.match(/\/problems\/([^\/]+)/);
            return match ? match[1] : null;
        } else if (platform === 'geeksforgeeks') {
            // https://www.geeksforgeeks.org/problems/count-digits5716/1 -> count-digits5716
            const match = url.match(/\/problems\/([^\/]+)/);
            return match ? match[1] : null;
        }
        return null;
    } catch {
        return null;
    }
};

const A2ZBrowser = ({ onOpenProblem, user }) => {
    const [expandedTopic, setExpandedTopic] = useState(null);
    const [solvedProblems, setSolvedProblems] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('all');
    const [loadingId, setLoadingId] = useState(null);

    // Build a reverse map: titleSlug -> a2zId (for DB sync)
    const slugToA2zId = useMemo(() => {
        const map = {};
        const cacheProblems = a2zCache.problems || {};
        for (const [a2zId, cached] of Object.entries(cacheProblems)) {
            if (cached.titleSlug) {
                map[cached.titleSlug] = a2zId;
            }
        }
        // Also map from URL for problems not in cache
        for (const topic of a2zData) {
            for (const prob of topic.problems) {
                const slug = extractSlug(prob.url, (prob.provider || prob.platform || '').toLowerCase());
                if (slug && !map[slug]) {
                    map[slug] = prob.id;
                }
            }
        }
        return map;
    }, []);

    // Load solved problems from localStorage + sync from DB + LeetCode API
    useEffect(() => {
        // 1. Load manual toggles from localStorage
        const saved = localStorage.getItem('a2z_solved');
        const localSolved = saved ? new Set(JSON.parse(saved)) : new Set();
        setSolvedProblems(localSolved);

        const token = localStorage.getItem('codeplay_token');
        const lcUsername = user?.platforms?.leetcode;
        const allSolvedSlugs = new Set();

        // 2. Fetch accepted submissions from our DB
        const dbPromise = token
            ? fetch(`${API_URL}/api/submissions/solved?platform=leetcode`, {
                headers: { Authorization: `Bearer ${token}` }
              }).then(r => r.json()).then(data => {
                  if (data.solved) data.solved.forEach(s => allSolvedSlugs.add(s));
              }).catch(() => {})
            : Promise.resolve();

        // 3. Fetch ALL solved from LeetCode API via extension cookies
        const lcApiPromise = new Promise((resolve) => {
            const handler = (event) => {
                if (event.data?.type === "CODEPLAY_COOKIES_RECEIVED") {
                    window.removeEventListener("message", handler);
                    const payload = event.data.payload;
                    if (payload?.success && payload.cookie && payload.csrfToken) {
                        const authToken = localStorage.getItem('codeplay_token');
                        fetch(`${API_URL}/api/leettools/solved`, {
                            method: "POST",
                            headers: { 
                                "Content-Type": "application/json",
                                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                            },
                            body: JSON.stringify({ 
                                cookie: payload.cookie, 
                                csrfToken: payload.csrfToken, 
                                ...(lcUsername ? { username: lcUsername } : {})
                            })
                        })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success && data.solved) {
                                data.solved.forEach(s => allSolvedSlugs.add(s));
                                console.log(`[A2ZBrowser] LeetCode API: ${data.solved.length} solved loaded`);
                            }
                            resolve();
                        })
                        .catch(() => resolve());
                    } else {
                        resolve(); // Extension available but no cookies
                    }
                }
            };
            window.addEventListener("message", handler);
            window.postMessage({ type: "CODEPLAY_FETCH_COOKIES" }, "*");
            setTimeout(() => { window.removeEventListener("message", handler); resolve(); }, 10000);
        });

        // 4. Merge all solved slugs into A2Z problem IDs
        Promise.all([dbPromise, lcApiPromise]).then(() => {
            if (allSolvedSlugs.size > 0) {
                const merged = new Set(localSolved);
                let newCount = 0;

                for (const titleSlug of allSolvedSlugs) {
                    const a2zId = slugToA2zId[titleSlug];
                    if (a2zId && !merged.has(a2zId)) {
                        merged.add(a2zId);
                        newCount++;
                    }
                }

                if (newCount > 0) {
                    console.log(`[A2ZBrowser] Auto-marked ${newCount} problems as solved (total: ${merged.size})`);
                    setSolvedProblems(merged);
                    localStorage.setItem('a2z_solved', JSON.stringify([...merged]));
                }
            }
        });
    }, [slugToA2zId, user]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = a2zData.reduce((acc, topic) => acc + topic.problems.length, 0);
        const solved = solvedProblems.size;
        const easy = a2zData.reduce((acc, topic) => 
            acc + topic.problems.filter(p => p.difficulty === 'Easy').length, 0);
        const medium = a2zData.reduce((acc, topic) => 
            acc + topic.problems.filter(p => p.difficulty === 'Medium').length, 0);
        const hard = a2zData.reduce((acc, topic) => 
            acc + topic.problems.filter(p => p.difficulty === 'Hard').length, 0);
        
        return { total, solved, easy, medium, hard, progress: Math.round((solved / total) * 100) };
    }, [solvedProblems]);

    // Filter problems based on search and difficulty
    const filteredData = useMemo(() => {
        return a2zData.map(topic => ({
            ...topic,
            problems: topic.problems.filter(problem => {
                const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesDifficulty = difficultyFilter === 'all' || problem.difficulty === difficultyFilter;
                return matchesSearch && matchesDifficulty;
            })
        })).filter(topic => topic.problems.length > 0);
    }, [searchQuery, difficultyFilter]);

    const toggleTopic = (topicId) => {
        setExpandedTopic(expandedTopic === topicId ? null : topicId);
    };

    const toggleSolved = (problemId, e) => {
        e.stopPropagation();
        const newSolved = new Set(solvedProblems);
        if (newSolved.has(problemId)) {
            newSolved.delete(problemId);
        } else {
            newSolved.add(problemId);
        }
        setSolvedProblems(newSolved);
        localStorage.setItem('a2z_solved', JSON.stringify([...newSolved]));
    };

    const handleProblemClick = async (problem) => {
        if (loadingId) return;
        setLoadingId(problem.id);

        // Support both old format (platform, platformLink) and new format (provider, url)
        const platform = (problem.provider || problem.platform || '').toLowerCase();
        const platformLink = problem.url || problem.platformLink;
        
        console.log(`[A2ZBrowser] Opening problem: ${problem.id} (${platform})`);

        // Check cache first for basic data (description, titleSlug, questionId)
        const cachedProblem = a2zCache.problems[problem.id];
        console.log(`[A2ZBrowser] Cache lookup for ${problem.id}:`, cachedProblem ? { titleSlug: cachedProblem.titleSlug, questionId: cachedProblem.questionId } : 'NOT FOUND');
        
        // For LeetCode: Always fetch fresh to get snippets and examples (not in cache)
        if (platform === 'leetcode' && cachedProblem?.titleSlug) {
            console.log("[A2ZBrowser] LeetCode - fetching snippets/examples from API...");
            try {
                const res = await fetch(`${API_URL}/api/problems/leetcode/${cachedProblem.titleSlug}`);
                const freshData = await res.json();
                
                if (!freshData.error && freshData.snippets) {
                    console.log("[A2ZBrowser] ✓ Got LeetCode snippets!");
                    onOpenProblem({
                        ...cachedProblem,
                        ...freshData, // Merge fresh snippets, examples
                        a2zId: problem.id,
                        isSolved: solvedProblems.has(problem.id)
                    });
                    setLoadingId(null);
                    return;
                }
            } catch (e) {
                console.warn("[A2ZBrowser] Failed to fetch LeetCode snippets, using cache:", e);
            }
            // Fallback to cache if API fails
            onOpenProblem({
                ...cachedProblem,
                a2zId: problem.id,
                isSolved: solvedProblems.has(problem.id)
            });
            setLoadingId(null);
            return;
        }
        
        // For non-LeetCode cached problems, use cache directly
        if (cachedProblem && cachedProblem.description) {
            console.log("[A2ZBrowser] ✓ Found in cache!");
            onOpenProblem({
                ...cachedProblem,
                a2zId: problem.id,
                isSolved: solvedProblems.has(problem.id)
            });
            setLoadingId(null);
            return;
        }

        const slug = extractSlug(platformLink, platform);
        console.log(`[A2ZBrowser] Not in cache, fetching from ${platform}: ${slug}`);

        try {
            if (platform === 'leetcode' && slug) {
                // Fetch from LeetCode API
                const res = await fetch(`${API_URL}/api/problems/leetcode/${slug}`);
                const data = await res.json();

                if (!data.error && data.description) {
                    console.log("[A2ZBrowser] LeetCode API Success!");
                    onOpenProblem({
                        ...data,
                        provider: 'leetcode',
                        id: problem.id,
                        title: data.title || problem.title,
                        url: platformLink,
                        a2zId: problem.id, // Track for solved status
                        isSolved: solvedProblems.has(problem.id)
                    });
                    setLoadingId(null);
                    return;
                }
                throw new Error("LeetCode API failed");
            } else if ((platform === 'geeksforgeeks' || platform === 'gfg') && slug) {
                // Fetch from GFG API
                const res = await fetch(`${API_URL}/api/problems/gfg/${slug}`);
                const data = await res.json();

                if (!data.error) {
                    console.log("[A2ZBrowser] GFG API Success!");
                    onOpenProblem({
                        ...data,
                        provider: 'geeksforgeeks',
                        id: problem.id,
                        title: data.title || problem.title,
                        url: platformLink,
                        a2zId: problem.id,
                        isSolved: solvedProblems.has(problem.id)
                    });
                    setLoadingId(null);
                    return;
                }
                throw new Error("GFG API failed");
            } else {
                // For other platforms (CodingNinjas, etc.) - open externally for now
                throw new Error("Platform not supported yet");
            }
        } catch (err) {
            console.warn(`[A2ZBrowser] API failed for ${platform}:`, err.message);
            
            // Fallback: Create a problem object with external link
            const displayPlatform = platform === 'geeksforgeeks' || platform === 'gfg' ? 'GeeksforGeeks' : 
                                   platform === 'leetcode' ? 'LeetCode' : 
                                   platform === 'codingninjas' ? 'CodingNinjas' : platform;
            onOpenProblem({
                provider: platform,
                id: problem.id,
                title: problem.title,
                difficulty: problem.difficulty,
                url: platformLink,
                a2zId: problem.id,
                isSolved: solvedProblems.has(problem.id),
                description: `
                    <div style="padding: 24px; text-align: center;">
                        <h2 style="color: #fff; margin-bottom: 16px;">${problem.title}</h2>
                        <p style="color: #a1a1aa; margin-bottom: 24px;">
                            This problem is from <strong>${displayPlatform}</strong>.
                            <br/>Click below to view the full problem statement.
                        </p>
                        <a href="${platformLink}" target="_blank" rel="noopener noreferrer" 
                           style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; 
                                  background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; 
                                  text-decoration: none; border-radius: 8px; font-weight: 600;">
                            Open on ${displayPlatform}
                        </a>
                        ${problem.videoLink ? `
                            <br/><br/>
                            <a href="${problem.videoLink}" target="_blank" rel="noopener noreferrer" 
                               style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; 
                                      background: rgba(239, 68, 68, 0.2); color: #ef4444; 
                                      text-decoration: none; border-radius: 8px; font-weight: 500; border: 1px solid rgba(239, 68, 68, 0.3);">
                                Watch Video Solution
                            </a>
                        ` : ''}
                    </div>
                `
            });
        } finally {
            setLoadingId(null);
        }
    };

    const getDifficultyColor = (difficulty) => {
        switch (difficulty) {
            case 'Easy': return '#22c55e';
            case 'Medium': return '#f59e0b';
            case 'Hard': return '#ef4444';
            default: return '#71717a';
        }
    };

    const getPlatformColor = (platform) => {
        const p = (platform || '').toLowerCase();
        switch (p) {
            case 'leetcode': return '#fbbf24';
            case 'geeksforgeeks': 
            case 'gfg': return '#22c55e';
            case 'codingninjas': return '#f97316';
            default: return '#3b82f6';
        }
    };

    const getPlatformLabel = (platform) => {
        const p = (platform || '').toLowerCase();
        switch (p) {
            case 'leetcode': return 'LC';
            case 'geeksforgeeks':
            case 'gfg': return 'GFG';
            case 'codingninjas': return 'CN';
            default: return platform?.toUpperCase()?.slice(0, 3) || 'N/A';
        }
    };

    return (
        <div style={{ 
            height: '100%', 
            background: 'var(--bg-dark)', 
            display: 'flex', 
            flexDirection: 'column',
            fontFamily: 'var(--font-main)'
        }}>
            {/* Header */}
            <div style={{ 
                padding: '20px 18px 18px', 
                borderBottom: '1px solid var(--border-subtle)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                    <div style={{ 
                        width: '42px', height: '42px', borderRadius: '12px',
                        background: 'rgba(124, 92, 252, 0.12)',
                        border: '1px solid rgba(124, 92, 252, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <BookOpen size={20} color="var(--accent-primary)" strokeWidth={1.8} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                            Striver's A2Z DSA Sheet
                        </h2>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Master DSA from basics to advanced
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(4, 1fr)', 
                    gap: '8px', 
                    marginBottom: '16px' 
                }}>
                    <StatBox icon={<Target size={13} strokeWidth={1.8} />} value={stats.total} label="Total" color="var(--accent-secondary)" />
                    <StatBox icon={<CheckCircle size={13} strokeWidth={1.8} />} value={stats.solved} label="Solved" color="var(--accent-success)" />
                    <StatBox icon={<Flame size={13} strokeWidth={1.8} />} value={`${stats.progress}%`} label="Progress" color="var(--accent-warning)" />
                    <StatBox icon={<Trophy size={13} strokeWidth={1.8} />} value={stats.hard} label="Hard" color="var(--accent-danger)" />
                </div>

                {/* Progress Bar */}
                <div style={{ 
                    height: '3px', 
                    background: 'rgba(255,255,255,0.04)', 
                    borderRadius: '2px', 
                    overflow: 'hidden',
                    marginBottom: '16px'
                }}>
                    <div style={{ 
                        height: '100%', 
                        width: `${stats.progress}%`, 
                        background: 'var(--accent-primary)',
                        borderRadius: '2px',
                        transition: 'width 0.4s var(--ease-smooth)'
                    }} />
                </div>

                {/* Search & Filter */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        padding: '0 12px',
                        transition: 'border-color 0.2s var(--ease-smooth)'
                    }}>
                        <Search size={15} color="var(--text-dim)" strokeWidth={1.8} />
                        <input
                            type="text"
                            placeholder="Search problems..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                flex: 1,
                                background: 'none',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-main)',
                                fontSize: '13px',
                                padding: '9px 0',
                                fontFamily: 'var(--font-main)'
                            }}
                        />
                        {searchQuery && (
                            <X 
                                size={14} 
                                color="var(--text-dim)" 
                                style={{ cursor: 'pointer', borderRadius: '4px', padding: '1px' }}
                                onClick={() => setSearchQuery('')}
                            />
                        )}
                    </div>
                    <select
                        value={difficultyFilter}
                        onChange={(e) => setDifficultyFilter(e.target.value)}
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '10px',
                            padding: '0 14px',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            outline: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-main)',
                            transition: 'border-color 0.2s var(--ease-smooth)'
                        }}
                    >
                        <option value="all">All Levels</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>
                </div>
            </div>

            {/* Topics List */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }} className="custom-scrollbar">
                {filteredData.map((topic, topicIndex) => {
                    const isExpanded = expandedTopic === topicIndex;
                    const topicSolved = topic.problems.filter(p => solvedProblems.has(p.id)).length;
                    const topicProgress = Math.round((topicSolved / topic.problems.length) * 100);

                    return (
                        <div key={topicIndex} style={{ marginBottom: '8px' }}>
                            {/* Topic Header */}
                            <div
                                onClick={() => toggleTopic(topicIndex)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 14px',
                                    background: isExpanded ? 'rgba(124, 92, 252, 0.06)' : 'rgba(255,255,255,0.015)',
                                    border: `1px solid ${isExpanded ? 'rgba(124, 92, 252, 0.15)' : 'var(--border-subtle)'}`,
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s var(--ease-smooth)'
                                }}
                                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; }}
                            >
                                {isExpanded ? 
                                    <ChevronDown size={16} color="var(--accent-primary)" strokeWidth={2} /> : 
                                    <ChevronRight size={16} color="var(--text-dim)" strokeWidth={2} />
                                }
                                
                                <div style={{ 
                                    width: '26px', height: '26px', borderRadius: '8px',
                                    background: isExpanded ? 'rgba(124, 92, 252, 0.15)' : 'rgba(255,255,255,0.04)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '11px', fontWeight: '600', 
                                    color: isExpanded ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    transition: 'all 0.2s var(--ease-smooth)',
                                    flexShrink: 0
                                }}>
                                    {topicIndex + 1}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ 
                                        fontSize: '13px', 
                                        fontWeight: '550', 
                                        color: isExpanded ? 'var(--text-main)' : '#d1d1d6',
                                        letterSpacing: '-0.01em',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {topic.topic}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '1px' }}>
                                        {topicSolved}/{topic.problems.length} completed
                                    </div>
                                </div>

                                {/* Mini Progress */}
                                <div style={{ 
                                    width: '48px', height: '3px', 
                                    background: 'rgba(255,255,255,0.06)', 
                                    borderRadius: '2px',
                                    overflow: 'hidden',
                                    flexShrink: 0
                                }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${topicProgress}%`, 
                                        background: topicProgress === 100 ? 'var(--accent-success)' : 'var(--accent-primary)',
                                        borderRadius: '2px',
                                        transition: 'width 0.4s var(--ease-smooth)'
                                    }} />
                                </div>

                                <span style={{ 
                                    fontSize: '11px', 
                                    fontWeight: '500',
                                    color: topicProgress === 100 ? 'var(--accent-success)' : 'var(--text-muted)',
                                    minWidth: '32px',
                                    textAlign: 'right',
                                    fontVariantNumeric: 'tabular-nums'
                                }}>
                                    {topicProgress}%
                                </span>
                            </div>

                            {/* Problems List */}
                            {isExpanded && (
                                <div style={{ 
                                    marginTop: '4px',
                                    marginLeft: '18px',
                                    borderLeft: '1.5px solid rgba(124, 92, 252, 0.12)',
                                    paddingLeft: '14px'
                                }}>
                                    {topic.problems.map((problem, idx) => {
                                        const isSolved = solvedProblems.has(problem.id);
                                        const isLoading = loadingId === problem.id;

                                        return (
                                            <div
                                                key={problem.id}
                                                onClick={() => !isLoading && handleProblemClick(problem)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '10px 12px',
                                                    background: isSolved ? 'rgba(48, 209, 88, 0.04)' : 'transparent',
                                                    borderRadius: '10px',
                                                    marginBottom: '2px',
                                                    cursor: isLoading ? 'wait' : 'pointer',
                                                    transition: 'background 0.15s var(--ease-smooth)',
                                                    opacity: isLoading ? 0.6 : 1
                                                }}
                                                onMouseEnter={e => !isLoading && (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                                onMouseLeave={e => e.currentTarget.style.background = isSolved ? 'rgba(48, 209, 88, 0.04)' : 'transparent'}
                                            >
                                                {/* Solved Checkbox */}
                                                <div 
                                                    onClick={(e) => toggleSolved(problem.id, e)}
                                                    style={{ cursor: 'pointer', flexShrink: 0, display: 'flex' }}
                                                >
                                                    {isSolved ? 
                                                        <CheckCircle size={16} color="var(--accent-success)" strokeWidth={2} /> : 
                                                        <Circle size={16} color="var(--text-dim)" strokeWidth={1.5} />
                                                    }
                                                </div>

                                                {/* Problem Number */}
                                                <span style={{ 
                                                    fontSize: '11px', 
                                                    color: 'var(--text-dim)',
                                                    minWidth: '22px',
                                                    fontVariantNumeric: 'tabular-nums'
                                                }}>
                                                    {idx + 1}.
                                                </span>

                                                {/* Problem Title */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ 
                                                        fontSize: '13px', 
                                                        fontWeight: '450', 
                                                        color: isSolved ? 'var(--accent-success)' : 'var(--text-main)',
                                                        textDecoration: isSolved ? 'line-through' : 'none',
                                                        opacity: isSolved ? 0.7 : 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        letterSpacing: '-0.01em',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{problem.title}</span>
                                                        {isLoading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                                                    </div>
                                                </div>

                                                {/* Difficulty Badge */}
                                                <span style={{
                                                    padding: '2px 7px',
                                                    borderRadius: '5px',
                                                    fontSize: '10px',
                                                    fontWeight: '550',
                                                    background: `${getDifficultyColor(problem.difficulty)}10`,
                                                    color: getDifficultyColor(problem.difficulty),
                                                    letterSpacing: '0.02em',
                                                    flexShrink: 0
                                                }}>
                                                    {problem.difficulty}
                                                </span>

                                                {/* Platform Badge */}
                                                <span style={{
                                                    padding: '2px 7px',
                                                    borderRadius: '5px',
                                                    fontSize: '10px',
                                                    fontWeight: '500',
                                                    background: `${getPlatformColor(problem.provider || problem.platform)}10`,
                                                    color: getPlatformColor(problem.provider || problem.platform),
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.03em',
                                                    flexShrink: 0
                                                }}>
                                                    {getPlatformLabel(problem.provider || problem.platform)}
                                                </span>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                    {problem.videoLink && (
                                                        <a
                                                            href={problem.videoLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{
                                                                width: '26px', height: '26px',
                                                                borderRadius: '7px',
                                                                background: 'rgba(255, 69, 58, 0.08)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'background 0.15s'
                                                            }}
                                                            title="Watch Video Solution"
                                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 69, 58, 0.16)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 69, 58, 0.08)'}
                                                        >
                                                            <Youtube size={13} color="var(--accent-danger)" strokeWidth={1.8} />
                                                        </a>
                                                    )}
                                                    <a
                                                        href={problem.url || problem.platformLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            width: '26px', height: '26px',
                                                            borderRadius: '7px',
                                                            background: 'rgba(255,255,255,0.04)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'background 0.15s'
                                                        }}
                                                        title="Open on Platform"
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                                    >
                                                        <ExternalLink size={13} color="var(--text-muted)" strokeWidth={1.8} />
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* CSS for spinner animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

// Stat Box Component
const StatBox = ({ icon, value, label, color }) => (
    <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '10px 8px',
        textAlign: 'center',
        transition: 'background 0.15s var(--ease-smooth)'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '3px' }}>
            <span style={{ color, display: 'flex', opacity: 0.85 }}>{icon}</span>
            <span style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</span>
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '500' }}>{label}</div>
    </div>
);

export default A2ZBrowser;
