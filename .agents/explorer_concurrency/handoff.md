# Handoff Report — Explorer 2: Concurrency & GAS Platform Limits Audit

**Author**: Explorer 2 (Concurrency & Platform Limits Auditor)  
**Date**: 2026-09-02T16:16:00Z  
**Target Milestone**: ToolHunt Enterprise Audit — Requirement R2  
**Report Artifact**: `c:\Users\Admin\Desktop\Projects\Tools\ToolHunt\.agents\explorer_concurrency\findings.md`

---

## 1. Observation

Direct code inspections and runtime simulations revealed the following concrete observations:

1. **Swallowed Lock Timeout**:
   - `google-apps-script/Code.js:573-577`:
     ```javascript
     const lock = LockService.getScriptLock();
     try {
       lock.waitLock(10000);
     } catch (err) {}
     ```
     `catch (err) {}` swallows the LockTimeoutException without checking `lock.hasLock()` or aborting. The script proceeds to execute writes unlocked.

2. **Long Network I/O Inside Script Lock**:
   - `google-apps-script/Code.js:573-603`:
     `LockService.getScriptLock()` is acquired at the start of `doPost` and released in `finally`. Inside this block, `checkAiDuplicate` (calling `UrlFetchApp` for DeepSeek/Gemini: lines 133, 166) and `notifyIdeaVoters` (calling Telegram API in a loop: lines 281–305) execute while holding the project-wide lock.

3. **Repeated O(N) Sheet Scans**:
   - `google-apps-script/Code.js:38, 67, 238, 250, 320, 377, 425, 468, 501, 1025, 1037...`:
     `configSheet.getDataRange().getValues()` is executed on every `getConfig()` call. In `notifyIdeaVoters` (lines 276–277, 299, 1411), `getConfig` is called for every voter sequentially.

4. **Cell-by-Cell Writes**:
   - `google-apps-script/Code.js:1109-1113` (`handleClaimTask`) and `1171-1175` (`handleUnclaimTask`): 5 individual `getRange().setValue()` calls per invocation.
   - `google-apps-script/Code.js:1216-1220` (`handleDevStatusTransition`): `bountiesSheet.getRange(b + 1, 9).setValue("RELEASED")` called inside a `for` loop across all matching bounty rows.

5. **Structural Sheet Mutation for Unvoting**:
   - `google-apps-script/Code.js:1053`: `votesSheet.deleteRow(voteRowIndex)` physically shifts all subsequent rows in Google Sheets upon every unvote.

6. **Synchronous Notification Dispatch Loop**:
   - `google-apps-script/Code.js:281-305`: `activeVoters.forEach(voter => sendTelegramMessage(voter.userId, msgText))` runs synchronously inside the webhook request without rate-limit backoff or continuation triggers.

7. **Telegram API 429 Unhandled**:
   - `google-apps-script/Code.js:1403-1417`: `callTelegramApi` uses `muteHttpExceptions: true` and parses JSON, but neither checks for HTTP 429 (`error_code === 429`) nor implements exponential backoff/sleep based on `retry_after`.

8. **AI Prompt Full-Dataset Context**:
   - `google-apps-script/Code.js:121-125`: All ideas in the database are mapped into `promptPayload.existingIdeas` and sent to the LLM endpoint without pre-filtering.

9. **Serverless In-Memory Global Map**:
   - `google-apps-script/Code.js:28, 763, 931, 954`: `PENDING_IDEAS_STORE = new Map()` stores pending ideas in ephemeral global memory across serverless invocations.

10. **Test Suite Execution Baseline**:
    - Ran `npm test` (`node scripts/test_simulator.js`): 48/48 passed.
    - Ran `node scripts/test_adversarial_challenger.js`: 55/55 passed.
    - Ran `node scripts/test_adversarial_challenger2.js`: 25/25 passed.

---

## 2. Logic Chain

