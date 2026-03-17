#include <cstdio>
#include <cstdlib>
#include <vector>
#include <algorithm>
using namespace std;
int main(){
    srand(777);
    // Generate 5000 tests with N up to 6
    for(int t=0;t<5000;t++){
        int N = 1 + rand() % 6;
        vector<int> A;
        for(int v=1;v<=N;v++){A.push_back(v);A.push_back(v);}
        for(int i=2*N-1;i>0;i--){int j=rand()%(i+1);swap(A[i],A[j]);}
        printf("1\n%d\n",N);
        for(int i=0;i<2*N;i++) printf("%d%c",A[i]," \n"[i==2*N-1]);
    }
}
