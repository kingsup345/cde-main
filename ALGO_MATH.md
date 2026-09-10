# מבנה האלגוריתם והמתמטיקה — 4 בוטי הסימולציה

> תצוגת **מבנה + נוסחאות**. הגרסה עם הפניות-שורה מדויקות לקוד היא
> `BOTS_REFERENCE.md` — עדכן אותה כשחישוב משתנה. כאן: איך הצינור בנוי ומה
> המתמטיקה בכל שלב.
> נכון ל-2026-09-10. סימולציה בלבד — אף בוט לא שולח פקודה אמיתית.

הבוטים בדף `/simulation-bot`:

| מזהה | שם בממשק | קובץ סיגנל | קובץ ביצוע |
|---|---|---|---|
| `intraday` | מנוע חדש · Multi-Timeframe | `intradayEngine.ts` (+ regime/setup/entry/risk) | `simExecution.ts` |
| `pro` | Pro · alg.md | `proAlgEngine.ts` | `proSimExecution.ts` |
| `path` | נתיב 4H · טווח נר קודם | `prev4hRange.ts` | `prev4hRangeExecution.ts` |
| `bybit` | Bybit · TrendBreakout | `trendBreakout.ts` | `trendBreakoutExecution.ts` |

ארבעתם רצים כ-4 מופעים **נפרדים לחלוטין** של אותה תשתית
(`server/simEngineFactory.ts` → `createGenericSimEngine`): לכל אחד `cash`,
`positions`, `history` ו-KV נפרדים. משותפים רק **קבועים** (ספי drawdown, תקרת
נכס) ו**נתוני שוק** (נרות) — לא state.

---

## 0. הצינור המשותף (כל טיק, כל בוט)

```
נרות (Bybit/Binance/CoinGecko)
   │
   ▼
buildEvaluations()  ──► לכל סימבול: SignalEvaluation { willExecute, confidence, status, price, stopLoss, takeProfit1/2, optimalEntryPrice, ... }
   │                     ממויין לפי confidence יורד
   ▼
generateOrders()    ──► שערים קשיחים → פקודות entry/exit
   │                     (מקצה סלוטים/מזומן לאיתות החזק קודם)
   ▼
pending[]  ──► selectFillableOrders()  ──► fillDueOrders()
   │            limit: מילוי רק בחציית מחיר, TTL 2h    market: מילוי אחרי executionDelaySec
   ▼
positions[]  ──► applyFundingAccrual() → mark-to-market → equity
```

**מקור אמת יחיד:** אותו `SignalEvaluation` מזין גם את פאנל ההמלצות ב-UI וגם
את מנוע הביצוע — אין פער בין מה שמוצג למה שמבוצע.

### 0.1 שלושת השערים הקשיחים המשותפים
לכל בוט מותר **בדיוק שלושה** וטו קשיח; כל השאר נכנס לתוך מספר ביטחון אחד
שמושווה לסף אחד:
1. **NO_DATA** — אין מספיק נרות לחישוב.
2. **CIRCUIT_BREAKER / CAPITAL_FLOOR** — הגנת equity ברמת התיק.
3. **NO_ROOM** — אין סלוט פנוי או אין מזומן פנוי.

### 0.2 מעגל שבירה (משותף, קבוע יחיד)
```
dailyDrawdownPercent  ≥ 8%   → חסימת כניסות חדשות   (DAILY_DRAWDOWN_BLOCK_PERCENT)
weeklyDrawdownPercent ≥ 15%  → נעילה                (WEEKLY_DRAWDOWN_LOCK_PERCENT)
```
נמדד על ה-equity של כל בוט בנפרד. חוסם **פתיחה** בלבד — לא סוגר קיים.

