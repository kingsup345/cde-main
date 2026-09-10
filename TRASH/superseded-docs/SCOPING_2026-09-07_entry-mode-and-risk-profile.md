# SCOPING — Limit/Market toggle + dynamic Risk Profile, for all 4 sim bots

**תאריך:** 2026-09-07 · **סטטוס:** בדיקה בלבד, לא בוצעה עריכה.
מה נדרש כדי ש: (א) ה-checkbox "כניסה לפי שער (לימיט)" ישלוט על limit⇄market **בכל 4 הבוטים**,
(ב) פרופיל הסיכון (low/medium/high) יעבוד דינמית **בכל 4 הבוטים**, (ג) ה-intraday יעבור למודל
`equity × 10%` כמו השאר.

---

## 0. Worker URL — `cde-main.onrender.com` (תיקון קטן)

אמרת שה-worker החדש תקין. אבל הקונפיג עדיין מצביע לישן:
| קובץ | שורה | ערך נוכחי | צריך |
|---|---|---|---|
| `.env` | `VITE_TRADING_API_URL` | `crypto-decision-engine-main-hev8.onrender.com` | `cde-main.onrender.com` |
| `render.yaml` | `CORS_ORIGIN` (בהערה `VITE_...`) | — | לוודא ש-`CORS_ORIGIN` ב-Render כולל את מקור ה-Netlify |
| `.env.example`, `DEPLOYMENT.md` | דוגמאות | hev8 | לעדכן ל-`cde-main` |

**לתיקון:** לעדכן `VITE_TRADING_API_URL` ב-`.env` **וב-Netlify Dashboard** → Clear cache and deploy.
(אם ה-`localStorage.workerConfig` בדפדפן עדיין מצביע לישן — "איפוס כתובת" בדף.)

---

## 1. Limit / Market toggle — מצב נוכחי לכל בוט

| בוט | מחולל הזמנות | fill נוכחי | קורא `proLimitEntries`? |
|---|---|---|---|
| **Pro** | `generateProOrders` | `limitEntries ? 'limit' : 'market'` (`proSimExecution.ts:321`) | ✅ **עובד** — `server/proSimEngine.ts:127` `limitEntries: config.proLimitEntries === true` |
| **Intraday** | `generateNewOrders` | *ללא שדה `fill`* → `fillDueOrders` מתייחס כ-**LIMIT** תמיד | ❌ לא |
| **Path** | `generatePrev4hRangeOrders` | `fill: 'market'` **קשיח** (`prev4hRangeExecution.ts:205`) | ❌ לא |
| **Bybit** | `generateTrendBreakoutOrders` → `placeLot` | `fill: 'market'` **קשיח** (`trendBreakoutExecution.ts:286`) | ❌ לא |

`SimBotConfig.proLimitEntries?: boolean` כבר קיים (`simExecution.ts:239`), עובר את `sanitizeSimConfig`
(בוליאני שלא ב-`SIM_CONFIG_BOUNDS` — נשמר as-is), ומגיע לכל 4 קונפיגי השרת. **הצינור קיים — רק 3 מחוללים לא קוראים אותו.**

### מה צריך לכל בוט

**Pro** — ✅ כלום. זה ה-template.

**Intraday** — קל (יש כבר `optimalEntryPrice` = מחיר לימיט עם maker-discount מ-`confirmEntry5M`):
- `OrderGenContext` (`simExecution.ts:~425`) += `limitEntries?: boolean`.
- `generateNewOrders` (`:678`): `const entryPrice = limitEntries && ev.optimalEntryPrice ? ev.optimalEntryPrice : ev.price;`
  ואת ה-order push (`:679`) += `fill: limitEntries ? 'limit' : 'market'` (או להשמיט → limit).
- קוראים: `server/simEngine.ts:159` += `limitEntries: input.config.proLimitEntries === true`;
  `src/hooks/useSimulationBot.ts:541` (ה-browser twin) — אותו דבר.

**Path + Bybit** — 🔷 **דרושה הכרעה.** אלה אסטרטגיות **פריצה** — ה-`entryRef` שלהן = `currentPrice`
(מחיר חי), ואין להן מושג "מחיר לימיט טוב יותר" (אין `optimalEntryPrice`, אין maker-discount).
- אם נסמן `fill: 'limit'` על order עם `signalPrice = currentPrice`, ב-`selectFillableOrders` הוא
  מתמלא **מיד** (`Math.min(market, signalPrice) ≈ market`) — כלומר "limit" ללא המתנה ובלי slippage,
  שזה לא באמת "המתנה שהשוק יגיע למחיר".
