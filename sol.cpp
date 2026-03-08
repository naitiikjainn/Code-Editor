#include <bits/stdc++.h>
using namespace std;

int main(){
    int t;
    scanf("%d", &t);
    while(t--){
        int n, k, v;
        scanf("%d %d %d", &n, &k, &v);
        
        vector<vector<int>> adj(n + 1);
        vector<int> deg(n + 1, 0);
        for(int i = 0; i < n - 1; i++){
            int a, b;
            scanf("%d %d", &a, &b);
            adj[a].push_back(b);
            adj[b].push_back(a);
            deg[a]++;
            deg[b]++;
        }
        
        // Root tree at v. For each vertex, compute min distance to a leaf
        // in its subtree using BFS/DFS.
        vector<int> min_leaf(n + 1, INT_MAX);
        vector<int> parent(n + 1, -1);
        
        // BFS from v to set parent pointers
        vector<int> order;
        vector<bool> visited(n + 1, false);
        queue<int> q;
        q.push(v);
        visited[v] = true;
        while(!q.empty()){
            int u = q.front(); q.pop();
            order.push_back(u);
            for(int w : adj[u]){
                if(!visited[w]){
                    visited[w] = true;
                    parent[w] = u;
                    q.push(w);
                }
            }
        }
        
        // Process in reverse BFS order (leaves first)
        for(int i = (int)order.size() - 1; i >= 0; i--){
            int u = order[i];
            if(deg[u] == 1){
                // Leaf
                min_leaf[u] = 0;
            } else {
                // min over children's min_leaf + 1
                min_leaf[u] = INT_MAX;
                for(int w : adj[u]){
                    if(w != parent[u] && min_leaf[w] != INT_MAX){
                        min_leaf[u] = min(min_leaf[u], min_leaf[w] + 1);
                    }
                }
            }
        }
        
        // For each neighbor c of v, val(c) = 1 + min_leaf[c] (in c's subtree)
        // Check if 2nd smallest val ≤ k
        vector<int> vals;
        for(int c : adj[v]){
            // c is a child of v in rooted tree (parent[c] == v)
            vals.push_back(1 + min_leaf[c]);
        }
        sort(vals.begin(), vals.end());
        
        if(vals.size() >= 2 && vals[1] <= k){
            puts("YES");
        } else {
            puts("NO");
        }
    }
    return 0;
}