### 0.3 שער הקורלציה (Intraday · Path · TrendBreakout)
```
ρ = Pearson על log-returns של 72 נרות H1 (רצפה 36, מתכווץ לפי atrPercentile)
effective = (אותו כיוון) ? ρ : −ρ
נחסם כאשר   |{מוחזקים עם effective ≥ 0.7}| ≥ DEFAULT_MAX_CORRELATED (3)
```
**כשאי-אפשר למדוד (2026-09-10):** `evaluateCorrelationGate` מחזיר
`allowed: true, abstained: true` כשאין היסטוריית נרות חופפת. עד לתאריך הזה כל
הקוראים קראו רק ב-`allowed` והתעלמו מ-`abstained` — כלומר "לא הצלחתי לבדוק"
בוצע כ-"אלה בלתי-תלויים". הגרוע: השער נמנע הכי הרבה ב-**cold start**, בדיוק
כשכל הסלוטים פנויים והגודל בתקרה. בפועל: intraday פתח 6 long בגודל מלא תוך 4
דקות (60% מההון), כולם נסגרו יחד → -$102 מתוך ריצה של -$107.
עכשיו `blocksOnAbstention` חוסם ערימה **לא-מאומתת** מעבר לאותו קאפ (3);
הכניסות הראשונות עדיין עוברות, אחרת cold start היה נתקע לנצח.
**`prev4hRangeExecution` לא היה בו שער קורלציה בכלל** עד 2026-09-10 (למרות
הערה ב-TrendBreakout שטענה אחרת). `proSimExecution` עדיין ללא — הוא לא מקבץ
כניסות בפועל.

### 0.4 slot preemption (משותף, כל 4 הבוטים)
פקודת entry שמחכה למחיר (limit נח, טרם מולאה) **אינה** תופסת סלוט באופן
מוחלט: איתות טרי חזק יותר במטבע אחר **מפנה** אותה אם
`confidence_חדש ≥ confidence_נח + SLOT_PREEMPT_MARGIN (5)`. לעולם לא מפנה
פוזיציה מלאה. `pickPreemptibleEntryOrder()` בוחר את הפקודה הנחה החלשה ביותר.

---

## 1. Intraday · Multi-Timeframe

מנוע רב-טיימפריים: **1H** רג'ים → **15M** setup → **5M** אישור כניסה.

### קלט נדרש
| TF | מינימום נרות |
|---|---|
| H1 | 200 |
| M15 | 300 |
| M5 | 500 |

מתחת לזה → `NO_DATA`.

### סדר השערים (§55 — כל שער עוצר את הראשון שנכשל)
```
NO_DATA → CIRCUIT_BREAKER → EXPOSURE → NO_REGIME → VOLATILITY →
LIQUIDITY → SPREAD → NO_SETUP → NO_ENTRY → RISK → COST → DATA_MISMATCH
```
**RISK לפני COST:** `buildRiskPlan` מייצר Entry/SL/TP1 סופיים, ו-`evaluateCostEdge`
+ כל מספרי ה-R:R מחושבים על אותם ה-levels בדיוק. `DATA_MISMATCH` = שער
שעוצר SIGNAL אם ניתוח העלות רץ על levels שונים מהפקודה (סטייה > `1e-8`).

### מתמטיקת הביטחון
```
setupScore  = 100 · Σ wᵢ·factorᵢ      wᵢ: trend .25, momentum .20, location .20, participation .15, structure .20
entryScore  = ציון אישור 5M (0–100)
confidence  = round( (setupScore + entryScore) / 2 )
```
ספים: `setupScoreMin = 46`, `entryScoreMin = 50`. סף תפעולי מעליהם:
`BOT_MIN_CONFIDENCE` (כרגע 60) — נבדק **אחרי** אישור SIGNAL; דחייה = `MIN_CONFIDENCE`.

