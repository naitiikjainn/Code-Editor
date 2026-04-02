#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

void solve() {
    int n;
    cin >> n;
    vector<int> p(n + 1);
    vector<int> pos(n + 1);
    for(int i = 1; i <= n; i++){
        cin >> p[i];
        pos[p[i]] = i;
    }
    
    // A[M] stores the number of x < M such that p[x] <= x
    vector<int> A(n + 1, 0);
    int current_A = 0;
    for(int M = 1; M <= n; M++){
        A[M] = current_A;
        if(p[M] <= M){
            current_A++;
        }
    }
    
    // B[M] stores the number of x < M such that p[x] > M
    vector<int> B(n + 1, 0);
    B[1] = 0;
    for(int M = 1; M < n; M++){
        B[M + 1] = B[M] + (p[M] > M + 1 ? 1 : 0) - (pos[M + 1] < M ? 1 : 0);
    }
    
    int ans = 0;
    for(int M = 1; M <= n; M++){
        ans = max(ans, 1 + A[M] + B[M]);
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
