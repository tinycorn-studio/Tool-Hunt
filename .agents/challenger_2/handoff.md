# Handoff Report — Challenger 2

**Milestone**: M6 Verification & Adversarial Testing  
**Verdict**: 🔴 `REQUEST_CHANGES`  
**Date**: 2026-08-28T11:05:00Z  
**Author**: Challenger 2 (Empirical Adversarial Specialist & Critic)  

---

## 1. Observation

Direct empirical observations obtained via `node scripts/test_adversarial_challenger2.js` and inspection of `google-apps-script/Code.js` and `scripts/test_simulator.js`:

### Observation 1.1: CANCELLED Bounties Overwritten to RELEASED on Task Completion
- **Location**: `google-apps-script/Code.js` lines 1178–1188 and `scripts/test_simulator.js` lines 1269–1279:
  ```javascript
  if (targetStatus === "Hoàn thành") {
    const bountiesSheet = targetSs.getSheetByName("Bounties");
    if (bountiesSheet) {
      const bData = bountiesSheet.getDataRange().getValues();
      for (let b = 1; b < bData.length; b++) {
        if (bData[b][2] == ideaId) {
          bountiesSheet.getRange(b + 1, 9).setValue("RELEASED");
        }
      }
    }
  }
  ```
- **Execution Output**:
  ```
  ❌ [FAIL] [R4_BOUNTY] 3.6b [ADVERSARIAL FLAW DETECTION] CANCELLED bounties must not be overwritten to RELEASED on completion -> Actual status of cancelled bounty after completion: 'RELEASED' (expected 'CANCELLED')
  ```
- **Issue**: The update loop does not check whether `bData[b][8]` (status) was `"CANCELLED"`. When an idea transitions to `"Hoàn thành"`, all bounties for that `ideaId` are unconditionally marked `"RELEASED"`, erroneously unfreezing cancelled or refunded sponsorships.

### Observation 1.2: Multi-Currency Bounty Calculation ignores USD and POINTS
- **Location**: `google-apps-script/Code.js` lines 328–346 and `scripts/test_simulator.js` lines 729–748:
  ```javascript
  if (unit === "VND") {
    totalVnd += amount;
  } else if (unit === "COFFEE") {
    coffeeCount += amount;
  }
  ```
  And `badgeText` generation:
  ```javascript
  let badgeText = "";
  if (totalVnd > 0 || coffeeCount > 0) {
    const parts = [];
    if (totalVnd > 0) parts.push(`${totalVnd.toLocaleString("vi-VN")} VNĐ`);
    if (coffeeCount > 0) parts.push(`${coffeeCount} ☕`);
    badgeText = `💰 Quỹ thưởng: ${parts.join(" + ")} (${sponsors.size} nhà tài trợ)`;
  }
  ```
- **Execution Output**:
  ```
  ❌ [FAIL] [R4_BOUNTY] 3.8 [ADVERSARIAL FLAW DETECTION] Pledging USD and POINTS should produce non-empty badge text reflecting sponsor pledges -> Actual badgeText: '' (empty string because only VND and COFFEE are aggregated)
  ```
- **Issue**: In `ORIGINAL_REQUEST.md` (R4: ngân sách, điểm thưởng, coffee ☕) and `PROJECT.md` (F12: Support VND, USD, Coffee ☕, Points), USD and Points pledges are allowed by API and commands (`/bounty`), but `calculateTotalBounty` ignores them, leading to `badgeText = ""` when an idea only has USD or POINTS pledges.

### Observation 1.3: Unclaiming a Completed Task Permitted in FSM
- **Location**: `google-apps-script/Code.js` lines 1113–1146 and `scripts/test_simulator.js` lines 1200–1234:
  ```javascript
  function handleUnclaimTask(ideaId, userId, username, chatId, msgId, ss) {
    ...
    const isOwner = devId && devId.toString() === userId.toString();
    const canOverride = hasRole(userId, ["Manager", "Admin"], targetSs);

    if (!isOwner && !canOverride) {
      return { success: false, error: "UNAUTHORIZED_UNCLAIM" };
    }

    ideasSheet.getRange(targetRow, 11).setValue("Đang lấy ý kiến");
    ideasSheet.getRange(targetRow, 13).setValue("");
    ideasSheet.getRange(targetRow, 14).setValue("");
    ideasSheet.getRange(targetRow, 15).setValue("");
    ideasSheet.getRange(targetRow, 16).setValue("0%");
  ```
- **Execution Output**:
  ```
  ❌ [FAIL] [R2_FSM] 4.2 [ADVERSARIAL FLAW DETECTION] Unclaiming a completed task ('Hoàn thành') should be rejected to prevent resetting finished tools -> Actual result: unclaim succeeded and reset completed Idea #40 back to 'Đang lấy ý kiến'
  ```
