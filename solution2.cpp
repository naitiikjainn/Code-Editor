#include <iostream>
#include <vector>
#include <numeric>

using namespace std;

void solve() {
    int n;
    cin >> n;
    vector<long long> a(n);
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    vector<long long> b(n);
    for (int i = 0; i < n; i++) {
        cin >> b[i]; // Just reading to consume input
    }
    
    // Calculate GCD for all adjacent pairs
    vector<long long> G(n - 1);
    for (int i = 0; i < n - 1; i++) {
        G[i] = std::gcd(a[i], a[i+1]);
    }
    
    int ans = 0;
    for (int i = 0; i < n; i++) {
        long long L;
        if (i == 0) {
            L = G[0];
        } else if (i == n - 1) {
            L = G[n - 2];
        } else {
            L = std::lcm(G[i - 1], G[i]);
        }
        
        // If LCM of the adjacent GCDs is strictly less than a[i], we can change a[i]
        if (L < a[i]) {
            ans++;
        }
    }
    cout << ans << "\n";
}

int main() {
    // Fast I/O
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
