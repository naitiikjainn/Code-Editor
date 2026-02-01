import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Helper for API calls with error handling
const fetchApi = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || error.error || 'Request failed');
    }
    
    return response.json();
};

// ========== PROBLEM HOOKS ==========

/**
 * Fetch Codeforces problem
 */
export const useCodeforcesProblem = (problemId, options = {}) => {
    return useQuery({
        queryKey: queryKeys.problems.codeforces(problemId),
        queryFn: () => fetchApi(`/api/problems/codeforces/${problemId}`),
        enabled: !!problemId,
        staleTime: 10 * 60 * 1000, // 10 minutes
        ...options,
    });
};

/**
 * Fetch LeetCode problem
 */
export const useLeetcodeProblem = (titleSlug, options = {}) => {
    return useQuery({
        queryKey: queryKeys.problems.leetcode(titleSlug),
        queryFn: () => fetchApi(`/api/problems/leetcode/${titleSlug}`),
        enabled: !!titleSlug,
        staleTime: 10 * 60 * 1000,
        ...options,
    });
};

/**
 * Fetch LeetCode problem list with filters
 */
export const useLeetcodeList = (filters = {}, options = {}) => {
    const { difficulty, tag, search, skip = 0, limit = 50 } = filters;
    
    const queryString = new URLSearchParams({
        ...(difficulty && { difficulty }),
        ...(tag && { tag }),
        ...(search && { search }),
        skip: String(skip),
        limit: String(limit),
    }).toString();
    
    return useQuery({
        queryKey: queryKeys.problems.leetcodeList(filters),
        queryFn: () => fetchApi(`/api/problems/leetcode/list?${queryString}`),
        staleTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData, // Keep old data while loading
        ...options,
    });
};

/**
 * Fetch LeetCode tags
 */
export const useLeetcodeTags = (options = {}) => {
    return useQuery({
        queryKey: ['leetcode', 'tags'],
        queryFn: () => fetchApi('/api/problems/leetcode/tags'),
        staleTime: 60 * 60 * 1000, // 1 hour - tags rarely change
        ...options,
    });
};

// ========== USER HOOKS ==========

/**
 * Fetch user profile
 */
export const useUserProfile = (username, options = {}) => {
    return useQuery({
        queryKey: queryKeys.user.profile(username),
        queryFn: () => fetchApi(`/api/profile/${username}`),
        enabled: !!username,
        staleTime: 5 * 60 * 1000,
        ...options,
    });
};

/**
 * Fetch user submissions
 */
export const useUserSubmissions = (userId, filters = {}, options = {}) => {
    const { platform, page = 1, limit = 20 } = filters;
    
    const queryString = new URLSearchParams({
        ...(platform && { platform }),
        page: String(page),
        limit: String(limit),
    }).toString();
    
    return useQuery({
        queryKey: queryKeys.user.submissions(userId, filters),
        queryFn: () => fetchApi(`/api/submissions/user/${userId}?${queryString}`),
        enabled: !!userId,
        staleTime: 2 * 60 * 1000,
        ...options,
    });
};

/**
 * Fetch user files
 */
export const useUserFiles = (userId, options = {}) => {
    return useQuery({
        queryKey: queryKeys.user.files(userId),
        queryFn: () => fetchApi('/api/files'),
        enabled: !!userId,
        staleTime: 60 * 1000, // 1 minute - files change frequently
        ...options,
    });
};

// ========== EXTERNAL API HOOKS ==========

/**
 * Fetch Codeforces user info
 */
export const useCodeforcesUser = (handle, options = {}) => {
    return useQuery({
        queryKey: queryKeys.external.codeforcesUser(handle),
        queryFn: () => fetchApi(`/api/proxy/codeforces/user/info/${handle}`),
        enabled: !!handle,
        staleTime: 5 * 60 * 1000,
        retry: 1,
        ...options,
    });
};

/**
 * Fetch Codeforces user rating history
 */
export const useCodeforcesRating = (handle, options = {}) => {
    return useQuery({
        queryKey: queryKeys.external.codeforcesRating(handle),
        queryFn: () => fetchApi(`/api/proxy/codeforces/user/rating/${handle}`),
        enabled: !!handle,
        staleTime: 10 * 60 * 1000,
        retry: 1,
        ...options,
    });
};

/**
 * Fetch LeetCode user stats
 */
export const useLeetcodeUser = (username, options = {}) => {
    return useQuery({
        queryKey: queryKeys.external.leetcodeUser(username),
        queryFn: () => fetchApi(`/api/proxy/leetcode/${username}`),
        enabled: !!username,
        staleTime: 10 * 60 * 1000,
        retry: 1,
        ...options,
    });
};

/**
 * Fetch CodeChef user stats
 */
export const useCodechefUser = (handle, options = {}) => {
    return useQuery({
        queryKey: queryKeys.external.codechefUser(handle),
        queryFn: () => fetchApi(`/api/proxy/codechef/${handle}`),
        enabled: !!handle,
        staleTime: 10 * 60 * 1000,
        retry: 1,
        ...options,
    });
};

// ========== MUTATION HOOKS ==========

/**
 * Submit code mutation
 */
export const useSubmitCode = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: (data) => fetchApi('/api/submissions', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        onSuccess: (_, variables) => {
            // Invalidate user submissions cache
            queryClient.invalidateQueries({ 
                queryKey: ['user', 'submissions'] 
            });
        },
    });
};

/**
 * Create/update file mutation
 */
export const useSaveFile = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ fileId, data }) => {
            const url = fileId ? `/api/files/${fileId}` : '/api/files';
            const method = fileId ? 'PUT' : 'POST';
            return fetchApi(url, { method, body: JSON.stringify(data) });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user', 'files'] });
        },
    });
};

/**
 * Delete file mutation
 */
export const useDeleteFile = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: (fileId) => fetchApi(`/api/files/${fileId}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user', 'files'] });
        },
    });
};

/**
 * AI chat mutation
 */
export const useAiChat = () => {
    return useMutation({
        mutationFn: (data) => fetchApi('/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    });
};

// ========== UTILITY HOOKS ==========

/**
 * Prefetch problem on hover
 */
export const usePrefetchProblem = () => {
    const queryClient = useQueryClient();
    
    return (platform, id) => {
        const queryKey = platform === 'leetcode'
            ? queryKeys.problems.leetcode(id)
            : queryKeys.problems.codeforces(id);
        
        const url = platform === 'leetcode'
            ? `/api/problems/leetcode/${id}`
            : `/api/problems/codeforces/${id}`;
        
        queryClient.prefetchQuery({
            queryKey,
            queryFn: () => fetchApi(url),
            staleTime: 10 * 60 * 1000,
        });
    };
};

export default {
    useCodeforcesProblem,
    useLeetcodeProblem,
    useLeetcodeList,
    useLeetcodeTags,
    useUserProfile,
    useUserSubmissions,
    useUserFiles,
    useCodeforcesUser,
    useCodeforcesRating,
    useLeetcodeUser,
    useCodechefUser,
    useSubmitCode,
    useSaveFile,
    useDeleteFile,
    useAiChat,
    usePrefetchProblem,
};
