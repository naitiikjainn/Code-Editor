#include <bits/stdc++.h>
using namespace std;

int main() {
    int t;
    cin >> t;

    while (t--) {
        int n;
        cin >> n;

        // Query the k-th path, return the path (empty if doesn't exist)
        auto query = [&](long long k) -> vector<int> {
            cout << "? " << k << "\n";
            cout.flush();
            int q;
            cin >> q;
            if (q == -1) exit(0);
            vector<int> path(q);
            for (int i = 0; i < q; i++) cin >> path[i];
            return path;
        };

        // Step 1: Find total number of paths T using binary search
        // For a DAG on n vertices, T <= 2^n - 1
        long long lo = n, hi = (1LL << n);
        while (lo < hi) {
            long long mid = lo + (hi - lo + 1) / 2;
            auto res = query(mid);
            if (res.empty()) hi = mid - 1;
            else lo = mid;
        }
        long long T = lo;

        // Step 2: Find P[v] = number of paths starting from vertex v
        // O[v] = cumulative offset = P[1] + P[2] + ... + P[v-1]
        // Paths starting with v occupy positions O[v]+1 to O[v]+P[v]
        // Binary search for the last position whose path starts with v
        vector<long long> P(n + 1, 0);
        vector<long long> O(n + 1, 0);

        for (int v = 1; v < n; v++) {
            long long lo2 = O[v] + 1;
            long long hi2 = T - (n - v); // vertices v+1..n each need at least 1 path
            while (lo2 < hi2) {
                long long mid = lo2 + (hi2 - lo2 + 1) / 2;
                auto res = query(mid);
                if (!res.empty() && res[0] == v) lo2 = mid;
                else hi2 = mid - 1;
            }
            P[v] = lo2 - O[v];
            O[v + 1] = O[v] + P[v];
        }
        P[n] = T - O[n];

        // Step 3: Find edges
        // For vertex v, paths [v, w, ...] for neighbor w occupy P[w] consecutive positions
        // So query O[v]+2 to find first neighbor, skip P[w] to find next, etc.
        vector<pair<int, int>> edges;

        for (int v = 1; v <= n; v++) {
            if (P[v] <= 1) continue; // no outgoing edges
            long long pos = O[v] + 2;
            while (pos <= O[v] + P[v]) {
                auto res = query(pos);
                int w = res[1];
                edges.push_back({v, w});
                pos += P[w];
            }
        }

        // Output answer
        cout << "! " << edges.size() << "\n";
        for (auto& [u, v] : edges) {
            cout << u << " " << v << "\n";
        }
        cout.flush();
    }

    return 0;
}
