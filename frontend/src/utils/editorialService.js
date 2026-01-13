/**
 * Editorial Service
 * Fetches official Codeforces tutorials/editorials
 */

import { API_URL } from '../config';

/**
 * Fetch official Codeforces editorial/tutorial from backend
 */
export const getEditorial = async (contestId, problemIndex) => {
    try {
        const url = `${API_URL}/api/problems/codeforces/editorial/${contestId}${problemIndex ? `?problem=${problemIndex}` : ''}`;
        
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
    
    // Match <pre> or <code> blocks
    const preRegex = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
    const codeRegex = /<code[^>]*>([\s\S]*?)<\/code>/gi;
    
    let match;
    
    // Extract from <pre> tags
    while ((match = preRegex.exec(htmlContent)) !== null) {
        const code = match[1]
            .replace(/<[^>]*>/g, '') // Remove nested HTML tags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
        
        if (code.length > 20) { // Only include substantial code blocks
            // Try to detect language
            let language = 'cpp'; // Default
            if (code.includes('def ') || code.includes('print(')) language = 'python';
            else if (code.includes('public static void') || code.includes('System.out')) language = 'java';
            
            codeBlocks.push({ code, language });
        }
    }
    
    // Extract from standalone <code> tags (if not already in <pre>)
    while ((match = codeRegex.exec(htmlContent)) !== null) {
        const code = match[1]
            .replace(/<[^>]*>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .trim();
        
        if (code.length > 50 && !codeBlocks.some(b => b.code.includes(code.slice(0, 30)))) {
            let language = 'cpp';
            if (code.includes('def ') || code.includes('print(')) language = 'python';
            codeBlocks.push({ code, language });
        }
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
