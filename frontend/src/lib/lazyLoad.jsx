import React, { Suspense, lazy, useState, useEffect } from 'react';

/**
 * Enhanced lazy loading with retry, timeout, and error boundary
 * 
 * @param {Function} importFn - Dynamic import function () => import('./Component')
 * @param {Object} options - Options
 * @param {number} options.retries - Number of retries on failure
 * @param {number} options.retryDelay - Delay between retries in ms
 * @param {number} options.timeout - Timeout in ms (0 = no timeout)
 */
export const lazyWithRetry = (importFn, options = {}) => {
    const {
        retries = 3,
        retryDelay = 1000,
        timeout = 10000,
    } = options;

    return lazy(() => {
        const attempt = async (retriesLeft) => {
            try {
                // Add timeout if specified
                if (timeout > 0) {
                    return await Promise.race([
                        importFn(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Component load timeout')), timeout)
                        ),
                    ]);
                }
                return await importFn();
            } catch (error) {
                if (retriesLeft > 0) {
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return attempt(retriesLeft - 1);
                }
                throw error;
            }
        };

        return attempt(retries);
    });
};

/**
 * Default loading fallback component
 */
export const DefaultLoadingFallback = ({ message = 'Loading...' }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        minHeight: '100px',
        color: '#888',
    }}>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
        }}>
            <div className="spinner" style={{
                width: '24px',
                height: '24px',
                border: '3px solid #333',
                borderTop: '3px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <span>{message}</span>
        </div>
        <style>{`
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `}</style>
    </div>
);

/**
 * Skeleton loader for content
 */
export const SkeletonLoader = ({ 
    width = '100%', 
    height = '20px', 
    borderRadius = '4px',
    count = 1,
    gap = '8px',
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {Array.from({ length: count }).map((_, i) => (
            <div
                key={i}
                style={{
                    width,
                    height,
                    borderRadius,
                    background: 'linear-gradient(90deg, #1e1e1e 25%, #2d2d2d 50%, #1e1e1e 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                }}
            />
        ))}
        <style>{`
            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `}</style>
    </div>
);

/**
 * Error boundary for lazy loaded components
 */
export class LazyErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Lazy component error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#ff6b6b',
                }}>
                    <p>Failed to load component</p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false, error: null });
                            window.location.reload();
                        }}
                        style={{
                            padding: '8px 16px',
                            background: '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginTop: '10px',
                        }}
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Wrapper component for lazy loaded components with error boundary and suspense
 */
export const LazyComponent = ({ 
    component: Component, 
    fallback = <DefaultLoadingFallback />,
    errorFallback,
    ...props 
}) => (
    <LazyErrorBoundary fallback={errorFallback}>
        <Suspense fallback={fallback}>
            <Component {...props} />
        </Suspense>
    </LazyErrorBoundary>
);

/**
 * Preload a lazy component
 * Call this to start loading a component before it's needed
 */
export const preloadComponent = (lazyComponent) => {
    // Trigger the import
    lazyComponent._payload?._result?.();
};

/**
 * Hook for preloading components on hover/focus
 */
export const usePreload = (lazyComponent) => {
    const [preloaded, setPreloaded] = useState(false);

    const preload = () => {
        if (!preloaded) {
            preloadComponent(lazyComponent);
            setPreloaded(true);
        }
    };

    return {
        onMouseEnter: preload,
        onFocus: preload,
    };
};

/**
 * Component that preloads when it enters viewport
 */
export const PreloadOnVisible = ({ component, children }) => {
    const [shouldLoad, setShouldLoad] = useState(false);
    const ref = React.useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    preloadComponent(component);
                    setShouldLoad(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [component]);

    return <div ref={ref}>{children}</div>;
};

export default {
    lazyWithRetry,
    DefaultLoadingFallback,
    SkeletonLoader,
    LazyErrorBoundary,
    LazyComponent,
    preloadComponent,
    usePreload,
    PreloadOnVisible,
};
