import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client with optimized defaults
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Stale time - how long data is considered fresh (5 minutes)
            staleTime: 5 * 60 * 1000,
            
            // Cache time - how long inactive data stays in cache (30 minutes)
            gcTime: 30 * 60 * 1000,
            
            // Retry configuration
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            
            // Refetch settings
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            
            // Network mode
            networkMode: 'offlineFirst',
        },
        mutations: {
            // Retry mutations once on failure
            retry: 1,
            
            // Network mode for mutations
            networkMode: 'online',
        },
    },
});

// Query key factory for consistent cache keys
export const queryKeys = {
    // Problems
    problems: {
        all: ['problems'],
        codeforces: (id) => ['problems', 'codeforces', id],
        leetcode: (slug) => ['problems', 'leetcode', slug],
        leetcodeList: (filters) => ['problems', 'leetcode', 'list', filters],
        search: (query) => ['problems', 'search', query],
    },
    
    // User
    user: {
        all: ['user'],
        profile: (username) => ['user', 'profile', username],
        submissions: (userId, filters) => ['user', 'submissions', userId, filters],
        files: (userId) => ['user', 'files', userId],
    },
    
    // Rooms
    rooms: {
        all: ['rooms'],
        detail: (roomId) => ['rooms', roomId],
    },
    
    // External APIs
    external: {
        codeforcesUser: (handle) => ['external', 'codeforces', 'user', handle],
        codeforcesRating: (handle) => ['external', 'codeforces', 'rating', handle],
        leetcodeUser: (username) => ['external', 'leetcode', 'user', username],
        codechefUser: (handle) => ['external', 'codechef', 'user', handle],
    },
};

// Cache invalidation helpers
export const invalidateProblems = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.problems.all });
};

export const invalidateUser = (userId) => {
    queryClient.invalidateQueries({ queryKey: ['user', userId] });
};

export const invalidateRooms = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
};

// Prefetch helpers
export const prefetchProblem = async (platform, id) => {
    const key = platform === 'leetcode' 
        ? queryKeys.problems.leetcode(id)
        : queryKeys.problems.codeforces(id);
    
    await queryClient.prefetchQuery({
        queryKey: key,
        staleTime: 10 * 60 * 1000, // 10 minutes for prefetch
    });
};

// Provider component
export { QueryClientProvider };
export default queryClient;
