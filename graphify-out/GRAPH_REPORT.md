# Graph Report - C:\Users\artemis\Documents\code\manav-rachna-iccf  (2026-05-02)

## Corpus Check
- 8 files · ~6,591 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 33 nodes · 48 edges · 9 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `Logger` - 9 edges
2. `handleFirestoreError()` - 5 edges
3. `ErrorBoundary` - 4 edges
4. `handleSeedData()` - 3 edges
5. `handleLogin()` - 3 edges
6. `handleLogout()` - 3 edges
7. `fetchQuestions()` - 3 edges
8. `handleSubmit()` - 3 edges
9. `handleVisibilityChange()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.48
Nodes (1): Logger

### Community 1 - "Community 1"
Cohesion: 0.33
Nodes (1): handleVisibilityChange()

### Community 2 - "Community 2"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 3 - "Community 3"
Cohesion: 0.5
Nodes (4): fetchQuestions(), handleFirestoreError(), handleSeedData(), handleSubmit()

### Community 4 - "Community 4"
Cohesion: 0.67
Nodes (2): handleLogin(), handleLogout()

### Community 5 - "Community 5"
Cohesion: 1.0
Nodes (0): 

### Community 6 - "Community 6"
Cohesion: 1.0
Nodes (0): 

### Community 7 - "Community 7"
Cohesion: 1.0
Nodes (0): 

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 5`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (1 nodes): `firebase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Logger` connect `Community 0` to `Community 3`, `Community 4`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `handleFirestoreError()` connect `Community 3` to `Community 1`, `Community 4`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `handleLogin()` (e.g. with `.auth()` and `.error()`) actually correct?**
  _`handleLogin()` has 2 INFERRED edges - model-reasoned connections that need verification._