### מתמטיקת הסטופ / היעד (`buildRiskPlan`, מודל אחוזים)
```
SL  = ההדוק מבין:  atr5 · maxStopAtrMult
                   |entry − (stopReference ∓ buffer)|          ← ענף מבני
      ואז clamp ל-[minStopPercent 0.12% , maxStopPercent 1.5%] ואז תקרת MAX_LOSS_PERCENT 4.2%
      MEAN_REVERSION: רצפה נוספת meanReversionMinStop{AtrMult,Percent}

TP1 = הרחוק מבין:  |entry − SL| · tp1RewardRisk
                   |targetReference − entry|
                   tp1FloorDistance = max(1.5%·entry, 1.5·|entry−SL|)   ← הרצפה, לכל setup פרט ל-MEAN_REVERSION (שם 0; היעד = VWAP)

TP2 = TP1 · (tp2RewardRisk / tp1RewardRisk)      [SIM: tp2RewardRisk 2.5→2.2]
```
`TP1_EXIT_FRACTION = 0.5` — חצי נסגר ב-TP1, השאר רץ.

### מתמטיקת הגודל (`buildRiskPlan`)
```
targetNotional = sizingBase · positionTargetPct (10%)         ← ללא תלות במרחק הסטופ
riskUsd        = targetNotional · riskPercent
```
`sizingBase` = ההון ההתחלתי בסימולציה (`useFixedSizingBase`).
תקרות: FUTURES margin ≤ `sizingBase·4%`, מינוף ≤ 5x · נכס בודד ≤ `sizingBase·10%`
· חשיפה כוללת ≤ `sizingBase·80%` (סימולציה; 20% בבוט האמיתי) · הזמנה
מינימלית **$100** (סימולציה) / $5 (בוט אמיתי).

### שער `RISK_VS_COST` (מתוך `evaluateCostEdge`)
```
נדחה כאשר   riskPercent < minStopCostMultiple · totalCostPercent
```
סטופ צר מכדי לשרוד את סבב העמלות+slippage שלו. מכפיל: **2.0 בוט אמיתי · 2.5 סימולציה**.
`entryIsLimit` מוברר → MARKET (ברירת מחדל בסימולציה) מתומחר taker + slippage מלא,
לא כמו limit נח.

### R:R (תמיד מ-3 המספרים של `buildRiskPlan`)
```
riskPercent   = |entry − SL|  / entry · 100
rewardPercent = |TP1 − entry| / entry · 100
grossRR       = rewardPercent / riskPercent
netRR         = (rewardPercent − totalCostPercent) / riskPercent      ← נדרש ≥ minRewardRisk 1.2
```

### יציאות (`intradayExit.ts`, לפי עדיפות)
- **Stop / TP1 / TP2** לפי הרמות למעלה.
- **Trailing** אחרי התקדמות: `trailDistance = min(trailingAtrMult·atr5, trailingMaxRMult·|entry−SL|)`,
  `trailStop = anchor ∓ trailDistance` (R-capped — לא מתרחב מעבר ל-1R).
- **Reversal:** רק אם `progressR ≥ tp1RewardRisk` **או** `progressR ≤ reversalMaxLossR (−0.7)`,
  ובנוסף `reversalSignal` + `entryConfirmed` + `setupScore ≥ 70`.
- **Time stop:** `heldMs ≥ timeStopMs` **וגם** `progressR < timeStopMinProgressR`
  **וגם** `mfeR < timeStopStagnantMfeR (0.7)` — נסגר רק אם גם עומד וגם לא נגע ברווח.

---

## 2. Pro · alg.md

מנוע אינדיקטורים חד-טיימפריים. `MIN_PRO_CANDLES = 40`.

### מתמטיקת הביטחון (Score 0–100)
8 אינדיקטורים, כל אחד פולט אות (buy/sell/hold) + ביטחון פנימי 0–100 + משקל:

| אינדיקטור | משקל |
|---|---|
| RSI(14) | 15 |
| MA(20) | 15 |
| MACD | 18 |
| Bollinger | 12 |
| Stochastic | 8 |
| Volume Profile | 15 |
| מגמת נפח | 10 |
| שינוי 24h / מומנטום | 12 |
| **Σ** | **105** |

