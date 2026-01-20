/**
 * Editorial Service
 * Fetches official Codeforces tutorials/editorials
 */

import { API_URL } from '../config';

/**
 * Fetch official Codeforces editorial/tutorial from backend
 */
export const getEditorial = async (contestId, problemIndex) => {
    console.log('[getEditorial] Called with:', { contestId, problemIndex, typeOfContestId: typeof contestId });
    try {
        const url = `${API_URL}/api/problems/codeforces/editorial/${contestId}${problemIndex ? `?problem=${problemIndex}` : ''}`;
        console.log('[getEditorial] Constructed URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok && data.success && data.editorial) {
            return {
                success: true,
                type: 'codeforces',
                title: data.editorial.title,
                content: data.editorial.content,
                problemSection: data.editorial.problemSection || null,
                author: data.editorial.authorHandle,
                url: data.editorial.url,
                blogId: data.editorial.blogId
            };
        }
        
        // Editorial not found
        return {
            success: false,
            error: data.error || 'Editorial not found',
            searchUrl: data.searchUrl || `https://codeforces.com/search?query=${contestId}+tutorial`
        };
        
    } catch (e) {
        console.error('Editorial fetch error:', e);
        return {
            success: false,
            error: 'Failed to fetch editorial',
            searchUrl: `https://codeforces.com/search?query=${contestId}+tutorial`
        };
    }
};

/**
 * Extract code blocks from editorial HTML content
 */
export const extractCodeBlocks = (htmlContent) => {
    if (!htmlContent) return [];

    const codeBlocks = [];
    const seenCode = new Set(); // To avoid duplicates
    
    // Combined regex to match <pre> or standalone <code> blocks
    const combinedRegex = /<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi;
    const stripHtmlRegex = /<[^>]*>/g;

    let match;
    while ((match = combinedRegex.exec(htmlContent)) !== null) {
        const tagName = match[1].toLowerCase();
        let code = match[2];

        // Decode HTML entities and remove nested tags
        code = code.replace(stripHtmlRegex, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
        
        // Skip if code is too short or already processed
        const minLength = tagName === 'pre' ? 20 : 50;
        if (code.length < minLength || seenCode.has(code)) {
            continue;
        }

        // Language detection
        let language = 'cpp'; // Default
        if (code.includes('def ') || code.includes('print(')) {
            language = 'python';
        } else if (code.includes('public static void') || code.includes('System.out')) {
            language = 'java';
        }

        codeBlocks.push({ code, language });
        seenCode.add(code);
    }
    
    return codeBlocks;
};

/**
 * Get direct link to Codeforces editorial
 */
export const getCodeforcesEditorialUrl = (contestId) => {
    return `https://codeforces.com/blog/entry/${contestId}`;
};

export default {
    getEditorial,
    extractCodeBlocks
};
