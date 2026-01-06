# Plant Balancing Analysis

This document analyzes the current state of plant balancing in Cloudy Meadows, focusing on growth time, water requirements, and economic value.

## Overview of Metrics

*   **Growth Time:** Measured in game ticks/frames (approx). Lower is faster.
*   **Water Needed:** Number relative to sprinkler output or manual watering intensity (0 = none, 1 = normal, 2 = high).
*   **Sell Price:** value of the harvested produce.
*   **Seed Cost:** Currently effectively **1** for all seeds due to code implementation (constructor override), though `ITEM_DEFINITIONS` suggests intended prices (e.g., Flower Seed 30g).
*   **Efficiency:** (Sell Price - 1) / Growth Time. Represents Gold per Tick.

## Balanced Plant Statistics

| Plant | Produce | Sell Price | Growth Time | Water Need | Efficiency (Gold/Tick) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hemp** | Hemp Flower | 20 | 2000 | 2 | **0.0095** |
| **Tomato** | Tomato | 5 | 1300 | 1 | **0.0031** |
| **Corn** | Corn | 6 | 2000 | 0 | **0.0025** |
| **Carrot** | Carrot | 6 | 2200 | 1 | **0.0023** |
| **Sweet Potato** | Sweet Potato | 5 | 2200 | 0 | **0.0018** |
| **Watermelon** | Watermelon | 8 | 4000 | 2 | **0.0018** |
| **Strawberry** | Strawberry | 4 | 1900 | 1 | **0.0016** |
| **Pumpkin** | Pumpkin | 5 | 3000 | 0 | **0.0013** |

## Analysis of Strengths & Weaknesses

### 1. Hemp (The Gold Standard)
*   **Strength:** Incredible efficiency (3x better than average). High sell price (20g).
*   **Weakness:** High water requirement (2).
*   **Verdict:** Currently overpowered. The water cost does not justify the massive profit margin compared to Watermelon which also needs 2 water but yields far less.

### 2. Tomato (The Speedster)
*   **Strength:** Fastest growth time (1300). High efficiency (2nd best).
*   **Weakness:** Requires water (1).
*   **Verdict:** Excellent early-game crop if water is available. Good for quick cash flow.

### 3. Corn (The reliable Staple)
*   **Strength:** **Zero** water requirement. Moderate income.
*   **Weakness:** Average growth speed.
*   **Verdict:** The best "set and forget" crop. Very strong because it needs no maintenance (water) and has decent efficiency.

### 4. Carrot
*   **Strength:** Decent price (6g). Special mutation chance (10% to spawn Bunny).
*   **Weakness:** Slower than Corn (2200 vs 2000) and requires water (1).
*   **Verdict:** Strictly worse than Corn economically, but offers unique gameplay (Bunny spawning).

### 5. Watermelon (The Trap)
*   **Strength:** Highest raw sell price after Hemp (8g).
*   **Weakness:** **Extremely** long growth time (4000). High water requirement (2).
*   **Verdict:** Underpowered. It ties for high water cost but has very low efficiency. Players are better off planting Hemp (same water, 2.5x value, 2x speed) or even Corn (no water, faster).

### 6. Pumpkin
*   **Strength:** Zero water requirement.
*   **Weakness:** Very slow (3000) for low payout (5g).
*   **Verdict:** Worse version of Sweet Potato/Corn. Lowest efficiency in the game.

### 7. Strawberry
*   **Strength:** None apparent mathematically.
*   **Weakness:** Low price (4g), requires water (1), average speed.
*   **Verdict:** Needs a buff. Currently outclassed by Tomato (faster, more val) and Corn (no water, more val).

## Recommendations

1.  **Nerf Hemp:** Increase growth time significantly (e.g., to 4000+) or reduce price (to ~10-12) to balance its high water cost.
2.  **Buff Watermelon:** Needs a massive price increase to justify the 4000 growth time and 2 water cost. Suggested Price: ~15-18g.
3.  **Buff Pumpkin/Strawberry:**
    *   Pumpkin could use a price bump (to 8-10g) given the long growth time.
    *   Strawberries could be made faster (e.g., 1000 growth) to be a "high maintenance, frequent harvest" crop.
4.  **Fix Seed Prices:** Currently all seeds seem to default to 1g cost. Implementing varied seed costs (as likely intended in `ITEM_DEFINITIONS`) would allow for finer economic balancing (e.g., expensive Hemp seeds to reduce net profit).