```
weighted     = weight · (signalConfidence / 100)
buyScore    += weighted   (אם האות buy)     ; sellScore / holdScore בהתאמה
totalWeight += weight

maxScore    = max(buyScore, sellScore, holdScore)
secondScore = הגבוה הבא

dominance = maxScore / totalWeight
margin    = (maxScore − secondScore) / maxScore
coverage  = min(1, totalWeight / PRO_COVERAGE_FULL_WEIGHT)      PRO_COVERAGE_FULL_WEIGHT = 88

confidence = 50 + (dominance·45 + margin·25)·coverage − (1 − coverage)·10
```
מוגבל לטווח סביר, מוצג כאחוז. **זה Score, לא הסתברות** — "70%" = 70 מתוך 100
בציון משוקלל.

### סף כניסה
**שטוח 70** (`PRO_DEFAULT_ENTRY_CONFIDENCE`), ללא תלות ב-`riskLevel`.
`PRO_CONFIDENCE_BY_RISK` (55/40/25) קיים כרפרנס בלבד — `proMinConfidence()`
מתעלם. `minConfidenceOverride > 0` דורס את ה-70.

### שערי כניסה (`applyProEntryGates`, אצווה ממוינת ביטחון-יורד)
```
1. בוט פעיל?  2. ORDER_QUEUED  3. ALREADY_HELD  4. BELOW_THRESHOLD
5. NO_SLOTS (occupiedSlots ≥ maxPositions — עם slot preemption §0.3)
6. NO_PRICE  7. NO_BUDGET
```

### מתמטיקת הגודל
```
budget = min(
  initialAmount · (confidence > 80 ? 15% : 10%),      ← proAllocationPercent()
  projectedCash,
  equity · 8%                                          ← PER_ASSET_EXPOSURE_CAP_PERCENT
)
```
מתחת ל-$100 → מעוגל כלפי מעלה ל-$100 אם יש מזומן ו-equity ≥ $100.

### כניסה — Market / Limit (`proLimitEntries`)
- **Market (ברירת מחדל):** מילוי מיידי, `market · (1 ± slippage%)` (תמיד לרעת הבוט).
- **Limit:** מנוחה במחיר "אופטימלי" =
  ממוצע משוקלל של `Bollinger_lower, MA20, VAL, POC, price·0.99`
  (`calculateOptimalEntryPrice`), מעוגל ב-`roundToPriceScale`. TTL 2h.

### יציאה
```
Stop Loss   = −4.2%   (PRO_STOP_LOSS_PERCENT)
Take Profit = +3.0%   (PRO_TAKE_PROFIT_PERCENT)
Flip-to-SELL: איתות SELL בביטחון ≥ סף → סוגר את כל הפוזיציה
```
Spot בלבד — אין שורט.

---

## 3. Prev-4H Range · נתיב 4H

פורץ את הטווח של **נר ה-4H הקודם שנסגר לגמרי** (אין lookahead), בכיוון מגמת EMA20(4H).

### קלט נדרש
```
PREV4H_MIN_H4_BARS    = 24
PREV4H_MIN_H1_CANDLES = 96   (= 24·4; aggregateToH4 פולט בר רק כשכל 4 ה-H1 נסגרו)
```

### חלון וזיהוי
```
prev = h4[last]
H = prev.high · L = prev.low · mid = (H+L)/2 · range = H−L · rangePct = range / prev.close
```
פועל רק כש-`barOpenFor(now) === prev.timestamp + BAR_MS` (החלון שמיד אחרי `prev`).
H1 לא עדכני → `STALE_BAR`. פוזיציה אחת לסימבול לכל חלון.

### פילטרים
```
מגמה:  ema = EMA20(4H closes)
       trendUp  = ema > emaPrev  AND  prev.close > ema        (trendDown = מראה)
       אף אחד → AGAINST_TREND
טווח:  rangePct ∈ [minRangePct 0.005 , maxRangePct 0.08]      אחרת RANGE_TOO_TIGHT / RANGE_TOO_WIDE
פריצה: trendUp AND live > H  → LONG (SPOT)
       trendDown AND live < L → SHORT (FUTURES 1x)
       אחרת → NO_BREAKOUT (מצב ARMED)
```

