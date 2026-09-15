# Amazon SDE I / Intern Interview Study Guide

This guide converts the 25 concept boxes in the supplied image into real LeetCode questions. It is a pattern-based curriculum, not a claim that Amazon publishes or guarantees these exact questions.

Amazon's official student SDE material names **coding, programming languages, data structures, algorithms, and object-oriented design** as core competencies. Amazon's general SDE guidance also emphasizes applying fundamentals, writing syntactically correct and maintainable code, handling invalid input and edge cases, and explaining efficiency. Behavioral questions are assessed through the Leadership Principles.

## How to use this guide

- **★ Core**: solve from scratch twice and explain aloud.
- **Next**: solve after the core set; these add an important variation.
- **Stretch**: useful after the rest is comfortable. Do not sacrifice core mastery for hard-problem count.
- **Premium**: a LeetCode problem exists, but full access may require LeetCode Premium.
- For every solution, state the invariant, time and space complexity, edge cases, and why the chosen data structure fits.

Recommended interview cadence: clarify requirements (2–3 minutes), give a simple approach, derive the optimized approach, code while narrating, then test with normal, boundary, and adversarial examples.

---

## 1. Array

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [1](https://leetcode.com/problems/two-sum/) | Two Sum | Hash lookup; complement invariant |
| ★ | [121](https://leetcode.com/problems/best-time-to-buy-and-sell-stock/) | Best Time to Buy and Sell Stock | One-pass state / running minimum |
| ★ | [238](https://leetcode.com/problems/product-of-array-except-self/) | Product of Array Except Self | Prefix and suffix products |
| ★ | [53](https://leetcode.com/problems/maximum-subarray/) | Maximum Subarray | Kadane's algorithm |
| ★ | [560](https://leetcode.com/problems/subarray-sum-equals-k/) | Subarray Sum Equals K | Prefix sum + frequency map |
| Next | [1094](https://leetcode.com/problems/car-pooling/) | Car Pooling | Difference array / sweep |
| Next | [304](https://leetcode.com/problems/range-sum-query-2d-immutable/) | Range Sum Query 2D – Immutable | 2D prefix sum |
| Next | [75](https://leetcode.com/problems/sort-colors/) | Sort Colors | In-place partitioning |

Follow-ups to rehearse:

1. Can you do it in one pass or with constant auxiliary space?
2. What changes when values may be negative, duplicated, or large enough to overflow a 32-bit integer?
3. If point updates occur between range-sum queries, why is a prefix array insufficient, and would you use a Fenwick tree or segment tree?

## 2. String

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [125](https://leetcode.com/problems/valid-palindrome/) | Valid Palindrome | Two pointers; normalization |
| ★ | [242](https://leetcode.com/problems/valid-anagram/) | Valid Anagram | Frequency counting |
| ★ | [49](https://leetcode.com/problems/group-anagrams/) | Group Anagrams | Canonical representation |
| ★ | [3](https://leetcode.com/problems/longest-substring-without-repeating-characters/) | Longest Substring Without Repeating Characters | Sliding window |
| Next | [438](https://leetcode.com/problems/find-all-anagrams-in-a-string/) | Find All Anagrams in a String | Fixed window + counts |
| Next | [647](https://leetcode.com/problems/palindromic-substrings/) | Palindromic Substrings | Expand around center |
| Next | [394](https://leetcode.com/problems/decode-string/) | Decode String | Stack / recursive parsing |
| Stretch, Premium | [271](https://leetcode.com/problems/encode-and-decode-strings/) | Encode and Decode Strings | Length-prefix encoding |

Follow-ups to rehearse:

1. Does the solution work for Unicode, punctuation, mixed case, and empty strings?
2. Can the input arrive in chunks rather than as one complete string?
3. Why is a delimiter-only encoding unsafe, and how does a length prefix avoid ambiguity?

## 3. Two Pointers

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [167](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/) | Two Sum II – Input Array Is Sorted | Opposite-direction pointers |
| ★ | [15](https://leetcode.com/problems/3sum/) | 3Sum | Sort + deduplication + two pointers |
| ★ | [11](https://leetcode.com/problems/container-with-most-water/) | Container With Most Water | Greedy pointer movement |
| Next | [26](https://leetcode.com/problems/remove-duplicates-from-sorted-array/) | Remove Duplicates from Sorted Array | Read/write pointers |
| Next | [42](https://leetcode.com/problems/trapping-rain-water/) | Trapping Rain Water | Two-sided maxima |
| Next | [844](https://leetcode.com/problems/backspace-string-compare/) | Backspace String Compare | Reverse scan / skip counters |

Follow-ups to rehearse:

1. Prove that moving the chosen pointer cannot discard a better answer.
2. Return indices or unique tuples instead of only a value; how will duplicates be handled?
3. Can the algorithm avoid sorting, and what time/space trade-off results?

## 4. Sliding Window

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [3](https://leetcode.com/problems/longest-substring-without-repeating-characters/) | Longest Substring Without Repeating Characters | Variable window |
| ★ | [424](https://leetcode.com/problems/longest-repeating-character-replacement/) | Longest Repeating Character Replacement | Validity invariant |
| ★ | [567](https://leetcode.com/problems/permutation-in-string/) | Permutation in String | Fixed-size frequency window |
| ★ | [76](https://leetcode.com/problems/minimum-window-substring/) | Minimum Window Substring | Minimum valid window |
| Next | [209](https://leetcode.com/problems/minimum-size-subarray-sum/) | Minimum Size Subarray Sum | Positive-number shrinking window |
| Stretch | [239](https://leetcode.com/problems/sliding-window-maximum/) | Sliding Window Maximum | Monotonic deque |

Follow-ups to rehearse:

1. State exactly when the window is valid and why each pointer moves at most `n` times.
2. Why does the usual shrinking-window method for #209 fail when negative values are allowed?
3. For streaming input, what state must be retained and how do you expire old elements?

## 5. Binary Search

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [704](https://leetcode.com/problems/binary-search/) | Binary Search | Exact match |
| ★ | [34](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/) | Find First and Last Position | Lower/upper bound |
| ★ | [33](https://leetcode.com/problems/search-in-rotated-sorted-array/) | Search in Rotated Sorted Array | Search in two sorted halves |
| Next | [153](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) | Find Minimum in Rotated Sorted Array | Rotation boundary |
| Next | [162](https://leetcode.com/problems/find-peak-element/) | Find Peak Element | Search by slope |
| ★ | [875](https://leetcode.com/problems/koko-eating-bananas/) | Koko Eating Bananas | Binary search on answer |
| Next | [1011](https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/) | Capacity to Ship Packages Within D Days | Feasibility predicate |

Follow-ups to rehearse:

1. Define an inclusive or half-open interval before coding; what invariant does it maintain?
2. What are the lowest and highest feasible answers, and is the predicate monotonic?
3. What changes when the rotated array contains duplicates?

## 6. Matrix

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [74](https://leetcode.com/problems/search-a-2d-matrix/) | Search a 2D Matrix | Flattened binary search |
| ★ | [48](https://leetcode.com/problems/rotate-image/) | Rotate Image | Transpose + reverse, in place |
| ★ | [54](https://leetcode.com/problems/spiral-matrix/) | Spiral Matrix | Boundary simulation |
| ★ | [73](https://leetcode.com/problems/set-matrix-zeroes/) | Set Matrix Zeroes | First row/column as markers |
| Next | [200](https://leetcode.com/problems/number-of-islands/) | Number of Islands | Grid DFS/BFS |
| Next | [64](https://leetcode.com/problems/minimum-path-sum/) | Minimum Path Sum | Grid DP |
| Stretch | [221](https://leetcode.com/problems/maximal-square/) | Maximal Square | 2D DP state |

Follow-ups to rehearse:

1. Can the transformation be done in place without corrupting unread values?
2. Handle empty, one-row, one-column, rectangular, or jagged input.
3. If the grid is too large for memory, can processing be row-by-row or tile-by-tile?

## 7. Linked List

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [206](https://leetcode.com/problems/reverse-linked-list/) | Reverse Linked List | Pointer reversal |
| ★ | [141](https://leetcode.com/problems/linked-list-cycle/) | Linked List Cycle | Slow/fast pointers |
| Next | [142](https://leetcode.com/problems/linked-list-cycle-ii/) | Linked List Cycle II | Cycle-entry proof |
| ★ | [21](https://leetcode.com/problems/merge-two-sorted-lists/) | Merge Two Sorted Lists | Dummy head / pointer merge |
| ★ | [19](https://leetcode.com/problems/remove-nth-node-from-end-of-list/) | Remove Nth Node From End | Fixed pointer gap |
| Next | [143](https://leetcode.com/problems/reorder-list/) | Reorder List | Split, reverse, merge |
| Stretch | [23](https://leetcode.com/problems/merge-k-sorted-lists/) | Merge k Sorted Lists | Heap or divide-and-conquer |
| Next | [138](https://leetcode.com/problems/copy-list-with-random-pointer/) | Copy List with Random Pointer | Hash map or node interleaving |

Follow-ups to rehearse:

1. Solve iteratively and recursively; compare stack space and failure modes.
2. Preserve the original list or modify it in place—what changes?
3. Test `null`, one node, two nodes, an even/odd length, and a cycle at the head.

## 8. Stack

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [20](https://leetcode.com/problems/valid-parentheses/) | Valid Parentheses | Matching delimiters |
| ★ | [155](https://leetcode.com/problems/min-stack/) | Min Stack | Auxiliary state per push |
| ★ | [739](https://leetcode.com/problems/daily-temperatures/) | Daily Temperatures | Monotonic stack |
| Next | [496](https://leetcode.com/problems/next-greater-element-i/) | Next Greater Element I | Monotonic stack + map |
| Next | [150](https://leetcode.com/problems/evaluate-reverse-polish-notation/) | Evaluate Reverse Polish Notation | Expression evaluation |
| Next | [402](https://leetcode.com/problems/remove-k-digits/) | Remove K Digits | Greedy monotonic stack |
| Stretch | [84](https://leetcode.com/problems/largest-rectangle-in-histogram/) | Largest Rectangle in Histogram | Nearest-smaller boundaries |

Follow-ups to rehearse:

1. What does the stack contain—values, indices, or pairs—and why?
2. How are equal elements treated in the monotonic invariant?
3. Can Min Stack support duplicate minima and all operations in worst-case `O(1)`?

## 9. Queue / Deque / BFS

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [232](https://leetcode.com/problems/implement-queue-using-stacks/) | Implement Queue using Stacks | Amortized analysis |
| Next | [622](https://leetcode.com/problems/design-circular-queue/) | Design Circular Queue | Ring buffer invariants |
| Next | [641](https://leetcode.com/problems/design-circular-deque/) | Design Circular Deque | Two-ended ring buffer |
| ★ | [933](https://leetcode.com/problems/number-of-recent-calls/) | Number of Recent Calls | Expiring queue |
| ★ | [994](https://leetcode.com/problems/rotting-oranges/) | Rotting Oranges | Multi-source BFS |
| Stretch | [239](https://leetcode.com/problems/sliding-window-maximum/) | Sliding Window Maximum | Monotonic deque |
| Premium | [362](https://leetcode.com/problems/design-hit-counter/) | Design Hit Counter | Time-window aggregation |

Follow-ups to rehearse:

1. Explain why two-stack queue operations are amortized `O(1)` although one call may be `O(n)`.
2. In BFS, how do you separate levels and guarantee each state is processed once?
3. What changes under concurrent producers/consumers or out-of-order timestamps?

## 10. Hashing

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [1](https://leetcode.com/problems/two-sum/) | Two Sum | Value-to-index map |
| ★ | [217](https://leetcode.com/problems/contains-duplicate/) | Contains Duplicate | Membership set |
| ★ | [49](https://leetcode.com/problems/group-anagrams/) | Group Anagrams | Canonical hash key |
| ★ | [347](https://leetcode.com/problems/top-k-frequent-elements/) | Top K Frequent Elements | Frequency map + buckets/heap |
| ★ | [128](https://leetcode.com/problems/longest-consecutive-sequence/) | Longest Consecutive Sequence | Start-of-sequence invariant |
| Next | [36](https://leetcode.com/problems/valid-sudoku/) | Valid Sudoku | Composite keys / independent sets |
| Next | [560](https://leetcode.com/problems/subarray-sum-equals-k/) | Subarray Sum Equals K | Prefix-frequency map |

Follow-ups to rehearse:

1. What assumptions are hidden by average-case `O(1)` hash operations?
2. Can an array replace the map when the key domain is small and fixed?
3. How do collision behavior, memory overhead, and deterministic ordering affect the choice?

## 11. Binary Tree

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| Next | [94](https://leetcode.com/problems/binary-tree-inorder-traversal/) | Binary Tree Inorder Traversal | Recursive and iterative traversal |
| ★ | [102](https://leetcode.com/problems/binary-tree-level-order-traversal/) | Binary Tree Level Order Traversal | BFS by level |
| ★ | [104](https://leetcode.com/problems/maximum-depth-of-binary-tree/) | Maximum Depth of Binary Tree | Return information upward |
| ★ | [543](https://leetcode.com/problems/diameter-of-binary-tree/) | Diameter of Binary Tree | Local height + global answer |
| ★ | [236](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/) | Lowest Common Ancestor | Postorder reasoning |
| Stretch | [124](https://leetcode.com/problems/binary-tree-maximum-path-sum/) | Binary Tree Maximum Path Sum | Downward gain vs global path |
| Next | [572](https://leetcode.com/problems/subtree-of-another-tree/) | Subtree of Another Tree | Structure comparison |

Follow-ups to rehearse:

1. What does each recursive call return, and what answer is updated globally?
2. Convert recursion to iteration to avoid call-stack overflow on a skewed tree.
3. If parent pointers exist, can you reduce auxiliary space for LCA?

## 12. Binary Search Tree

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| Next | [700](https://leetcode.com/problems/search-in-a-binary-search-tree/) | Search in a BST | Ordered search |
| Next | [701](https://leetcode.com/problems/insert-into-a-binary-search-tree/) | Insert into a BST | Preserve ordering invariant |
| Stretch | [450](https://leetcode.com/problems/delete-node-in-a-bst/) | Delete Node in a BST | Successor replacement |
| ★ | [98](https://leetcode.com/problems/validate-binary-search-tree/) | Validate Binary Search Tree | Valid value bounds |
| ★ | [230](https://leetcode.com/problems/kth-smallest-element-in-a-bst/) | Kth Smallest Element in a BST | Inorder order statistic |
| ★ | [235](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/) | LCA of a BST | Use ordering to prune |
| Next | [173](https://leetcode.com/problems/binary-search-tree-iterator/) | BST Iterator | Controlled inorder stack |
| Next | [669](https://leetcode.com/problems/trim-a-binary-search-tree/) | Trim a BST | Prune whole subtrees |

Follow-ups to rehearse:

1. Define the duplicate-key policy; inclusive bounds often introduce validation bugs.
2. How would subtree sizes support repeated `kthSmallest` queries?
3. An ordinary BST can become a linked list—when is a balanced tree required?

## 13. Heap / Priority Queue

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [703](https://leetcode.com/problems/kth-largest-element-in-a-stream/) | Kth Largest Element in a Stream | Size-`k` min-heap |
| ★ | [215](https://leetcode.com/problems/kth-largest-element-in-an-array/) | Kth Largest Element in an Array | Heap vs quickselect |
| ★ | [973](https://leetcode.com/problems/k-closest-points-to-origin/) | K Closest Points to Origin | Top-`k` selection |
| ★ | [347](https://leetcode.com/problems/top-k-frequent-elements/) | Top K Frequent Elements | Heap/bucket alternatives |
| Next | [23](https://leetcode.com/problems/merge-k-sorted-lists/) | Merge k Sorted Lists | K-way merge |
| Stretch | [295](https://leetcode.com/problems/find-median-from-data-stream/) | Find Median from Data Stream | Two balanced heaps |
| Next | [621](https://leetcode.com/problems/task-scheduler/) | Task Scheduler | Frequency reasoning / heap simulation |

Follow-ups to rehearse:

1. Why is a min-heap of size `k` useful for the largest `k` values?
2. Compare heap, sorting, quickselect, and bucket counting under different constraints.
3. Support deletions or sliding-window medians; how will stale heap entries be handled?

## 14. Graph

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [133](https://leetcode.com/problems/clone-graph/) | Clone Graph | DFS/BFS + old-to-new map |
| ★ | [200](https://leetcode.com/problems/number-of-islands/) | Number of Islands | Connected components |
| Next | [695](https://leetcode.com/problems/max-area-of-island/) | Max Area of Island | Component aggregation |
| ★ | [207](https://leetcode.com/problems/course-schedule/) | Course Schedule | Directed cycle detection / Kahn's algorithm |
| Next | [210](https://leetcode.com/problems/course-schedule-ii/) | Course Schedule II | Topological ordering |
| ★ | [547](https://leetcode.com/problems/number-of-provinces/) | Number of Provinces | DFS/BFS/DSU components |
| Next | [417](https://leetcode.com/problems/pacific-atlantic-water-flow/) | Pacific Atlantic Water Flow | Reverse multi-source traversal |
| Stretch | [127](https://leetcode.com/problems/word-ladder/) | Word Ladder | Implicit-graph BFS |
| Stretch | [1192](https://leetcode.com/problems/critical-connections-in-a-network/) | Critical Connections in a Network | Tarjan bridges |

Follow-ups to rehearse:

1. Choose adjacency list vs matrix based on density and required operations.
2. How do directed and undirected cycle detection differ?
3. Return an actual path/order/component membership, not only a boolean or count.
4. How will recursion depth, disconnected nodes, self-loops, and duplicate edges be handled?

## 15. Backtracking

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [78](https://leetcode.com/problems/subsets/) | Subsets | Include/exclude decision tree |
| ★ | [46](https://leetcode.com/problems/permutations/) | Permutations | Used-state tracking |
| ★ | [39](https://leetcode.com/problems/combination-sum/) | Combination Sum | Reuse candidates + pruning |
| Next | [22](https://leetcode.com/problems/generate-parentheses/) | Generate Parentheses | Build only valid prefixes |
| ★ | [79](https://leetcode.com/problems/word-search/) | Word Search | Grid search + restore state |
| Stretch | [51](https://leetcode.com/problems/n-queens/) | N-Queens | Constraint sets |
| Stretch | [37](https://leetcode.com/problems/sudoku-solver/) | Sudoku Solver | Most-constrained choices |
| Stretch | [212](https://leetcode.com/problems/word-search-ii/) | Word Search II | Trie-guided pruning |

Follow-ups to rehearse:

1. Draw the decision tree and state the base case, choices, and undo operation.
2. Eliminate duplicate answers when the input contains duplicate values.
3. Which pruning rule is correct, and why can it not discard a valid solution?

## 16. Dynamic Programming — 1D

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [70](https://leetcode.com/problems/climbing-stairs/) | Climbing Stairs | Fibonacci-like recurrence |
| ★ | [198](https://leetcode.com/problems/house-robber/) | House Robber | Take/skip state |
| Next | [213](https://leetcode.com/problems/house-robber-ii/) | House Robber II | Break a circular dependency |
| ★ | [322](https://leetcode.com/problems/coin-change/) | Coin Change | Unbounded choices |
| ★ | [300](https://leetcode.com/problems/longest-increasing-subsequence/) | Longest Increasing Subsequence | `O(n²)` DP then `O(n log n)` optimization |
| ★ | [139](https://leetcode.com/problems/word-break/) | Word Break | Prefix feasibility |
| Next | [152](https://leetcode.com/problems/maximum-product-subarray/) | Maximum Product Subarray | Track min and max products |
| Next | [91](https://leetcode.com/problems/decode-ways/) | Decode Ways | Prefix-count DP |

Follow-ups to rehearse:

1. Define the state in one sentence before writing a recurrence.
2. Derive base cases from the state definition rather than memorizing them.
3. Can the DP table be compressed, and is the original table needed to reconstruct a solution?

## 17. Dynamic Programming — 2D / Knapsack / Interval DP

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [62](https://leetcode.com/problems/unique-paths/) | Unique Paths | Grid DP |
| Next | [64](https://leetcode.com/problems/minimum-path-sum/) | Minimum Path Sum | Weighted grid DP |
| ★ | [416](https://leetcode.com/problems/partition-equal-subset-sum/) | Partition Equal Subset Sum | 0/1 knapsack feasibility |
| Next | [494](https://leetcode.com/problems/target-sum/) | Target Sum | Sign choices / subset transform |
| ★ | [1143](https://leetcode.com/problems/longest-common-subsequence/) | Longest Common Subsequence | Two-prefix DP |
| Next | [72](https://leetcode.com/problems/edit-distance/) | Edit Distance | Insert/delete/replace recurrence |
| Next | [516](https://leetcode.com/problems/longest-palindromic-subsequence/) | Longest Palindromic Subsequence | Interval/two-ended DP |
| Stretch | [312](https://leetcode.com/problems/burst-balloons/) | Burst Balloons | Interval DP; matrix-chain-style split |

Follow-ups to rehearse:

1. For 0/1 knapsack, why must a compressed capacity loop run backward? Why does unbounded knapsack run forward?
2. Recover the selected items or actual subsequence, not merely its score.
3. Explain the fill order so every dependency is already available.
4. For interval DP, why is choosing the **last** action often easier than choosing the first?

## 18. Greedy

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [55](https://leetcode.com/problems/jump-game/) | Jump Game | Farthest reachable index |
| Next | [45](https://leetcode.com/problems/jump-game-ii/) | Jump Game II | Layered greedy range |
| ★ | [134](https://leetcode.com/problems/gas-station/) | Gas Station | Global feasibility + restart |
| ★ | [763](https://leetcode.com/problems/partition-labels/) | Partition Labels | Last occurrence boundary |
| ★ | [435](https://leetcode.com/problems/non-overlapping-intervals/) | Non-overlapping Intervals | Earliest-finish activity selection |
| Next | [621](https://leetcode.com/problems/task-scheduler/) | Task Scheduler | Most-frequent-task bound |
| Stretch | [135](https://leetcode.com/problems/candy/) | Candy | Two directional constraints |

Follow-ups to rehearse:

1. Give an exchange argument or invariant proving the local choice is safe.
2. Produce a counterexample showing why a tempting alternative greedy rule fails.
3. Return the chosen objects/schedule, not just the optimum count or cost.

## 19. Intervals

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [56](https://leetcode.com/problems/merge-intervals/) | Merge Intervals | Sort then merge |
| ★ | [57](https://leetcode.com/problems/insert-interval/) | Insert Interval | Three-phase scan |
| ★ | [435](https://leetcode.com/problems/non-overlapping-intervals/) | Non-overlapping Intervals | Earliest finishing time |
| Next | [986](https://leetcode.com/problems/interval-list-intersections/) | Interval List Intersections | Two sorted lists |
| Next | [452](https://leetcode.com/problems/minimum-number-of-arrows-to-burst-balloons/) | Minimum Arrows to Burst Balloons | Shared intersection point |
| Premium | [253](https://leetcode.com/problems/meeting-rooms-ii/) | Meeting Rooms II | Sweep line / min-heap |
| Next | [729](https://leetcode.com/problems/my-calendar-i/) | My Calendar I | Ordered interval conflict |

Follow-ups to rehearse:

1. Are intervals closed, open, or half-open? Does `[1,2]` overlap `[2,3]`?
2. Return room assignments or merged source IDs rather than only a count.
3. Support online insertion when all intervals are not known in advance.

## 20. Bit Manipulation

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [191](https://leetcode.com/problems/number-of-1-bits/) | Number of 1 Bits | Clear lowest set bit |
| ★ | [338](https://leetcode.com/problems/counting-bits/) | Counting Bits | Bit DP |
| ★ | [136](https://leetcode.com/problems/single-number/) | Single Number | XOR cancellation |
| Next | [268](https://leetcode.com/problems/missing-number/) | Missing Number | XOR or arithmetic sum |
| Next | [190](https://leetcode.com/problems/reverse-bits/) | Reverse Bits | Fixed-width shifting |
| Stretch | [371](https://leetcode.com/problems/sum-of-two-integers/) | Sum of Two Integers | XOR sum + carry |
| Stretch | [201](https://leetcode.com/problems/bitwise-and-of-numbers-range/) | Bitwise AND of Numbers Range | Common binary prefix |

Follow-ups to rehearse:

1. What bit width and signed-integer representation does the language use?
2. Generalize “one unique, all others twice” to occurrences of three or `k`.
3. Explain operator precedence and the difference between arithmetic and logical shifts.

## 21. Math and Number Theory

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [204](https://leetcode.com/problems/count-primes/) | Count Primes | Sieve of Eratosthenes |
| Next | [1979](https://leetcode.com/problems/find-greatest-common-divisor-of-array/) | Find Greatest Common Divisor of Array | Euclidean algorithm |
| ★ | [50](https://leetcode.com/problems/powx-n/) | Pow(x, n) | Fast exponentiation |
| Next | [172](https://leetcode.com/problems/factorial-trailing-zeroes/) | Factorial Trailing Zeroes | Count factors of five |
| Next | [202](https://leetcode.com/problems/happy-number/) | Happy Number | Cycle detection |
| Stretch | [149](https://leetcode.com/problems/max-points-on-a-line/) | Max Points on a Line | Normalized rational slope |
| Stretch | [60](https://leetcode.com/problems/permutation-sequence/) | Permutation Sequence | Factorial number system |

Follow-ups to rehearse:

1. Normalize signs and reduce fractions when values form a hash key.
2. Handle zero, negatives, integer minimum, overflow, and floating-point precision.
3. Derive the complexity instead of calling an arithmetic helper a constant-time operation.

## 22. Data-Structure Design

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [146](https://leetcode.com/problems/lru-cache/) | LRU Cache | Hash map + doubly linked list |
| ★ | [380](https://leetcode.com/problems/insert-delete-getrandom-o1/) | Insert Delete GetRandom O(1) | Array + index map |
| ★ | [981](https://leetcode.com/problems/time-based-key-value-store/) | Time Based Key-Value Store | Per-key ordered values + binary search |
| Premium | [359](https://leetcode.com/problems/logger-rate-limiter/) | Logger Rate Limiter | Per-key timestamps |
| Next | [355](https://leetcode.com/problems/design-twitter/) | Design Twitter | Fan-out/read merge + heap |
| Stretch | [295](https://leetcode.com/problems/find-median-from-data-stream/) | Find Median from Data Stream | Two heaps |
| Premium | [588](https://leetcode.com/problems/design-in-memory-file-system/) | Design In-Memory File System | Trie/tree namespace |
| Next | [1472](https://leetcode.com/problems/design-browser-history/) | Design Browser History | Indexed history / two stacks |

Follow-ups to rehearse:

1. State the promised complexity for every public operation and identify the structure that makes it possible.
2. Add TTL, bounded memory, persistence, thread safety, or crash recovery.
3. What invariant must remain true when an operation partially fails?

## 23. Trie

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [208](https://leetcode.com/problems/implement-trie-prefix-tree/) | Implement Trie | Insert/search/startsWith |
| ★ | [211](https://leetcode.com/problems/design-add-and-search-words-data-structure/) | Design Add and Search Words | Wildcard DFS over trie |
| Stretch | [212](https://leetcode.com/problems/word-search-ii/) | Word Search II | Trie + grid backtracking |
| Next | [648](https://leetcode.com/problems/replace-words/) | Replace Words | Shortest prefix match |
| ★ | [1268](https://leetcode.com/problems/search-suggestions-system/) | Search Suggestions System | Sorted range or top-`k` trie nodes |
| Next | [720](https://leetcode.com/problems/longest-word-in-dictionary/) | Longest Word in Dictionary | Valid-prefix chain |
| Premium | [1804](https://leetcode.com/problems/implement-trie-ii-prefix-tree/) | Implement Trie II | Exact/prefix counts + erase |

Follow-ups to rehearse:

1. Compare fixed child arrays with hash maps for memory, speed, and alphabet size.
2. Support duplicate words, deletion, prefix counts, and top-`k` suggestions.
3. How would you handle Unicode normalization or rank suggestions by popularity and recency?

## 24. Union Find / Disjoint Set Union

| Priority | # | Problem | Main pattern |
|---|---:|---|---|
| ★ | [547](https://leetcode.com/problems/number-of-provinces/) | Number of Provinces | Component counting |
| ★ | [684](https://leetcode.com/problems/redundant-connection/) | Redundant Connection | Cycle-forming edge |
| ★ | [721](https://leetcode.com/problems/accounts-merge/) | Accounts Merge | Entity resolution by shared key |
| Next | [1319](https://leetcode.com/problems/number-of-operations-to-make-network-connected/) | Number of Operations to Make Network Connected | Spare edges + components |
| Stretch | [1584](https://leetcode.com/problems/min-cost-to-connect-all-points/) | Min Cost to Connect All Points | MST; Prim or Kruskal + DSU |
| Next | [990](https://leetcode.com/problems/satisfiability-of-equality-equations/) | Satisfiability of Equality Equations | Merge equalities, test inequalities |
| Premium | [305](https://leetcode.com/problems/number-of-islands-ii/) | Number of Islands II | Online connectivity |

Follow-ups to rehearse:

1. Implement path compression and union by size/rank; explain near-constant amortized cost.
2. Return the members or sizes of components, not only their count.
3. Why is ordinary DSU poor at edge deletion, and what offline or rollback technique could help?

---

## 25. System Design: what is and is not a LeetCode problem

LeetCode has narrow coding analogues for some names in the image, but those do **not** replace a full design discussion. For an intern/SDE I interview, first clarify whether the interviewer wants low-level object-oriented design (classes, APIs, invariants) or high-level design (services, storage, scale, availability). Start with a small correct system, then scale only when the requirements demand it.

### A. Rate limiter

- **LeetCode bridge:** #359 Logger Rate Limiter (Premium) is a simplified per-message cooldown; #362 Design Hit Counter (Premium) covers a time window.
- **Requirements to clarify:** limit per user/API/IP; fixed or rolling window; burst allowance; distributed enforcement; fail-open or fail-closed.
- **Baseline design:** API gateway calls a rate-limit service. Store a token bucket per key with `tokens` and `lastRefillTime`; refill lazily on each request. A single-node implementation uses a map; a distributed version uses a partitioned, atomic store and TTL so inactive keys disappear.
- **Correctness points:** define the time source, make update-and-check atomic, and return remaining quota plus retry time. Token bucket allows controlled bursts; sliding-window log is exact but memory-heavy; fixed window is cheap but bursts at boundaries.
- **Follow-ups:** How do hot keys scale? What happens if the store is unavailable? How are limits updated without restarting? How do clock skew and multi-region traffic affect correctness? How would you monitor false blocks and latency?

### B. Snake game

- **LeetCode bridge:** [#353 Design Snake Game](https://leetcode.com/problems/design-snake-game/) (Premium) is the coding/OOD version.
- **Core model:** a deque stores body cells from head to tail and a hash set supports `O(1)` collision checks. On a normal move, remove the tail before checking the new head so moving into the just-vacated tail cell is legal; when food is eaten, retain the tail.
- **Public API:** `move(direction) -> score/status`, with board dimensions and ordered food positions supplied to the constructor.
- **Follow-ups:** Add multiple players. Make movement thread-safe. Persist/replay a game. Support obstacles and wraparound. Prevent illegal direction reversal. Build a deterministic test using a fake clock or move sequence.

### C. Parking lot

- **LeetCode bridge:** [#1603 Design Parking System](https://leetcode.com/problems/design-parking-system/) only counts three slot types; it is **not** a full parking-lot design.
- **Objects:** `ParkingLot`, `Level`, `Spot`, `Vehicle`, `Ticket`, `Gate`, `RatePolicy`, `Payment`. Prefer composition: a level owns spots, a ticket refers to a vehicle and spot, and pricing is a replaceable strategy.
- **Key flows:** `enter(vehicle)` finds a compatible spot and atomically reserves it; `exit(ticket)` computes price, records payment, and releases the spot. Maintain free-spot indexes by size rather than scanning the lot.
- **Data and invariants:** a spot has one current occupancy; an open ticket maps to exactly one occupied spot; duplicate entry/exit requests are idempotent.
- **Follow-ups:** Reservations and EV charging. Accessible spots. Multiple entrances racing for one spot. Lost tickets. Dynamic pricing. Sensor disagreement. How would you partition a city-wide service?

### D. URL shortener

- **LeetCode bridge:** [#535 Encode and Decode TinyURL](https://leetcode.com/problems/encode-and-decode-tinyurl/) tests only encode/decode behavior.
- **API:** `POST /links {longUrl, customAlias?, expiresAt?}` and `GET /{code}` returning a redirect. Keep creation idempotent with a client request ID if retries are expected.
- **Data model:** `code -> longUrl, owner, createdAt, expiresAt, status`; analytics should be written asynchronously so redirects remain fast.
- **Code generation:** a unique numeric ID encoded in Base62 avoids collisions but exposes approximate volume; random codes avoid sequential enumeration but require collision checks. Cache popular codes and use a durable key-value store as source of truth.
- **Follow-ups:** Estimate code length and storage. Handle malicious URLs. Custom aliases and deletion. Expiration. Hot links. Multi-region reads. Cache invalidation. 301 vs 302 redirects.

### E. Chat system

- **LeetCode status:** no single canonical LeetCode problem represents a complete chat system. #355 Design Twitter and #981 Time Based Key-Value Store exercise useful subpatterns only.
- **Requirements:** one-to-one or group chat; online delivery; history; ordering; read receipts; presence; attachments; push notifications; retention.
- **Architecture:** clients maintain a WebSocket connection to gateway nodes; a chat service validates membership and assigns a conversation-scoped sequence; durable messages are stored by `conversationId`; a broker fans events to recipient gateways; offline users fetch history later.
- **Semantics:** use a client-generated message ID for idempotency. Promise ordering within a conversation, not global order. Usually choose at-least-once transport plus client/server deduplication.
- **Follow-ups:** Reconnect and missed-message recovery. Very large groups. Multi-device sync. Edit/delete. Abuse controls. End-to-end encryption and key rotation. Presence storms. Regional failure.

### F. File storage system

- **LeetCode bridge:** [#588 Design In-Memory File System](https://leetcode.com/problems/design-in-memory-file-system/) (Premium) models an in-memory namespace, not durable object storage.
- **Requirements:** upload/download/list/delete; folders or flat keys; object size; durability; sharing; versioning; consistency; resumable upload.
- **Architecture:** a metadata service stores owner, path, permissions, versions, and blob IDs; large bytes go to replicated object storage; upload returns chunk URLs, verifies checksums, then atomically commits metadata. A CDN can serve authorized downloads through short-lived signed URLs.
- **Correctness and security:** never expose raw permanent storage credentials. Make upload completion idempotent. Garbage-collect uncommitted chunks and unreferenced blobs. Audit permission changes.
- **Follow-ups:** Rename a huge folder. Duplicate-content deduplication. Concurrent edits. Quotas. Cross-region durability. Malware scanning. Version restoration. Consistency between metadata and blobs.

---

## Image topics that do not have an exact standalone LeetCode title

These are concepts in the image, not missing LeetCode numbers:

- **Activity selection:** practice #435 and #452. The core rule is sorting by finish time and taking the next compatible interval; be ready to prove it with an exchange argument.
- **0/1 knapsack:** practice #416 and #494. Each item is used at most once, so a one-dimensional capacity array is traversed backward.
- **Matrix-chain multiplication:** classic MCM itself is not a standard numbered LeetCode prompt. #312 Burst Balloons develops the same interval-DP habit: choose a split/last action and combine independent subintervals.
- **Kruskal's algorithm:** #1584 can be solved with Kruskal. Separately implement `sort edges + DSU`, stop after `V - 1` accepted edges, and detect a disconnected graph.
- **Count words in a trie:** #1804 is the direct problem but is Premium. Store `prefixCount` on every traversed node and `wordCount` at the terminal node; decrement both carefully on erase.
- **Full parking lot, chat, and durable file storage:** these are open-ended design exercises; the numbered bridges above cover only small components.

---

## Amazon-style follow-up checklist for every coding question

After reaching a working solution, have a mock interviewer choose at least three:

1. Prove correctness using an invariant or induction.
2. State exact time and auxiliary-space complexity, including sorting, recursion stack, and output storage.
3. Walk through empty input, one item, duplicates, extreme values, and malformed input.
4. Return the actual solution/path/items, not only a count or boolean.
5. Support a stream of updates or repeated queries.
6. Reduce memory or remove recursion.
7. Explain what changes under concurrency or when the data no longer fits in memory.
8. Write two unit tests that would break a common incorrect solution.
9. Compare the chosen approach with one credible alternative.
10. Rename variables and extract helpers until the code can be read without narration.

## Behavioral preparation: do not leave this until the end

Amazon's official guidance says behavioral questions use the Leadership Principles and recommends the STAR structure. Prepare six to eight stories from coursework, internships, projects, clubs, volunteering, or personal work. One story may cover multiple principles, but do not force every story to fit everything.

For each story, write:

- **Situation:** only the context needed to understand the stakes.
- **Task:** your responsibility and the measurable goal.
- **Action:** what **you** decided and did, including trade-offs and disagreements.
- **Result:** metrics, customer/user effect, what failed, and what you learned.

Expect deep follow-ups:

1. What was your individual contribution versus the team's?
2. What data did you use, and what was uncertain?
3. What alternatives did you reject and why?
4. Tell me exactly what went wrong.
5. Who disagreed with you, and how did you respond?
6. What metric changed, from what baseline to what result?
7. What would you do differently now?
8. How did your action help the end user or customer?

High-yield story coverage for an intern/SDE I candidate: Customer Obsession, Ownership, Learn and Be Curious, Dive Deep, Bias for Action, Earn Trust, Invent and Simplify, Insist on the Highest Standards, Have Backbone; Disagree and Commit, and Deliver Results.

---

## Six-week execution plan

| Week | Focus | Target |
|---|---|---|
| 1 | Arrays, strings, hashing, two pointers, sliding window | 18–22 problems; redo every miss without notes |
| 2 | Binary search, linked lists, stacks, queues, intervals | 18–22 problems; one timed 70–90 minute two-question session |
| 3 | Trees, BST, heaps | 15–18 problems; two spoken mock interviews |
| 4 | Graphs, union find, tries, backtracking | 15–18 problems; practice path reconstruction and proofs |
| 5 | 1D/2D DP, greedy, math/bits | 15–18 problems; derive states before coding |
| 6 | Mixed mocks, OOD/system-design bridges, Leadership Principles | Three full mocks; finalize 6–8 STAR stories |

Do not measure progress only by accepted submissions. A problem is interview-ready when you can recognize the pattern, derive it without notes, code it cleanly in 25–35 minutes, test it aloud, and handle two follow-ups.

## Sources and scope

- [Amazon: software development interview topics](https://amazon.jobs/content/en-gb/how-we-hire/interview-prep/software-development-topics)
- [Amazon: student and graduate SDE roles and core competencies](https://www.amazon.jobs/content/en/career-programs/university/sde)
- [Amazon: SDE coding expectations](https://www.amazon.jobs/content/en/how-we-hire/sde-iii-interview-prep)
- [Amazon: interview loop and STAR method](https://www.amazon.jobs/content/en/how-we-hire/interview-loop)
- [Amazon: Leadership Principles](https://amazon.jobs/content/en/our-workplace/leadership-principles)
- Individual problem titles and numbers link directly to their LeetCode pages.

Last reviewed: 2026-09-14. Interview formats vary by role, country, team, and hiring cycle; use the recruiter-provided instructions as authoritative for a specific interview.
