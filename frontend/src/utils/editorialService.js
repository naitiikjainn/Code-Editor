/**
 * Editorial Service
 * Fetches problem editorials from multiple sources
 */

// Sources for editorials
const EDITORIAL_SOURCES = {
    // Your GitHub repository (will be populated by scraper)
    primary: {
        owner: 'naitiikjainn',
        repo: 'codeforces-problems',
        branch: 'main',
        path: 'editorials'
    },
    // Fallback - direct Codeforces links
    codeforces: 'https://codeforces.com'
};

/**
 * Get editorial URL from your GitHub repository
 */
const getEditorialFromGitHub = async (contestId) => {
    const url = `https://raw.githubusercontent.com/${EDITORIAL_SOURCES.primary.owner}/${EDITORIAL_SOURCES.primary.repo}/${EDITORIAL_SOURCES.primary.branch}/${EDITORIAL_SOURCES.primary.path}/${contestId}.html`;
    
    try {
        const response = await fetch(url);
        if (response.ok) {
            return {
                type: 'html',
                content: await response.text(),
                source: 'github'
            };
        }
    } catch (e) {
        console.log('GitHub editorial not found:', contestId);
    }
    return null;
};

/**
 * Search for editorial on Codeforces blog
 * Returns the blog URL if found
 */
const findCodeforcesEditorial = async (contestId) => {
    // Common patterns for editorial blog entries
    // Usually the editorial is posted shortly after the contest
    
    // Try the contest page to find editorial link
    const contestUrl = `https://codeforces.com/contest/${contestId}`;
    
    return {
        type: 'link',
        url: contestUrl,
        searchUrl: `https://codeforces.com/search?query=editorial+${contestId}`,
        source: 'codeforces'
    };
};

/**
 * Get external editorial sources
 */
export const getExternalSources = (contestId, problemIndex) => {
    return [
        {
            name: 'Codeforces Blog',
            url: `https://codeforces.com/search?query=editorial+${contestId}`,
            icon: '📝'
        },
        {
            name: 'USACO Guide',
            url: `https://usaco.guide/problems/cf-${contestId}${problemIndex}/solution`,
            icon: '📚'
        },
        {
            name: 'CP-Algorithms',
            url: `https://cp-algorithms.com/`,
            icon: '🔢'
        },
        {
            name: 'YouTube Search',
            url: `https://www.youtube.com/results?search_query=codeforces+${contestId}+${problemIndex}+solution`,
            icon: '🎥'
        }
    ];
};

/**
 * Main function to get editorial for a problem
 */
export const getEditorial = async (contestId, problemIndex) => {
    // Try GitHub first
    const githubEditorial = await getEditorialFromGitHub(contestId);
    if (githubEditorial) {
        return {
            ...githubEditorial,
            externalSources: getExternalSources(contestId, problemIndex)
        };
    }
    
    // Return external sources as fallback
    return {
        type: 'external',
        content: null,
        externalSources: getExternalSources(contestId, problemIndex),
        source: 'external'
    };
};

/**
 * Check if editorial exists in GitHub repo
 */
export const hasEditorial = async (contestId) => {
    const url = `https://raw.githubusercontent.com/${EDITORIAL_SOURCES.primary.owner}/${EDITORIAL_SOURCES.primary.repo}/${EDITORIAL_SOURCES.primary.branch}/${EDITORIAL_SOURCES.primary.path}/${contestId}.html`;
    
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (e) {
        return false;
    }
};

export default {
    getEditorial,
    hasEditorial,
    getExternalSources
};
