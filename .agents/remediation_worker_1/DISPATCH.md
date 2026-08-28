# Dispatch for Remediation Worker (Iteration 2)

## 2026-08-28T10:58:05Z

## Task
Apply the 3 specific fixes identified by Challenger 2 to `google-apps-script/Code.js` and `scripts/test_simulator.js`:

1. **Fix 1: Preserve CANCELLED Bounties upon Task Completion**
   - In `handleDevStatusTransition` (both `Code.js` and `test_simulator.js`):
     Change the bounty release loop so that only non-cancelled bounties are transitioned to `RELEASED`:
     ```javascript
     if (bData[b][2] == ideaId && bData[b][8] !== "CANCELLED") {
       bountiesSheet.getRange(b + 1, 9).setValue("RELEASED");
     }
     ```

2. **Fix 2: Complete Multi-Currency Aggregation for USD & POINTS**
   - In `calculateTotalBounty` (both `Code.js` and `test_simulator.js`):
     Parse and track `totalUsd` and `totalPoints` in addition to `totalVnd` and `coffeeCount`.
     In `badgeText` generation:
     ```javascript
     if (totalVnd > 0) parts.push(`${totalVnd.toLocaleString("vi-VN")} VNĐ`);
     if (totalUsd > 0) parts.push(`${totalUsd.toLocaleString()} USD`);
     if (coffeeCount > 0) parts.push(`${coffeeCount} ☕`);
     if (totalPoints > 0) parts.push(`${totalPoints.toLocaleString()} Pts`);
     ```

3. **Fix 3: Guard FSM Against Unclaiming Completed Tasks**
   - In `handleUnclaimTask` (both `Code.js` and `test_simulator.js`):
     Check `currentStatus`:
     ```javascript
     if (currentStatus === "Hoàn thành" || currentStatus === "Completed") {
       return { success: false, error: "CANNOT_UNCLAIM_COMPLETED" };
     }
     ```

## Verification Requirement
- Run `npm test` (`node scripts/test_simulator.js`) -> Must be 100% PASSED (exit code 0).
- Run `node scripts/test_adversarial_challenger2.js` -> Must be 100% PASSED (exit code 0).
- Run `node scripts/test_adversarial_challenger.js` -> Must be 100% PASSED (exit code 0).

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your report to `d:/Profile/AutoFillSheet/.agents/remediation_worker_1/handoff.md`.