- **Issue**: `handleUnclaimTask` checks ownership and Manager/Admin role, but does not check `currentStatus`. Calling `unclaim` on a task that is already `"Hoàn thành"` resets it to `"Đang lấy ý kiến"` and wipes the assigned developer and completion record, allowing finished tools to be re-claimed.

### Observation 1.4: Passing Scenarios Verified Empirically
- **Double-claiming Prevention**: Blocked with `ALREADY_CLAIMED` (Dev 1 claims, Dev 2 rejected).
- **Unauthorized Claim**: Regular members blocked with `UNAUTHORIZED_ROLE`.
- **Unauthorized Unclaim**: Non-owners blocked with `UNAUTHORIZED_UNCLAIM`.
- **Targeted Beta Notifications (R3)**:
  - Voter extraction under multiple interleaved unvote/re-vote cycles isolates exact active voters `[1001, 1003, 1005]` and excludes inactive voters `[1002, 1004, 1006]`.
  - HTTP 403 (bot blocked) does not crash or interrupt dispatch loop for subsequent voters.
  - Zero notifications sent to non-voters.
- **Negative & Zero Bounties**: Correctly rejected with `INVALID_AMOUNT`.

---

## 2. Logic Chain

1. **Premise 1 (Financial Integrity)**: `Bounties` sheet records pledges in statuses `PLEDGED`, `PAID`, `CANCELLED`, `RELEASED`. A pledge marked `CANCELLED` represents a refunded or voided contribution. Overwriting `CANCELLED` pledges with `RELEASED` upon task completion (Obs 1.1) creates a critical accounting defect where cancelled funds are marked as released for payout.
2. **Premise 2 (Specification Compliance)**: R4 in `ORIGINAL_REQUEST.md` and F12 in `PROJECT.md` require multi-currency support including USD, Points, and Coffee ☕. Currently, `calculateTotalBounty` only aggregates VND and Coffee, dropping USD and Points and generating an empty badge text (Obs 1.2).
3. **Premise 3 (Workflow FSM Integrity)**: The developer task lifecycle FSM transitions `[⏳ Đang lấy ý kiến] -> [🚀 Đang phát triển] -> [🧪 Beta Testing] -> [✅ Hoàn thành]`. Unclaiming is valid from `[🚀 Đang phát triển]` back to `[⏳ Đang lấy ý kiến]`. Allowing unclaim from `[✅ Hoàn thành]` (Obs 1.3) destroys the immutable completion state and permits re-opening finished tools without admin status override.
4. **Inference**: Because these 3 failure modes directly affect financial correctness (bounty payouts), requirement compliance (multi-currency crowdfunding), and lifecycle FSM consistency (reopening completed tools), the current implementation requires targeted remediation before production release.

---

## 3. Caveats

- Standard `npm test` runs 10 test suites (48 assertions) and passes 100% because baseline test suites only tested happy-path pledges (VND + Coffee) and did not include adversarial edge cases for cancelled bounty overrides, USD/Points aggregation, or unclaiming completed ideas.
- Concurrency simulation in `MockLockService` is in-memory and validates mutex locking calls (`waitLock` / `releaseLock`), but true high-concurrency stress testing across distributed Google Apps Script executions requires Google Cloud deployment.

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

### Required Action Items for Developers:
1. **Fix Bounty Release on Completion (`Code.js` & `test_simulator.js`)**:
   - In `handleDevStatusTransition`, change the update condition to only transition active pledges:
     ```javascript
     if (bData[b][2] == ideaId && bData[b][8] !== "CANCELLED") {
       bountiesSheet.getRange(b + 1, 9).setValue("RELEASED");
     }
     ```
2. **Expand Multi-Currency Aggregation (`Code.js` & `test_simulator.js`)**:
   - In `calculateTotalBounty`, track `totalUsd` and `totalPoints`, and include them in `badgeText` when `totalUsd > 0` or `totalPoints > 0`.
3. **Guard FSM Unclaim State (`Code.js` & `test_simulator.js`)**:
   - In `handleUnclaimTask`, check `currentStatus`: if `currentStatus === "Hoàn thành"`, return `{ success: false, error: "CANNOT_UNCLAIM_COMPLETED" }`.

---

## 5. Verification Method

To verify these findings independently, run the following commands in the workspace root:

```powershell
# 1. Baseline simulation test
npm test

# 2. Adversarial stress test harness
node scripts/test_adversarial_challenger2.js
```

### Invalidation Conditions:
- If `node scripts/test_adversarial_challenger2.js` executes and reports 0 failed tests after developer remediation, this verdict will be updated to `APPROVE`.
