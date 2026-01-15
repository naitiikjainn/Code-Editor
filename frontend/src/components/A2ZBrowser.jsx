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

    // Load solved problems from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('a2z_solved');
        if (saved) {
            setSolvedProblems(new Set(JSON.parse(saved)));
        }
    }, []);

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
            background: '#0a0a0b', 
            display: 'flex', 
            flexDirection: 'column',
            fontFamily: "'Inter', -apple-system, sans-serif"
        }}>
            {/* Header */}
            <div style={{ 
                padding: '20px', 
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, transparent 100%)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ 
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <BookOpen size={20} color="#fff" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>
                            Striver's A2Z DSA Sheet
                        </h2>
                        <div style={{ fontSize: '12px', color: '#71717a' }}>
                            Master DSA from basics to advanced
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(4, 1fr)', 
                    gap: '12px', 
                    marginBottom: '16px' 
                }}>
                    <StatBox icon={<Target size={14} />} value={stats.total} label="Total" color="#3b82f6" />
                    <StatBox icon={<CheckCircle size={14} />} value={stats.solved} label="Solved" color="#22c55e" />
                    <StatBox icon={<Flame size={14} />} value={`${stats.progress}%`} label="Progress" color="#f59e0b" />
                    <StatBox icon={<Trophy size={14} />} value={stats.hard} label="Hard" color="#ef4444" />
                </div>

                {/* Progress Bar */}
                <div style={{ 
                    height: '6px', 
                    background: 'rgba(255,255,255,0.05)', 
                    borderRadius: '3px', 
                    overflow: 'hidden',
                    marginBottom: '16px'
                }}>
                    <div style={{ 
                        height: '100%', 
                        width: `${stats.progress}%`, 
                        background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                    }} />
                </div>

                {/* Search & Filter */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        padding: '0 12px'
                    }}>
                        <Search size={16} color="#52525b" />
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
                                color: '#e4e4e7',
                                fontSize: '13px',
                                padding: '10px 0'
                            }}
                        />
                        {searchQuery && (
                            <X 
                                size={14} 
                                color="#52525b" 
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSearchQuery('')}
                            />
                        )}
                    </div>
                    <select
                        value={difficultyFilter}
                        onChange={(e) => setDifficultyFilter(e.target.value)}
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px',
                            padding: '0 16px',
                            color: '#e4e4e7',
                            fontSize: '13px',
                            outline: 'none',
                            cursor: 'pointer'
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
                                    gap: '12px',
                                    padding: '14px 16px',
                                    background: isExpanded ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${isExpanded ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {isExpanded ? 
                                    <ChevronDown size={18} color="#8b5cf6" /> : 
                                    <ChevronRight size={18} color="#52525b" />
                                }
                                
                                <div style={{ 
                                    width: '28px', height: '28px', borderRadius: '8px',
                                    background: `rgba(139, 92, 246, ${0.1 + (topicIndex * 0.03)})`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: '600', color: '#8b5cf6'
                                }}>
                                    {topicIndex + 1}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ 
                                        fontSize: '14px', 
                                        fontWeight: '600', 
                                        color: isExpanded ? '#fff' : '#e4e4e7' 
                                    }}>
                                        {topic.topic}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#52525b', marginTop: '2px' }}>
                                        {topicSolved}/{topic.problems.length} completed
                                    </div>
                                </div>

                                {/* Mini Progress */}
                                <div style={{ 
                                    width: '60px', height: '4px', 
                                    background: 'rgba(255,255,255,0.1)', 
                                    borderRadius: '2px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${topicProgress}%`, 
                                        background: topicProgress === 100 ? '#22c55e' : '#8b5cf6',
                                        transition: 'width 0.3s'
                                    }} />
                                </div>

                                <span style={{ 
                                    fontSize: '12px', 
                                    fontWeight: '500',
                                    color: topicProgress === 100 ? '#22c55e' : '#71717a',
                                    minWidth: '35px',
                                    textAlign: 'right'
                                }}>
                                    {topicProgress}%
                                </span>
                            </div>

                            {/* Problems List */}
                            {isExpanded && (
                                <div style={{ 
                                    marginTop: '4px',
                                    marginLeft: '20px',
                                    borderLeft: '2px solid rgba(139, 92, 246, 0.2)',
                                    paddingLeft: '16px'
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
                                                    gap: '12px',
                                                    padding: '12px 14px',
                                                    background: isSolved ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255,255,255,0.01)',
                                                    border: '1px solid rgba(255,255,255,0.03)',
                                                    borderRadius: '10px',
                                                    marginBottom: '4px',
                                                    cursor: isLoading ? 'wait' : 'pointer',
                                                    transition: 'all 0.2s',
                                                    opacity: isLoading ? 0.7 : 1
                                                }}
                                                onMouseEnter={e => !isLoading && (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)')}
                                                onMouseLeave={e => e.currentTarget.style.background = isSolved ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255,255,255,0.01)'}
                                            >
                                                {/* Solved Checkbox */}
                                                <div 
                                                    onClick={(e) => toggleSolved(problem.id, e)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {isSolved ? 
                                                        <CheckCircle size={18} color="#22c55e" /> : 
                                                        <Circle size={18} color="#3f3f46" />
                                                    }
                                                </div>

                                                {/* Problem Number */}
                                                <span style={{ 
                                                    fontSize: '11px', 
                                                    color: '#52525b',
                                                    minWidth: '24px'
                                                }}>
                                                    {idx + 1}.
                                                </span>

                                                {/* Problem Title */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ 
                                                        fontSize: '13px', 
                                                        fontWeight: '500', 
                                                        color: isSolved ? '#22c55e' : '#e4e4e7',
                                                        textDecoration: isSolved ? 'line-through' : 'none',
                                                        opacity: isSolved ? 0.8 : 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        {problem.title}
                                                        {isLoading && <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />}
                                                    </div>
                                                </div>

                                                {/* Difficulty Badge */}
                                                <span style={{
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    background: `${getDifficultyColor(problem.difficulty)}15`,
                                                    color: getDifficultyColor(problem.difficulty)
                                                }}>
                                                    {problem.difficulty}
                                                </span>

                                                {/* Platform Badge */}
                                                <span style={{
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '10px',
                                                    fontWeight: '500',
                                                    background: `${getPlatformColor(problem.provider || problem.platform)}15`,
                                                    color: getPlatformColor(problem.provider || problem.platform),
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {getPlatformLabel(problem.provider || problem.platform)}
                                                </span>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    {problem.videoLink && (
                                                        <a
                                                            href={problem.videoLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{
                                                                width: '28px', height: '28px',
                                                                borderRadius: '6px',
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            title="Watch Video Solution"
                                                        >
                                                            <Youtube size={14} color="#ef4444" />
                                                        </a>
                                                    )}
                                                    <a
                                                        href={problem.url || problem.platformLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            width: '28px', height: '28px',
                                                            borderRadius: '6px',
                                                            background: 'rgba(59, 130, 246, 0.1)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        title="Open on Platform"
                                                    >
                                                        <ExternalLink size={14} color="#3b82f6" />
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
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '10px',
        padding: '12px',
        textAlign: 'center'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ color }}>{icon}</span>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>{value}</span>
        </div>
        <div style={{ fontSize: '10px', color: '#52525b', textTransform: 'uppercase' }}>{label}</div>
    </div>
);

export default A2ZBrowser;