1. **From Observation 1**: Because `waitLock(10000)` errors are caught by an empty `catch` block, any execution that times out waiting for the lock proceeds immediately to line 578 without mutual exclusion.
2. **From Observation 2 + Logic Step 1**: Because long-running external API calls (DeepSeek, Gemini, Telegram DM loops) run inside the lock for 3–30 seconds, concurrent requests waiting on the lock will regularly exceed the 10,000ms timeout.
3. **Synthesis (Race Condition & Corruption)**: Combining (1) and (2) proves that under normal concurrent usage, multiple executions will run concurrently in the mutation code, causing duplicate auto-increment IDs (`getLastRow()`), lost updates on vote tallies, and desynchronized sheets.
4. **From Observation 3 & 4**: Repeated `getDataRange().getValues()` and cell-by-cell `setValue()` calls in loops create massive Google Sheets RPC overhead, multiplying latency and extending lock hold times.
5. **From Observation 6 & 7**: Sending bulk Telegram messages in a synchronous `forEach` loop within `doPost` will (a) exceed Telegram's 30-second webhook timeout for >80 voters, (b) trigger Telegram HTTP 429 rate limits which are silently dropped, and (c) exceed GAS's hard 6-minute execution limit for >1,000 voters.
6. **From Observation 8**: Passing all ideas to LLM prompts causes token explosion, increases AI response latency, and inflates API costs as the sheet grows.
7. **From Observation 9**: Ephemeral V8 containers in GAS destroy in-memory globals between instances, causing nondeterministic cache misses if CacheService is not exclusively used.

---

## 3. Caveats

- **No Live Google Cloud Deployment**: Audit was performed via code inspection and Node.js GAS emulation sandbox (`scripts/test_simulator.js`). Live distributed Google Cloud multi-region testing was not directly executed, though code inspection directly references official Google Apps Script V8 runtime behavior and quotas.
- **Assumed Workload Profiles**: Quota exhaustion risk estimates assume active community usage (>100 active members, multiple daily idea transitions, >50 voters per top idea). Small private testing (1–5 users) will not readily manifest these limits.

---

## 4. Conclusion

The ToolHunt Enterprise backend exhibits **10 clear concurrency, data access, and platform limit vulnerabilities**:
- **1 Critical**: Swallowed LockService timeout permitting unlocked parallel mutations.
- **4 High**: Coarse-grained locking spanning external network I/O, uncached O(N) sheet reads, synchronous unbounded notification loops, and unhandled Telegram 429 flood control.
- **4 Medium**: Cell-by-cell write loops, physical `deleteRow` structural mutations, AI prompt context explosion, and ephemeral global `Map` state.
- **1 Low**: Unbounded dataset serialization in `doGet` without server-side pagination.

All findings are documented in detail with code snippets, failure scenarios, and concrete GAS-tailored remediations in `.agents/explorer_concurrency/findings.md`.

---

## 5. Verification Method

To independently verify the observations and findings:

1. **Verify Baseline Tests**:
   ```bash
   npm test
   node scripts/test_adversarial_challenger.js
   node scripts/test_adversarial_challenger2.js
   ```
2. **Inspect Code Locations**:
   - `google-apps-script/Code.js:573-577` (Lock timeout empty catch)
   - `google-apps-script/Code.js:573-603` (Global lock wrapping AI & Telegram)
   - `google-apps-script/Code.js:281-305` (Synchronous voter notification loop)
   - `google-apps-script/Code.js:1403-1417` (Telegram API wrapper missing 429 handling)
   - `google-apps-script/Code.js:1109-1113, 1216-1220` (Cell-by-cell writes in loops)
   - `google-apps-script/Code.js:1053` (`deleteRow` structural mutation)
3. **Invalidation Condition**:
   - Findings would be invalidated only if Google Apps Script provided automatic non-blocking background queueing for WebApp webhooks or if `LockService` automatically aborted execution on timeout (which Apps Script does not do when wrapped in `catch (err) {}`).
