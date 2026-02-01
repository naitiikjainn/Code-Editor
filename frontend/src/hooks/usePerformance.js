import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Debounce hook - delays value updates
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns Debounced value
 */
export const useDebounce = (value, delay = 300) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
};

/**
 * Debounced callback hook - debounces function calls
 * @param {Function} callback - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns Debounced function
 */
export const useDebouncedCallback = (callback, delay = 300) => {
    const timeoutRef = useRef(null);
    const callbackRef = useRef(callback);

    // Update callback ref when callback changes
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const debouncedCallback = useCallback((...args) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callbackRef.current(...args);
        }, delay);
    }, [delay]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return debouncedCallback;
};

/**
 * Throttle hook - limits function call frequency
 * @param {Function} callback - Function to throttle
 * @param {number} delay - Minimum delay between calls
 * @returns Throttled function
 */
export const useThrottle = (callback, delay = 100) => {
    const lastCall = useRef(0);
    const timeoutRef = useRef(null);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const throttledCallback = useCallback((...args) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall.current;

        if (timeSinceLastCall >= delay) {
            lastCall.current = now;
            callbackRef.current(...args);
        } else {
            // Schedule call for remaining time
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                lastCall.current = Date.now();
                callbackRef.current(...args);
            }, delay - timeSinceLastCall);
        }
    }, [delay]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return throttledCallback;
};

/**
 * Previous value hook - keeps track of previous value
 * @param {any} value - Value to track
 * @returns Previous value
 */
export const usePrevious = (value) => {
    const ref = useRef();
    
    useEffect(() => {
        ref.current = value;
    }, [value]);
    
    return ref.current;
};

/**
 * Local storage hook with SSR safety
 * @param {string} key - Storage key
 * @param {any} initialValue - Initial value
 * @returns [value, setValue]
 */
export const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
};

/**
 * Intersection observer hook for lazy loading
 * @param {Object} options - IntersectionObserver options
 * @returns [ref, isIntersecting]
 */
export const useIntersectionObserver = (options = {}) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const targetRef = useRef(null);

    useEffect(() => {
        const target = targetRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(([entry]) => {
            setIsIntersecting(entry.isIntersecting);
        }, {
            threshold: 0.1,
            rootMargin: '50px',
            ...options,
        });

        observer.observe(target);

        return () => {
            observer.unobserve(target);
        };
    }, [options.threshold, options.rootMargin]);

    return [targetRef, isIntersecting];
};

/**
 * Window size hook
 * @returns { width, height }
 */
export const useWindowSize = () => {
    const [size, setSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
    });

    useEffect(() => {
        const handleResize = () => {
            setSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return size;
};

/**
 * Media query hook
 * @param {string} query - Media query string
 * @returns boolean
 */
export const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia(query).matches;
        }
        return false;
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const handler = (event) => setMatches(event.matches);

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [query]);

    return matches;
};

/**
 * Memoized filter/sort hook
 * @param {Array} items - Items to filter/sort
 * @param {Object} filters - Filter criteria
 * @param {Function} sortFn - Sort function
 * @returns Filtered and sorted items
 */
export const useFilteredItems = (items, filters, sortFn) => {
    return useMemo(() => {
        if (!items) return [];

        let result = [...items];

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '' && value !== null) {
                result = result.filter(item => {
                    const itemValue = item[key];
                    if (typeof value === 'string') {
                        return String(itemValue).toLowerCase().includes(value.toLowerCase());
                    }
                    return itemValue === value;
                });
            }
        });

        // Apply sort
        if (sortFn) {
            result.sort(sortFn);
        }

        return result;
    }, [items, filters, sortFn]);
};

export default {
    useDebounce,
    useDebouncedCallback,
    useThrottle,
    usePrevious,
    useLocalStorage,
    useIntersectionObserver,
    useWindowSize,
    useMediaQuery,
    useFilteredItems,
};
