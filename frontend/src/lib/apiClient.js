/**
 * API Client - Centralized HTTP client with retry, timeout, and error handling
 */

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '/api';

// Request timeout in milliseconds
const DEFAULT_TIMEOUT = 30000;

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000,
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
    constructor(message, status, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create abort controller with timeout
 */
const createTimeoutController = (timeout) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return { controller, timeoutId };
};

/**
 * Get authentication token
 */
const getAuthToken = () => {
    return localStorage.getItem('token');
};

/**
 * Build URL with query parameters
 */
const buildUrl = (endpoint, params = {}) => {
    const url = new URL(endpoint, window.location.origin);
    
    // If it's a relative URL, prepend the base
    const fullUrl = endpoint.startsWith('http') 
        ? endpoint 
        : `${API_BASE_URL}${endpoint}`;
    
    const urlObj = new URL(fullUrl, window.location.origin);
    
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            urlObj.searchParams.append(key, String(value));
        }
    });
    
    return urlObj.toString();
};

/**
 * Main fetch wrapper with retry and error handling
 */
const fetchWithRetry = async (url, options = {}, retries = 0) => {
    const {
        timeout = DEFAULT_TIMEOUT,
        ...fetchOptions
    } = options;

    const { controller, timeoutId } = createTimeoutController(timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle retry for specific status codes
        if (RETRY_CONFIG.retryStatusCodes.includes(response.status) && retries < RETRY_CONFIG.maxRetries) {
            const delay = RETRY_CONFIG.retryDelay * Math.pow(2, retries); // Exponential backoff
            await sleep(delay);
            return fetchWithRetry(url, options, retries + 1);
        }

        // Handle non-OK responses
        if (!response.ok) {
            let errorData = null;
            try {
                errorData = await response.json();
            } catch {
                // Response might not be JSON
            }
            throw new ApiError(
                errorData?.message || errorData?.error || `Request failed with status ${response.status}`,
                response.status,
                errorData
            );
        }

        return response;
    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new ApiError('Request timeout', 408);
        }

        // Retry on network errors
        if (error.name === 'TypeError' && retries < RETRY_CONFIG.maxRetries) {
            const delay = RETRY_CONFIG.retryDelay * Math.pow(2, retries);
            await sleep(delay);
            return fetchWithRetry(url, options, retries + 1);
        }

        throw error;
    }
};

/**
 * Main API client
 */
export const apiClient = {
    /**
     * GET request
     */
    async get(endpoint, params = {}, options = {}) {
        const url = buildUrl(endpoint, params);
        const token = getAuthToken();

        const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
            ...options,
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    },

    /**
     * POST request
     */
    async post(endpoint, data = {}, options = {}) {
        const url = buildUrl(endpoint);
        const token = getAuthToken();

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
            body: JSON.stringify(data),
            ...options,
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    },

    /**
     * PUT request
     */
    async put(endpoint, data = {}, options = {}) {
        const url = buildUrl(endpoint);
        const token = getAuthToken();

        const response = await fetchWithRetry(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
            body: JSON.stringify(data),
            ...options,
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    },

    /**
     * PATCH request
     */
    async patch(endpoint, data = {}, options = {}) {
        const url = buildUrl(endpoint);
        const token = getAuthToken();

        const response = await fetchWithRetry(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
            body: JSON.stringify(data),
            ...options,
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    },

    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        const url = buildUrl(endpoint);
        const token = getAuthToken();

        const response = await fetchWithRetry(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
            ...options,
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    },

    /**
     * Upload file(s)
     */
    async upload(endpoint, formData, options = {}) {
        const url = buildUrl(endpoint);
        const token = getAuthToken();

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
                // Don't set Content-Type - browser will set it with boundary
                ...options.headers,
            },
            body: formData,
            ...options,
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    },

    /**
     * Stream response (for AI chat)
     */
    async stream(endpoint, data = {}, onChunk, options = {}) {
        const url = buildUrl(endpoint);
        const token = getAuthToken();

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new ApiError(`Stream request failed with status ${response.status}`, response.status);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.trim()) {
                        onChunk(line);
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.trim()) {
                onChunk(buffer);
            }
        } finally {
            reader.releaseLock();
        }
    },
};

/**
 * Convenience functions for common endpoints
 */
export const api = {
    // Auth
    auth: {
        login: (credentials) => apiClient.post('/auth/login', credentials),
        register: (data) => apiClient.post('/auth/register', data),
        profile: () => apiClient.get('/auth/profile'),
        updateProfile: (data) => apiClient.put('/auth/profile', data),
    },

    // Problems
    problems: {
        getCf: (contestId, problemId) => apiClient.get(`/problems/cf/${contestId}/${problemId}`),
        getLc: (slug) => apiClient.get(`/problems/lc/${slug}`),
        lcList: (params) => apiClient.get('/leetcode/problems', params),
        lcTags: () => apiClient.get('/leetcode/tags'),
    },

    // Files
    files: {
        list: () => apiClient.get('/files'),
        get: (id) => apiClient.get(`/files/${id}`),
        create: (data) => apiClient.post('/files', data),
        update: (id, data) => apiClient.put(`/files/${id}`, data),
        delete: (id) => apiClient.delete(`/files/${id}`),
    },

    // Rooms
    rooms: {
        list: () => apiClient.get('/rooms'),
        get: (id) => apiClient.get(`/rooms/${id}`),
        create: (data) => apiClient.post('/rooms', data),
        join: (id) => apiClient.post(`/rooms/${id}/join`),
        leave: (id) => apiClient.post(`/rooms/${id}/leave`),
    },

    // Code execution
    code: {
        submit: (data) => apiClient.post('/code/submit', data),
        run: (data) => apiClient.post('/code/run', data),
    },

    // AI
    ai: {
        chat: (data, onChunk) => apiClient.stream('/ai/chat', data, onChunk),
        analyze: (data) => apiClient.post('/ai/analyze', data),
    },

    // External profiles
    external: {
        codeforces: (handle) => apiClient.get(`/profile/codeforces/${handle}`),
        codeforcesRating: (handle) => apiClient.get(`/profile/codeforces/${handle}/rating`),
        leetcode: (username) => apiClient.get(`/profile/leetcode/${username}`),
        codechef: (username) => apiClient.get(`/profile/codechef/${username}`),
    },

    // Submissions
    submissions: {
        list: (params) => apiClient.get('/submissions', params),
        get: (id) => apiClient.get(`/submissions/${id}`),
    },
};

export default apiClient;
