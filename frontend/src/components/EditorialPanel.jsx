import React, { useState, useEffect } from 'react';
import { getEditorial, getExternalSources } from '../utils/editorialService';

const EditorialPanel = ({ contestId, problemIndex, problemName, onClose }) => {
    const [editorial, setEditorial] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('editorial'); // 'editorial' or 'resources'

    useEffect(() => {
        const fetchEditorial = async () => {
            setLoading(true);
            try {
                const result = await getEditorial(contestId, problemIndex);
                setEditorial(result);
            } catch (e) {
                console.error('Error fetching editorial:', e);
                setEditorial({
                    type: 'external',
                    externalSources: getExternalSources(contestId, problemIndex)
                });
            }
            setLoading(false);
        };
        
        if (contestId) {
            fetchEditorial();
        }
    }, [contestId, problemIndex]);

    const externalSources = editorial?.externalSources || getExternalSources(contestId, problemIndex);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '50%',
            height: '100vh',
            backgroundColor: '#1e1e1e',
            borderLeft: '1px solid #333',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-5px 0 20px rgba(0,0,0,0.5)'
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
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>
                        📚 Editorial - {contestId}{problemIndex}
                    </h3>
                    {problemName && (
                        <span style={{ color: '#888', fontSize: '12px' }}>{problemName}</span>
                    )}
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#888',
                        fontSize: '24px',
                        cursor: 'pointer',
                        padding: '0 10px'
                    }}
                >
                    ×
                </button>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid #333',
                backgroundColor: '#252526'
            }}>
                <button
                    onClick={() => setActiveTab('editorial')}
                    style={{
                        padding: '10px 20px',
                        background: activeTab === 'editorial' ? '#1e1e1e' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'editorial' ? '2px solid #007acc' : '2px solid transparent',
                        color: activeTab === 'editorial' ? '#fff' : '#888',
                        cursor: 'pointer'
                    }}
                >
                    Editorial
                </button>
                <button
                    onClick={() => setActiveTab('resources')}
                    style={{
                        padding: '10px 20px',
                        background: activeTab === 'resources' ? '#1e1e1e' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'resources' ? '2px solid #007acc' : '2px solid transparent',
                        color: activeTab === 'resources' ? '#fff' : '#888',
                        cursor: 'pointer'
                    }}
                >
                    Resources
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {loading ? (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '200px',
                        color: '#888'
                    }}>
                        <div>Loading editorial...</div>
                    </div>
                ) : activeTab === 'editorial' ? (
                    editorial?.type === 'html' && editorial?.content ? (
                        <div 
                            style={{ 
                                padding: '20px',
                                color: '#d4d4d4',
                                lineHeight: 1.6
                            }}
                            dangerouslySetInnerHTML={{ 
                                __html: editorial.content 
                            }}
                        />
                    ) : (
                        <div style={{ padding: '30px', textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📝</div>
                            <h3 style={{ color: '#fff', marginBottom: '10px' }}>
                                Editorial Not Yet Scraped
                            </h3>
                            <p style={{ color: '#888', marginBottom: '20px' }}>
                                The editorial for this problem hasn't been scraped yet. 
                                Check the external resources below!
                            </p>
                            
                            {/* Quick Links */}
                            <div style={{ marginTop: '20px' }}>
                                <a
                                    href={`https://codeforces.com/contest/${contestId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-block',
                                        padding: '12px 24px',
                                        backgroundColor: '#007acc',
                                        color: '#fff',
                                        textDecoration: 'none',
                                        borderRadius: '4px',
                                        marginRight: '10px'
                                    }}
                                >
                                    View on Codeforces
                                </a>
                                <a
                                    href={`https://www.youtube.com/results?search_query=codeforces+${contestId}+${problemIndex}+solution`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-block',
                                        padding: '12px 24px',
                                        backgroundColor: '#c4302b',
                                        color: '#fff',
                                        textDecoration: 'none',
                                        borderRadius: '4px'
                                    }}
                                >
                                    🎥 YouTube Solutions
                                </a>
                            </div>
                        </div>
                    )
                ) : (
                    /* Resources Tab */
                    <div style={{ padding: '20px' }}>
                        <h4 style={{ color: '#fff', marginBottom: '15px' }}>
                            External Resources
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {externalSources.map((source, idx) => (
                                <a
                                    key={idx}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '15px',
                                        backgroundColor: '#2d2d2d',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        color: '#d4d4d4',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                                >
                                    <span style={{ fontSize: '24px', marginRight: '15px' }}>
                                        {source.icon}
                                    </span>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{source.name}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>
                                            Click to search for solutions
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>

                        {/* Tips Section */}
                        <div style={{
                            marginTop: '30px',
                            padding: '15px',
                            backgroundColor: '#2d2d2d',
                            borderRadius: '8px',
                            borderLeft: '3px solid #007acc'
                        }}>
                            <h5 style={{ color: '#fff', margin: '0 0 10px 0' }}>💡 Tips</h5>
                            <ul style={{ color: '#888', margin: 0, paddingLeft: '20px', lineHeight: 1.8 }}>
                                <li>Try solving the problem yourself first for 30-60 minutes</li>
                                <li>If stuck, read just the approach/hint, not the full solution</li>
                                <li>After reading editorial, implement without looking at code</li>
                                <li>Upsolve problems after contests to learn new techniques</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditorialPanel;