- אפשרויות:
  - **A. limit = המתנה לריטסט של רמת הפריצה.** Path: `signalPrice = prevHigh` (LONG) / `prevLow` (SHORT).
    Bybit: `signalPrice = donchianHighM15` / `donchianLowM15`. ההזמנה יושבת עד שהמחיר חוזר לרמה
    (ריטסט) — התנהגות משמעותית, אבל **משנה את האסטרטגיה** (פריצה מיידית → פריצה-עם-ריטסט).
  - **B. limit = discount קטן ב-ATR** (כמו intraday). פשוט, אבל שרירותי לאסטרטגיית פריצה.
  - **C. Path/Bybit נשארים market בלבד** — ה-checkbox פשוט לא זמין להם ב-UI (disabled + tooltip
    "אסטרטגיית פריצה — market בלבד"). הכי קרוב לכוונת האסטרטגיה המקורית.

---

## 2. פרופיל סיכון (low / medium / high) — מצב נוכחי

| בוט | מה `riskLevel` עושה היום |
|---|---|
| **Pro** | ✅ משפיע: `proMinConfidence(riskLevel, override)` — סף ביטחון שונה לכל רמה; וגם הקצאה (`proAllocationPercent` לפי alg.md §3/§6). |
| **Intraday** | ❌ כלום. הוסר מ-`resolveEntryBudget` ("riskLevel is confidence-gating only — never scales the position"). `ctx.riskLevel` מועבר ל-`generateNewOrders` אבל **לא נקרא**. |
| **Path** | ❌ כלום. `pathSimExecution.ts` (שקורא `riskLevel` דרך `pathEntryBudget`) הוא **dead code** — Path החי משתמש ב-`prev4hRangeExecution.ts` שלא נוגע ב-`riskLevel`. |
| **Bybit** | ❌ כלום. `trendBreakoutExecution.ts` לא מזכיר `riskLevel`. |
| — | `riskLevelSizingMultiplier` (0.6 / 1.0 / 1.5, `simExecution.ts:339`) — **פונקציה מתה, אין קורא.** |

### 🔷 סתירה עם החלטה #12

החלטת קודם מפורשות: *"שום מנגנון downstream — confidence, Kelly, **riskLevel**, ATR, SL distance,
MIN_ORDER או execution budget — לא רשאי לשנות את ה-target של 10%. הוא יכול לאשר, לחסום, להגביל או למדוד."*

לכן פרופיל הסיכון **לא יכול** לשנות את גודל הפוזיציה (10%). מה שהוא **כן** יכול לשלוט בו דינמית,
בלי לסתור את #12:

| ממד | low | medium | high | סותר #12? |
|---|---|---|---|---|
| **סף ביטחון** (פחות/יותר עסקאות) | +8 | 0 | −8 | לא — זה מה ש-Pro כבר עושה |
| **מס' פוזיציות מקבילות** | 3 | 5 | 7 | לא — גודל הפוזיציה נשאר 10% |
| **futures / SHORT מותר** | spot בלבד | כן | כן + `maxFuturesPositions` גבוה | לא |
| **מרחק SL/TP** (מודל 1.8/3.0 → מכפיל) | ×0.8 | ×1.0 | ×1.3 | **כן חלקית** — משנה R:R של המודל הקבוע. דורש אישור נפרד. |
| **גודל פוזיציה** (×0.6/1.0/1.5) | — | — | — | **❌ אסור** לפי #12 |

**דרושה הכרעה:** אילו ממדים פרופיל הסיכון שולט בהם, ואילו ערכים, ולכל 4 הבוטים אחיד או per-bot?
(ל-Pro כבר יש סף-ביטחון + הקצאה; אם נאחד, ה-Pro צריך לשמור על לוגיקת alg.md שלו או להתיישר?)

---

## 3. Intraday → מודל `equity × 10%` (מההודעה הקודמת)

`resolveEntryBudget` (`simExecution.ts:312`) כרגע:
```ts
const target  = input.cash * POSITION_TARGET_PCT;    // ← cash, לא equity
const ceiling = computeEntryBudget(input.cash, ...); // = min(cash × 10%, $1000)  ← תקרת $ קשיחה
return Math.min(kellySized, Math.min(ceiling, target));
```
תוצאה: ב-equity $1,000 רק פוזיציה 1 נפתחת ($100); 2-7 מדולגות כי `cash` יורד. ב-equity גדול —
כל פוזיציה נחתכת ל-$1,000 (2%). **סותר #12 ("10% of equity, always").**

**מה צריך:**
- `EntryBudgetInput` += `equity: number`.
- `resolveEntryBudget`: `const target = input.equity * POSITION_TARGET_PCT;` `const budget = Math.min(kellySized, target, input.cash);` — `cash` **מגביל** בלבד, לא מעצב. להסיר את תקרת ה-$1000/$500 מהנתיב הזה (או להשאיר כ-operator ceiling מפורש בלבד).
- `generateNewOrders:632` — כבר יש `ctx.equity`, רק להעביר.
- קוראים: `server/simEngine.ts` (יש `input.equity`), `useSimulationBot.ts` (יש `equity`).
- 3 הבוטים האחרים כבר עושים `ctx.equity * positionTargetPct` — אין שינוי.

