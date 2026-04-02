#include <iostream>
#include <vector>
#include <numeric>
#include <algorithm>

using namespace std;

// Each candidate represents a potential value we can assign to a[i].
struct Cand {
    long long value;
    int cost;  // 1 if we changed the element (value != a[i]), else 0
    int prime; // If we used a prime multiplier (k*L_i), store the prime 'k'. Otherwise 0.
};

// First 25 primes. It's mathematically proven we'll never need a prime larger 
// than this to find a coprime multiplier since a 64-bit int has at most ~15 prime factors.
int P[] = {2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97};

void solve() {
    int n;
    if (!(cin >> n)) return;
    
    vector<long long> a(n), b(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    for (int i = 0; i < n; i++) cin >> b[i];
    
    // Array with only 1 element has no lengths >= 2, so any valid change is allowed
    if (n == 1) { 
        if (b[0] >= 1 && (b[0] > 1 || a[0] != 1)) {
            if (a[0] == 1 && b[0] == 1) cout << 0 << "\n";
            else cout << 1 << "\n";
        } else {
            cout << 0 << "\n";
        }
        return;
    }
    
    vector<long long> G(n - 1);
    for (int i = 0; i < n - 1; i++) {
        G[i] = std::gcd(a[i], a[i+1]);
    }
    
    vector<long long> L(n);
    for (int i = 0; i < n; i++) {
        if (i == 0) L[i] = G[0];
        else if (i == n - 1) L[i] = G[n - 2];
        else L[i] = std::lcm(G[i - 1], G[i]);
    }
    
    // Build valid candidate states C[i] for each position
    vector<vector<Cand>> C(n);
    for (int i = 0; i < n; i++) {
        // Option 1: Do not change (cost = 0)
        C[i].push_back({a[i], 0, 0});
        
        // Option 2: Set to L_i (safe to change, cost = 1)
        if (L[i] != a[i] && L[i] <= b[i]) {
            C[i].push_back({L[i], 1, 0});
        }
        
        // Option 3: If L_i == a[i], we cannot use L_i. We must search for larger multiples. (cost = 1)
        // Check prime multipliers up to b_i.
        if (L[i] == a[i]) {
            for (int p : P) {
                if (p * L[i] <= b[i]) {
                    C[i].push_back({p * L[i], 1, p});
                }
            }
        }
    }
    
    // dp[j] stores the max changes up to the current prefix ending with candidate j
    vector<int> dp(C[0].size());
    for (size_t j = 0; j < C[0].size(); j++) {
        dp[j] = C[0][j].cost;
    }
    
    // Run DP over candidates
    for (int i = 1; i < n; i++) {
        vector<int> next_dp(C[i].size(), -1); // -1 means unreachable
        long long cur_G = G[i - 1]; 
        
        for (size_t j = 0; j < C[i].size(); j++) {
            long long v = C[i][j].value / cur_G;
            int p_curr = C[i][j].prime;
            
            for (size_t k = 0; k < C[i - 1].size(); k++) {
                if (dp[k] == -1) continue;
                
                long long u = C[i - 1][k].value / cur_G;
                bool valid = false;
                
                // If the current is a prime multiplier, we can optimize the check 
                // heavily: it's perfectly coprime to u if `p * L_i` doesn't share factors with u.
                // Since L_i and u are already coprime by design, we just need `u % p != 0`.
                if (p_curr > 0) {
                    if (u % p_curr != 0) valid = true;
                } else {
                    if (std::gcd(u, v) == 1) valid = true;
                }
                
                if (valid) {
                    next_dp[j] = max(next_dp[j], dp[k] + C[i][j].cost);
                }
            }
        }
        dp = next_dp;
    }
    
    // Answer is the max across all valid states on the last element
    int ans = 0;
    for (size_t j = 0; j < C[n - 1].size(); j++) {
        ans = max(ans, dp[j]);
    }
    cout << ans << "\n";
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int t;
    if (cin >> t) {
        while (t--) {
            solve();
        }
    }
    return 0;
}
