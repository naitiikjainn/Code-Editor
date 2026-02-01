/**
 * Circuit Breaker implementation for external API calls
 * Prevents cascading failures when external services are down
 */

class CircuitBreaker {
    constructor(options = {}) {
        this.name = options.name || "default";
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 2;
        this.timeout = options.timeout || 10000; // 10 seconds
        this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
        
        this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.nextAttempt = null;
    }

    async execute(fn) {
        if (this.state === "OPEN") {
            if (Date.now() >= this.nextAttempt) {
                this.state = "HALF_OPEN";
                console.log(`🔄 Circuit [${this.name}]: HALF_OPEN - attempting recovery`);
            } else {
                throw new Error(`Circuit breaker [${this.name}] is OPEN. Retry after ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s`);
            }
        }

        try {
            const result = await Promise.race([
                fn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Timeout")), this.timeout)
                )
            ]);

            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failures = 0;
        
        if (this.state === "HALF_OPEN") {
            this.successes++;
            if (this.successes >= this.successThreshold) {
                this.state = "CLOSED";
                this.successes = 0;
                console.log(`✅ Circuit [${this.name}]: CLOSED - service recovered`);
            }
        }
    }

    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        
        if (this.state === "HALF_OPEN") {
            this.state = "OPEN";
            this.nextAttempt = Date.now() + this.resetTimeout;
            this.successes = 0;
            console.log(`🔴 Circuit [${this.name}]: OPEN - recovery failed`);
        } else if (this.failures >= this.failureThreshold) {
            this.state = "OPEN";
            this.nextAttempt = Date.now() + this.resetTimeout;
            console.log(`🔴 Circuit [${this.name}]: OPEN - too many failures (${this.failures})`);
        }
    }

    getState() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailureTime: this.lastFailureTime,
            nextAttempt: this.nextAttempt
        };
    }

    reset() {
        this.state = "CLOSED";
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.nextAttempt = null;
    }
}

// Circuit breakers for external services
const circuits = {
    codeforces: new CircuitBreaker({
        name: "codeforces",
        failureThreshold: 3,
        timeout: 15000,
        resetTimeout: 60000
    }),
    leetcode: new CircuitBreaker({
        name: "leetcode",
        failureThreshold: 3,
        timeout: 15000,
        resetTimeout: 60000
    }),
    codechef: new CircuitBreaker({
        name: "codechef",
        failureThreshold: 3,
        timeout: 15000,
        resetTimeout: 60000
    }),
    gemini: new CircuitBreaker({
        name: "gemini",
        failureThreshold: 5,
        timeout: 30000,
        resetTimeout: 120000
    }),
    github: new CircuitBreaker({
        name: "github",
        failureThreshold: 3,
        timeout: 10000,
        resetTimeout: 60000
    })
};

/**
 * Get or create a circuit breaker
 */
export const getCircuit = (name) => {
    if (!circuits[name]) {
        circuits[name] = new CircuitBreaker({ name });
    }
    return circuits[name];
};

/**
 * Execute function with circuit breaker protection
 */
export const withCircuitBreaker = async (name, fn, fallback = null) => {
    const circuit = getCircuit(name);
    
    try {
        return await circuit.execute(fn);
    } catch (error) {
        if (fallback !== null) {
            console.log(`⚡ Circuit [${name}]: Using fallback due to: ${error.message}`);
            return typeof fallback === "function" ? fallback(error) : fallback;
        }
        throw error;
    }
};

/**
 * Get all circuit states for monitoring
 */
export const getAllCircuitStates = () => {
    const states = {};
    for (const [name, circuit] of Object.entries(circuits)) {
        states[name] = circuit.getState();
    }
    return states;
};

/**
 * Reset a specific circuit
 */
export const resetCircuit = (name) => {
    if (circuits[name]) {
        circuits[name].reset();
        return true;
    }
    return false;
};

/**
 * Middleware to expose circuit breaker status
 */
export const circuitBreakerStatus = () => {
    return (req, res, next) => {
        req.circuitBreakers = getAllCircuitStates();
        next();
    };
};

/**
 * Fetch with circuit breaker wrapper
 */
export const fetchWithCircuitBreaker = async (circuitName, url, options = {}) => {
    return withCircuitBreaker(circuitName, async () => {
        const controller = new AbortController();
        const timeout = options.timeout || 10000;
        
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    });
};

export default { 
    CircuitBreaker, 
    getCircuit, 
    withCircuitBreaker, 
    getAllCircuitStates, 
    resetCircuit,
    circuitBreakerStatus,
    fetchWithCircuitBreaker
};
