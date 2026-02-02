import React, { createContext, useContext, useReducer, useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Create an optimized context with selective subscriptions
 * This prevents unnecessary re-renders by only updating components
 * that actually use the changed state
 */

// App state shape
const initialState = {
    user: null,
    theme: 'dark',
    sidebarOpen: true,
    activeRoom: null,
    notifications: [],
    preferences: {
        fontSize: 14,
        tabSize: 4,
        autoSave: true,
        minimap: true,
        wordWrap: 'on',
    },
};

// Action types
const ActionTypes = {
    SET_USER: 'SET_USER',
    LOGOUT: 'LOGOUT',
    SET_THEME: 'SET_THEME',
    TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
    SET_ACTIVE_ROOM: 'SET_ACTIVE_ROOM',
    ADD_NOTIFICATION: 'ADD_NOTIFICATION',
    REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
    CLEAR_NOTIFICATIONS: 'CLEAR_NOTIFICATIONS',
    UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
    RESET_STATE: 'RESET_STATE',
};

// Reducer
const appReducer = (state, action) => {
    switch (action.type) {
        case ActionTypes.SET_USER:
            return { ...state, user: action.payload };
        
        case ActionTypes.LOGOUT:
            localStorage.removeItem('token');
            return { ...state, user: null, activeRoom: null };
        
        case ActionTypes.SET_THEME:
            localStorage.setItem('theme', action.payload);
            return { ...state, theme: action.payload };
        
        case ActionTypes.TOGGLE_SIDEBAR:
            return { ...state, sidebarOpen: !state.sidebarOpen };
        
        case ActionTypes.SET_ACTIVE_ROOM:
            return { ...state, activeRoom: action.payload };
        
        case ActionTypes.ADD_NOTIFICATION:
            return {
                ...state,
                notifications: [
                    ...state.notifications,
                    { id: Date.now(), ...action.payload },
                ].slice(-10), // Keep last 10 notifications
            };
        
        case ActionTypes.REMOVE_NOTIFICATION:
            return {
                ...state,
                notifications: state.notifications.filter(n => n.id !== action.payload),
            };
        
        case ActionTypes.CLEAR_NOTIFICATIONS:
            return { ...state, notifications: [] };
        
        case ActionTypes.UPDATE_PREFERENCES:
            const newPreferences = { ...state.preferences, ...action.payload };
            localStorage.setItem('preferences', JSON.stringify(newPreferences));
            return { ...state, preferences: newPreferences };
        
        case ActionTypes.RESET_STATE:
            return initialState;
        
        default:
            return state;
    }
};

// Create contexts
const StateContext = createContext(null);
const DispatchContext = createContext(null);
const ActionsContext = createContext(null);

/**
 * Load initial state from localStorage
 */
const loadInitialState = () => {
    const savedPreferences = localStorage.getItem('preferences');
    const savedTheme = localStorage.getItem('theme');
    
    return {
        ...initialState,
        theme: savedTheme || initialState.theme,
        preferences: savedPreferences 
            ? { ...initialState.preferences, ...JSON.parse(savedPreferences) }
            : initialState.preferences,
    };
};

/**
 * App Provider - wraps the app with state management
 */
export const AppProvider = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, null, loadInitialState);

    // Memoize action creators
    const actions = useMemo(() => ({
        setUser: (user) => dispatch({ type: ActionTypes.SET_USER, payload: user }),
        logout: () => dispatch({ type: ActionTypes.LOGOUT }),
        setTheme: (theme) => dispatch({ type: ActionTypes.SET_THEME, payload: theme }),
        toggleSidebar: () => dispatch({ type: ActionTypes.TOGGLE_SIDEBAR }),
        setActiveRoom: (room) => dispatch({ type: ActionTypes.SET_ACTIVE_ROOM, payload: room }),
        addNotification: (notification) => dispatch({ type: ActionTypes.ADD_NOTIFICATION, payload: notification }),
        removeNotification: (id) => dispatch({ type: ActionTypes.REMOVE_NOTIFICATION, payload: id }),
        clearNotifications: () => dispatch({ type: ActionTypes.CLEAR_NOTIFICATIONS }),
        updatePreferences: (prefs) => dispatch({ type: ActionTypes.UPDATE_PREFERENCES, payload: prefs }),
        resetState: () => dispatch({ type: ActionTypes.RESET_STATE }),
    }), []);

    return (
        <StateContext.Provider value={state}>
            <DispatchContext.Provider value={dispatch}>
                <ActionsContext.Provider value={actions}>
                    {children}
                </ActionsContext.Provider>
            </DispatchContext.Provider>
        </StateContext.Provider>
    );
};