### מתמטיקת הביטחון (Score 0–100 — לא הסתברות)
```
breakoutDist = מרחק המחיר החי מעבר ל-H (או מתחת ל-L)
maxExtension ≈ 0.1818 · range
bandPos      = מיקום יחסי של rangePct בטווח [minRangePct, maxRangePct]  (0 = צר, 1 = רחב)

confidence = 40
           + 30 · clamp01(1 − breakoutDist / (range · maxExtension))    ← מגע נקי גבוה, כניסה מתוחה נמוך
           + 20 · trendStrength
           + 10 · clamp01(1 − bandPos)                                  ← טווח צר גבוה
```
**הרכיבים `breakout` ו-`range` הופכו 2026-09-10.** קודם הם תגמלו את
ה-setups הגרועים (פריצה מתוחה, טווח בינוני), ומכיוון שההזמנות נוצרות לפי
ביטחון יורד — הבוט מילא קודם את הגרועים. עכשיו: מגע נקי + טווח צר = ביטחון
גבוה. `ENTRY_TOO_EXTENDED` (`breakoutDist > range·maxExtension`) נשאר החסם
הקשה. סף כניסה `minConfidence = 55`.

### מתמטיקת הגודל
```
R        = |entry − mid| = range / 2
riskUsd  = equity · riskPerTrade (0.5%)
notional = riskUsd / (R / entry)
```
נחתך: נכס בודד 8% · חשיפה כוללת 20% · רצפת $100. בלי scale-in.

### יציאה
```
SL   = mid, נחתך לתקרת 4.2%
TP1  = max(R · tpRangeMult, tp1FloorDistance)      ·  50% נסגר
TP2  = TP1 · 1.5
הרץ (50% שנותר):
   לפני TP1 → SL רגיל (mid)
   אחרי TP1 → runnerStop = max(SL, entryPrice)  [BREAK-EVEN, 2026-09-10]  → רץ ל-TP2 / time-stop / היפוך EMA
Time stop: now ≥ pos.openTimestamp + BAR_MS  (4 שעות)
היפוך:     EMA20(4H) התהפך לכיוון הנגדי (רק היפוך מובהק, לא בר שטוח)
```
**הענף הישן "חזרה מתחת ל-TP1 → סגור" נמחק** — hair-trigger שגזז את הרץ
לפני TP2.

---

## 4. TrendBreakout · Bybit — סימולציה בלבד

אסטרטגיה עצמאית לחלוטין (לא קונצנזוס, לא משתמשת בסיגנלים של האחרים).
מפרט מלא: `TRENDBREAKOUT_SPEC.md`.

### קלט
H1 ≥ 200 · M15 ≥ 300 · M5 ≥ 30. רק נרות **סגורים**.

### שלבים
```
מגמה (H1):   LONG רק אם Supertrend(10,3)=BULL  AND  EMA50>EMA200  AND  close>EMA50   (SHORT = מראה; אחרת NEUTRAL)
פריצה (M15): close > Donchian-High(20) הקודם  AND  volume ≥ VolumeSMA(20)·1.2  AND  כיוון = מגמת H1
אישור (M5):  LONG: EMA9>EMA21  AND  close>EMA9  AND  |מחיר − מחיר-פריצה| ≤ 1.0·ATR(M5)   אחרת ENTRY_TOO_EXTENDED
```

### מתמטיקת הביטחון (Score 0–100, §7)
```
confidence = 25·[H1 Supertrend]  + 20·[H1 EMA]  + 25·[פריצת M15]  + 15·[אישור נפח]  + 15·[אישור M5]
```
כל רכיב 0/חלקי/מלא. סף כניסה `MIN_CONFIDENCE = 70`.

