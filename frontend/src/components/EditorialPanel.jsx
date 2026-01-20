import React, { useState, useEffect } from 'react';
import { getEditorial, extractCodeBlocks } from '../utils/editorialService';
import { X, ExternalLink, Code, FileText, Copy, Check, Loader2 } from 'lucide-react';

const EditorialPanel = ({ contestId, problemIndex, problemName, onClose, onUseCode }) => {
    const [editorial, setEditorial] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tutorial'); // 'tutorial' or 'code'
    const [codeBlocks, setCodeBlocks] = useState([]);
    const [copiedIndex, setCopiedIndex] = useState(-1);
    const [showFullEditorial, setShowFullEditorial] = useState(false);

    useEffect(() => {
        const fetchEditorial = async () => {
            setLoading(true);
            try {
                const result = await getEditorial(contestId, problemIndex);
                console.log('[Editorial] Fetched result:', {
                    success: result.success,
                    contentLength: result.content?.length,
                    problemSectionLength: result.problemSection?.length,
                    hasProblemSection: !!result.problemSection
                });
                setEditorial(result);
                
                // Extract code blocks from content
                if (result.success && result.content) {
                    const codes = extractCodeBlocks(
                        result.problemSection || result.content
                    );
                    setCodeBlocks(codes);
                }
            } catch (e) {
                console.error('Error fetching editorial:', e);
                setEditorial({ success: false, error: 'Failed to fetch editorial' });
            }
            setLoading(false);
        };
        
        if (contestId) {
            fetchEditorial();
        }
    }, [contestId, problemIndex]);

    const copyCode = (code, index) => {
        navigator.clipboard.writeText(code);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(-1), 2000);
    };

    const handleUseCode = (code) => {
        if (onUseCode) {
            onUseCode(code);
            onClose();
        }
    };

    // Process HTML content to style it properly
    const processContent = (html) => {
        if (!html) return '';
        
        // Add styling to code blocks, images, etc.
        return html
            .replace(/<pre/g, '<pre style="background:#1a1a1a;padding:15px;border-radius:8px;overflow-x:auto;margin:15px 0;font-family:monospace;font-size:13px;border:1px solid #333;"')
            .replace(/<code/g, '<code style="background:#2d2d2d;padding:2px 6px;border-radius:4px;font-family:monospace;"')
            .replace(/<img/g, '<img style="max-width:100%;border-radius:8px;margin:10px 0;"')
            .replace(/<table/g, '<table style="border-collapse:collapse;width:100%;margin:15px 0;"')
            .replace(/<th/g, '<th style="border:1px solid #444;padding:8px;background:#2d2d2d;"')
            .replace(/<td/g, '<td style="border:1px solid #444;padding:8px;"')
            .replace(/<a /g, '<a style="color:#58a6ff;text-decoration:none;" target="_blank" ')
            .replace(/<h1/g, '<h1 style="color:#fff;border-bottom:1px solid #333;padding-bottom:10px;margin-top:25px;"')
            .replace(/<h2/g, '<h2 style="color:#fff;margin-top:25px;"')
            .replace(/<h3/g, '<h3 style="color:#ccc;margin-top:20px;"')
            .replace(/<ul/g, '<ul style="padding-left:25px;margin:10px 0;"')
            .replace(/<ol/g, '<ol style="padding-left:25px;margin:10px 0;"')
            .replace(/<li/g, '<li style="margin:5px 0;"')
            .replace(/<blockquote/g, '<blockquote style="border-left:3px solid #007acc;padding-left:15px;margin:15px 0;color:#888;"');
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '55%',
            maxWidth: '800px',
            height: '100vh',
            backgroundColor: '#1e1e1e',
            borderLeft: '2px solid #007acc',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.6)'
        }}>
            {/* Header */}
            <div style={{
                padding: '15px 20px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#252526'
            }}>
                <div>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} />
                        Tutorial - {contestId}{problemIndex}
                    </h3>
                    {problemName && (
                        <span style={{ color: '#888', fontSize: '12px' }}>{problemName}</span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {editorial?.url && (
                        <a
                            href={editorial.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 12px',
                                backgroundColor: '#007acc',
                                color: '#fff',
                                textDecoration: 'none',
                                borderRadius: '4px',
                                fontSize: '12px'
                            }}
                        >
                            <ExternalLink size={14} />
                            Open on CF
                        </a>
                    )}
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#888',
                            cursor: 'pointer',
                            padding: '5px'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            {editorial?.success && (
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid #333',
                    backgroundColor: '#252526'
                }}>
                    <button
                        onClick={() => setActiveTab('tutorial')}
                        style={{
                            padding: '12px 24px',
                            background: activeTab === 'tutorial' ? '#1e1e1e' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'tutorial' ? '2px solid #007acc' : '2px solid transparent',
                            color: activeTab === 'tutorial' ? '#fff' : '#888',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <FileText size={16} />
                        Tutorial
                    </button>
                    <button
                        onClick={() => setActiveTab('code')}
                        style={{
                            padding: '12px 24px',
                            background: activeTab === 'code' ? '#1e1e1e' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'code' ? '2px solid #007acc' : '2px solid transparent',
                            color: activeTab === 'code' ? '#fff' : '#888',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <Code size={16} />
                        Code ({codeBlocks.length})
                    </button>
                </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {loading ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '200px',
                        color: '#888',
                        gap: '15px'
                    }}>
                        <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                        <div>Loading tutorial from Codeforces...</div>
                    </div>
                ) : editorial?.success ? (
                    activeTab === 'tutorial' ? (
                        <div style={{ padding: '20px' }}>
                            {/* Author info */}
                            {editorial.author && (
                                <div style={{
                                    marginBottom: '20px',
                                    padding: '10px 15px',
                                    backgroundColor: '#2d2d2d',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <span style={{ color: '#888' }}>By:</span>
                                    <a
                                        href={`https://codeforces.com/profile/${editorial.author}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#58a6ff', textDecoration: 'none', fontWeight: 'bold' }}
                                    >
                                        {editorial.author}
                                    </a>
                                </div>
                            )}

                            {/* Problem Section Toggle */}
                            {editorial.problemSection ? (
                                <div style={{ marginBottom: '20px' }}>
                                    <button
                                        onClick={() => setShowFullEditorial(!showFullEditorial)}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: showFullEditorial ? '#007acc' : '#333',
                                            border: '1px solid #444',
                                            color: '#fff',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        {showFullEditorial ? `Show Only Problem ${problemIndex}` : 'Show Full Editorial'}
                                    </button>
                                    <span style={{ marginLeft: '10px', color: '#888', fontSize: '12px' }}>
                                        {showFullEditorial ? '(Showing all problems)' : `(Showing only ${contestId}${problemIndex})`}
                                    </span>
                                </div>
                            ) : (
                                <div style={{ 
                                    marginBottom: '20px', 
                                    padding: '10px 15px',
                                    backgroundColor: '#3a3000',
                                    borderRadius: '8px',
                                    color: '#ffcc00',
                                    fontSize: '12px'
                                }}>
                                    ⚠️ Could not extract specific section for problem {problemIndex}. Showing full editorial.
                                </div>
                            )}

                            {/* Editorial Content */}
                            <div 
                                style={{ 
                                    color: '#d4d4d4',
                                    lineHeight: 1.7,
                                    fontSize: '14px'
                                }}
                                dangerouslySetInnerHTML={{ 
                                    __html: processContent(
                                        showFullEditorial || !editorial.problemSection 
                                            ? editorial.content 
                                            : editorial.problemSection
                                    )
                                }}
                            />
                        </div>
                    ) : (
                        /* Code Tab */
                        <div style={{ padding: '20px' }}>
                            {codeBlocks.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {codeBlocks.map((block, idx) => (
                                        <div key={idx} style={{
                                            backgroundColor: '#1a1a1a',
                                            borderRadius: '8px',
                                            border: '1px solid #333',
                                            overflow: 'hidden'
                                        }}>
                                            {/* Code Header */}
                                            <div style={{
                                                padding: '10px 15px',
                                                backgroundColor: '#252526',
                                                borderBottom: '1px solid #333',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span style={{ color: '#888', fontSize: '12px' }}>
                                                    Solution {idx + 1} ({block.language.toUpperCase()})
                                                </span>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => copyCode(block.code, idx)}
                                                        style={{
                                                            padding: '5px 10px',
                                                            backgroundColor: '#333',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            color: '#ccc',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            fontSize: '11px'
                                                        }}
                                                    >
                                                        {copiedIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                                                        {copiedIndex === idx ? 'Copied!' : 'Copy'}
                                                    </button>
                                                    {onUseCode && (
                                                        <button
                                                            onClick={() => handleUseCode(block.code)}
                                                            style={{
                                                                padding: '5px 10px',
                                                                backgroundColor: '#007acc',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                color: '#fff',
                                                                cursor: 'pointer',
                                                                fontSize: '11px'
                                                            }}
                                                        >
                                                            Use Code
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Code Content */}
                                            <pre style={{
                                                margin: 0,
                                                padding: '15px',
                                                overflow: 'auto',
                                                maxHeight: '400px',
                                                fontSize: '13px',
                                                fontFamily: "'JetBrains Mono', monospace",
                                                color: '#d4d4d4',
                                                lineHeight: 1.5
                                            }}>
                                                {block.code}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                                    <Code size={48} style={{ marginBottom: '15px', opacity: 0.5 }} />
                                    <p>No code blocks found in this editorial.</p>
                                    <p style={{ fontSize: '12px' }}>Check the Tutorial tab for the solution approach.</p>
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    /* Not Found State */
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📝</div>
                        <h3 style={{ color: '#fff', marginBottom: '10px' }}>
                            Tutorial Not Available
                        </h3>
                        <p style={{ color: '#888', marginBottom: '25px', maxWidth: '400px', margin: '0 auto 25px' }}>
                            {editorial?.error || "The official tutorial for this contest hasn't been found or may not be published yet."}
                        </p>
                        
                        {/* Direct Link */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                            <a
                                href={editorial?.searchUrl || `https://codeforces.com/search?query=${contestId}+tutorial`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '12px 24px',
                                    backgroundColor: '#007acc',
                                    color: '#fff',
                                    textDecoration: 'none',
                                    borderRadius: '6px',
                                    fontWeight: '500'
                                }}
                            >
                                <ExternalLink size={16} />
                                Search on Codeforces
                            </a>
                            
                            <a
                                href={`https://www.youtube.com/results?search_query=codeforces+${contestId}+${problemIndex}+tutorial`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '12px 24px',
                                    backgroundColor: '#c4302b',
                                    color: '#fff',
                                    textDecoration: 'none',
                                    borderRadius: '6px',
                                    fontWeight: '500'
                                }}
                            >
                                🎥 YouTube Tutorials
                            </a>
                        </div>
                        
                        {/* Tips */}
                        <div style={{
                            marginTop: '40px',
                            padding: '20px',
                            backgroundColor: '#2d2d2d',
                            borderRadius: '8px',
                            textAlign: 'left',
                            maxWidth: '500px',
                            margin: '40px auto 0'
                        }}>
                            <h5 style={{ color: '#fff', margin: '0 0 15px 0' }}>💡 Study Tips</h5>
                            <ul style={{ color: '#888', margin: 0, paddingLeft: '20px', lineHeight: 2 }}>
                                <li>Try solving for 30-60 mins before looking at hints</li>
                                <li>Read just the approach first, then try implementing</li>
                                <li>Upsolve problems after contests to learn new techniques</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* Add spinning animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default EditorialPanel;