---

## 4. סיכום קבצים + הכרעות פתוחות

### קבצים שישתנו (אם מבצעים הכל)
| קובץ | שינוי |
|---|---|
| `packages/engine/src/services/simExecution.ts` | `EntryBudgetInput.equity`; `resolveEntryBudget` → equity-based; `OrderGenContext.limitEntries`; `generateNewOrders` fill + entryPrice |
| `server/simEngine.ts` | להעביר `limitEntries` (ו-`equity` כבר עובר) |
| `src/hooks/useSimulationBot.ts` | להעביר `limitEntries` + `equity` ל-`generateNewOrders` |
| `packages/engine/src/services/prev4hRangeExecution.ts` | `limitEntries` בקונטקסט; `fill` דינמי (תלוי הכרעה A/B/C) |
| `packages/engine/src/services/trendBreakoutExecution.ts` | אותו דבר |
| `server/pathSimEngine.ts`, `server/bybitSimEngine.ts` | להעביר `limitEntries: config.proLimitEntries === true`; גם לתקן `?? 2` → `?? SIM_BASE_DEFAULTS.maxPositions` (7) |
| `packages/engine/src/services/simDefaults.ts` | (אם פרופיל סיכון שולט ב-maxPositions/confidence) — טבלת riskLevel → ערכים |
| מחוללי ההזמנות / `intradayParams` | (אם riskLevel שולט בסף ביטחון או SL mult) |
| `src/components/trading/SimulationEngineColumn.tsx` | תווית ה-checkbox: הסרת "Bot Pro only"; אם C — disable ל-Path/Bybit |
| `.env` / `.env.example` / `render.yaml` / `DEPLOYMENT.md` | `VITE_TRADING_API_URL` → `cde-main.onrender.com` |
| טסטים | `positionSizing.test.ts`, `thresholdSourceOfTruth.test.ts`, ואולי חדשים ל-limit/market ול-riskLevel |

### הכרעות שצריך ממך לפני ביצוע
1. **Path/Bybit limit:** A (ריטסט לרמת הפריצה) / B (ATR discount) / **C (market בלבד, checkbox disabled)**?
2. **פרופיל סיכון — אילו ממדים הוא שולט בהם?** (סף ביטחון? מס' פוזיציות? futures? SL mult?) ובאילו ערכים?
3. **אחיד או per-bot?** (Pro כבר עושה סף-ביטחון+הקצאה משלו — לשמור או להתיישר?)
4. **תקרת ה-$1,000/$500** ב-`computeEntryBudget` — להסיר לגמרי, או להשאיר כ-operator ceiling נפרד?
5. **SL/TP mult לפי riskLevel** — האם מותר לגעת במודל הקבוע 1.8/3.0? (זה שינוי אסטרטגיה.)

---

## ✅ בוצע (2026-09-07)

| הכרעה | מה נבחר | מימוש |
|---|---|---|
| 1 | **B — בזול** (בלי מתמטיקת ATR): limit = ההזמנה נחה על מחיר האות של האסטרטגיה (Intraday: `optimalEntryPrice`; Path/Bybit: `entryRef` → fill על pullback, אחרת פוקע) | `fill: ctx.limitEntries ? 'limit' : 'market'` ב-`generateNewOrders` / `generatePrev4hRangeOrders` / `placeLot` |
| 2 | **מספר פוזיציות** בלבד (לא size, לא SL — תואם §12) | `riskLevelToMaxPositions()` ב-`simDefaults.ts`: low 3 / medium 5 / high 7 |
| 3 | **per-bot** — כל בוט עם `config.riskLevel` משלו; Pro שומר בנוסף על סף-ביטחון+הקצאה של alg.md | `simBotDefaults` מחווט `maxPositions` לכולם; `applySimConfigPatch` מחשב מחדש בכל שינוי config |
| 4 | **להסיר** את תקרת ה-$1,000/$500 | `resolveEntryBudget` → `equity × POSITION_TARGET_PCT` capped by cash; לא קורא יותר ל-`computeEntryBudget` |
| 5 | **לא בוצע** — לא נוגעים במודל הקבוע 1.8/3.0 (שינוי אסטרטגיה, ו-#2 כבר נותן ל-dropdown אפקט) |

**מצב:** typecheck (app+worker) ✓ · 341 טסטים ✓ · lint ✓. דורש rebuild של Render **וגם** Netlify.
`VITE_TRADING_API_URL` עודכן ל-`https://cde-main.onrender.com` ב-`.env` (וצריך גם ב-Netlify Dashboard → Clear cache and deploy).