/**
 * Hook to get entire state - use sparingly as it subscribes to all changes
 */
export const useAppState = () => {
    const context = useContext(StateContext);
    if (context === null) {
        throw new Error('useAppState must be used within an AppProvider');
    }
    return context;
};

/**
 * Hook to get dispatch function directly
 */
export const useAppDispatch = () => {
    const context = useContext(DispatchContext);
    if (context === null) {
        throw new Error('useAppDispatch must be used within an AppProvider');
    }
    return context;
};

/**
 * Hook to get memoized action creators
 */
export const useAppActions = () => {
    const context = useContext(ActionsContext);
    if (context === null) {
        throw new Error('useAppActions must be used within an AppProvider');
    }
    return context;
};

/**
 * Hook to select specific state slice - prevents re-renders for unrelated changes
 * 
 * @param {Function} selector - Function to select state slice (state) => state.user
 * @param {Function} equalityFn - Optional custom equality function
 */
export const useAppSelector = (selector, equalityFn = Object.is) => {
    const state = useContext(StateContext);
    if (state === null) {
        throw new Error('useAppSelector must be used within an AppProvider');
    }
    
    const selectedRef = useRef(null);
    const selected = selector(state);
    
    // Only return new reference if value actually changed
    if (!equalityFn(selectedRef.current, selected)) {
        selectedRef.current = selected;
    }
    
    return selectedRef.current;
};

/**
 * Convenience hooks for common state slices
 */
export const useUser = () => useAppSelector(state => state.user);
export const useTheme = () => useAppSelector(state => state.theme);
export const useSidebarOpen = () => useAppSelector(state => state.sidebarOpen);
export const useActiveRoom = () => useAppSelector(state => state.activeRoom);
export const useNotifications = () => useAppSelector(state => state.notifications);
export const usePreferences = () => useAppSelector(state => state.preferences);

/**
 * Hook for user authentication state (App-level, use AuthContext's useAuth for actual auth)
 * @deprecated Use useAuth from AuthContext.jsx instead
 */
export const useAppAuth = () => {
    const user = useUser();
    const { setUser, logout } = useAppActions();
    
    const isAuthenticated = useMemo(() => !!user, [user]);
    
    return {
        user,
        isAuthenticated,
        setUser,
        logout,
    };
};

/**
 * Hook for theme management
 */
export const useThemeManager = () => {
    const theme = useTheme();
    const { setTheme } = useAppActions();
    
    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);
    
    const isDark = theme === 'dark';
    
    return {
        theme,
        isDark,
        setTheme,
        toggleTheme,
    };
};

/**
 * Hook for notifications
 */
export const useNotificationManager = () => {
    const notifications = useNotifications();
    const { addNotification, removeNotification, clearNotifications } = useAppActions();
    
    const notify = useCallback((message, type = 'info', duration = 5000) => {
        const id = Date.now();
        addNotification({ message, type });
        
        if (duration > 0) {
            setTimeout(() => removeNotification(id), duration);
        }
        
        return id;
    }, [addNotification, removeNotification]);
    
    return {
        notifications,
        notify,
        success: (msg, duration) => notify(msg, 'success', duration),
        error: (msg, duration) => notify(msg, 'error', duration),
        warning: (msg, duration) => notify(msg, 'warning', duration),
        info: (msg, duration) => notify(msg, 'info', duration),
        remove: removeNotification,
        clear: clearNotifications,
    };
};

export { ActionTypes };
export default AppProvider;