### מצב מילוי — MARKET בלבד (2026-09-10)
TrendBreakout **לא קורא** ב-`proLimitEntries`. לימיט נח **מתחת** לשוק הוא בחירה
שלילית לפריצה: הוא מתמלא רק כשהפריצה חוזרת דרך הרמה (כלומר נכשלת), וכל פריצה
שרצה — בדיוק מה שהאסטרטגיה קיימת בשבילו — לא מתמלאת כלל. בפועל: 5 כניסות,
**0 TP**, 3 יציאות היפוך מגמה. מנועי pullback/mean-reversion (Intraday, Pro)
כן נחים מתחת לשוק בלגיטימיות; פריצת Donchian לא יכולה. `ENTRY_TOO_EXTENDED`
(§5) הוא מה ששומר על הכניסה, לא מצב המילוי.

### מתמטיקת הגודל (§14–15)
```
riskUsd      = equity · 0.5%
fullNotional = riskUsd / (|entry − SL| / entry)          SL = entry ∓ 1.5·ATR(M15)
```
נחתך: נכס בודד ≤ 8% · חשיפה כוללת ≤ 20%. **בגלל ה-SL ההדוק, תקרת ה-8% היא
לרוב האילוץ הכובל — מכוון.**

### Scale-in (§11) — מודל lots
`fillDueOrders` לא יודע להוסיף לפוזיציה → כל scale הוא `SimPosition` נפרד.
עסקה לוגית אחת = כל ה-lots עם אותו נכס-בסיס + כיוון, אותו SL/TP לוגי, נסגרים יחד.
```
lots:   50% / 30% / 20% מ-fullNotional
SCALE_2: רק מעל +1.0R  + מגמה תקפה
SCALE_3: רק מעל +1.5R  + Supertrend עדיין בכיוון
לעולם לא מוסיפים בהפסד (אין מרטינגייל).
SCALE_1 מעוגל כלפי מעלה ל-$100; SCALE_2/3 שנחתכים מתחת ל-$100 → מדולגים.
```

### מתמטיקת ניהול הסטופ (§12 — מחושב מחדש בכל tick)
```
מ-entry קבוע + highest/lowest ש-factory עוקב אחריו (הקוד לא נוגע ב-pos.stopLoss):
   +1.0R  → סטופ אפקטיבי = entry (break-even)
   +1.5R  → טריילינג  extreme ∓ 1.5·ATR(M15)   (מונוטוני בכיוון הרווח, לא מתרופף)

הגבלת סיכון ל-scale-in (2026-09-09):
   worstEntry = max(entryⁱ)  ל-long / min ל-short
   scaleFloor = worstEntry ∓ R
   stop       = max(stop, scaleFloor)  ל-long        ← אף לוט לא מסתכן > 1R

בלם חירום per-lot:
   worstLotLossPct = max( −pnl%(entryⁱ, live) )
   אם reachedStop(capLevel)  OR  worstLotLossPct ≥ MAX_LOSS_PERCENT (4.2%)  → יציאת חירום
```

### מתמטיקת ה-TP (§10)
```
cappedR         = |entryRef − SL|
minTp1Distance  = tp1FloorDistance(entryRef, cappedR)
atrTp1Distance  = cappedR · tpRMultiplier
TP1 = הרחוק מבין minTp1Distance ו-atrTp1Distance
```
(לפני 2026-09-06: השתמש ב-`rUnit` לא-חתוך → יעד רחוק מדי כשה-ATR התרחב.)

### יציאות (§13)
סטופ אפקטיבי נחצה · TP (2R) · היפוך H1 Supertrend נגד הפוזיציה · Time Stop
אחרי 24 נרות H1. setup שהתבטל → חוסם scale-in נוסף, לא סוגר.

### SHORT
אי-אפשר לשרטט ב-SPOT → SHORT = `FUTURES` מינוף **1x**. `maxFuturesPositions`:
bybit = 3, path = 2, pro = 0.

---

## 5. מתמטיקת העלות והסיכון המשותפת (`simExecution.ts`)

### מילוי
```
fillPrice(buy)  = market · (1 + slippagePercent/100)      ← תמיד לרעת הבוט
fillPrice(sell) = market · (1 − slippagePercent/100)
```
פקודה נכנסת ל-`pending` עם `executeAt = now + executionDelaySec`. limit:
מילוי רק כשהמחיר חוצה את ה-signalPrice, TTL `LIMIT_ORDER_TTL_MS` (2h).

### עמלות
`entryFee` + `exitFee` על הנוציונל (taker לשוק). `totalCostPercent` = סכום
כל הרגליים כאחוז מ-entry, ונכנס ל-`netRR`.

### Funding (FUTURES פתוחות בלבד, כל 4 הבוטים)
```
funding = notional · lastFundingRate · (elapsed / 8h)
```
מנוכה בכל tick לפני חישוב ה-equity. LONG משלם כשהריבית חיובית, SHORT מקבל.
חלון הצבירה חסום ל-8h (השבתת worker ארוכה לא מחייבת סכום חד-פעמי). Pro/Path
spot בלבד → 0 בפועל.

### מכפיל סיכון אדפטיבי (`adaptiveRisk.ts`)
מכפיל את ה-`riskPercent` לפי streak הפסדים/רווחים אחרון — מקטין גודל אחרי
רצף הפסדים, מחזיר בהדרגה אחרי רווח. משותף לכל 4 הבוטים.

### קבועים משותפים (מקור יחיד — `intradayParams.ts`)
| נושא | ערך | קבוע |
|---|---|---|
| Drawdown יומי | 8% | `DAILY_DRAWDOWN_BLOCK_PERCENT` |
| Drawdown שבועי | 15% | `WEEKLY_DRAWDOWN_LOCK_PERCENT` |
| תקרת נכס בודד | 8% | `PER_ASSET_EXPOSURE_CAP_PERCENT` |
| תקרת הפסד לעסקה | 4.2% | `MAX_LOSS_PERCENT` |
| רצפת הזמנה (סימולציה) | $100 | `MIN_SIM_ENTRY_USD` |
| מרווח preemption | 5 נק' ביטחון | `SLOT_PREEMPT_MARGIN` |

---

## 6. איך "תוצאה בריאה" נראית

| בוט | הרוב המכריע של הסימבולים | SIGNAL רק כאשר |
|---|---|---|
| Intraday | `NO_SETUP` / `NO_ENTRY` | 12 השערים עברו + `confidence ≥ 60` |
| Pro | `HOLD` (7 מ-8 האינדיקטורים mean-reversion) | אות דומיננטי + `confidence ≥ 70` |
| Prev-4H | `AGAINST_TREND` / `NO_BREAKOUT` | מגמה + פריצה + טווח בתחום + `confidence ≥ 55` |
| TrendBreakout | `H1_TREND_NEUTRAL` / `BREAKOUT_NOT_CONFIRMED` | מגמה + פריצה + נפח + אישור M5 + `confidence ≥ 70` |

כל `NO_SIGNAL` **חייב** לשאת סיבה מפורשת. Drawdown חורג → הבוט חייב להפסיק
לפתוח (לא לסגור קיים).

---

## 7. פערים ידועים (לתעד, לא לתקן)
- **Pro `PRO_COVERAGE_FULL_WEIGHT = 88`** מול Σמשקלות בפועל **105** — לא
  נבדק אם זה מקדים `coverage = 1` בחימום.
- **`pathEngine.ts` / `pathStudy.ts` / `scripts/pathStudy.ts`** — נשארו בקוד
  (מספקים `aggregateToH4` לבקטסטים) אבל **אף בוט לא סוחר לפיהם** מאז המעבר
  ל-Prev-4H Range.
- **Prev-4H Range** — פילטר EMA20 בלבד; אין הוכחה לקצה אחרי עלויות (פריצות
  4H מאובררות היטב). נוסף כעמית השוואה, לא כהמלצה.
