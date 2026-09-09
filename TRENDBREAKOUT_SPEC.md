# מפרט מלא — בוט הסימולציה הרביעי: `TrendBreakout` ("Bybit")

> זהו המפרט שהמשתמש מסר. הבוט מיושם ממנו מילה במילה, ללא אופטימיזציה
> (ראה §24, §27). **סימולציה בלבד — אין שליחת פקודות אמיתיות ל-Bybit ואין
> קידום לכסף אמיתי עד להחלטה נפרדת.**
>
> מימוש: `packages/engine/src/services/trendBreakout.ts` (סיגנל) +
> `packages/engine/src/services/trendBreakoutExecution.ts` (גודל/scale/יציאות)
> + `server/bybitSimEngine.ts` (חיבור לתשתית הסימולציה המשותפת).
> תקציר קצר יותר עם הפניות `file:line`: `BOTS_REFERENCE.md` §4.

---

בנה **בוט סימולציה חדש ועצמאי לחלוטין** בשם `TrendBreakout`. הבוט אינו
Consensus של Intraday / Pro / Path ואינו משתמש בסיגנלים שלהם. הוא משתמש רק
בלוגיקה המוגדרת כאן. יחד עם זאת, הוא משתמש בנתוני ה-OHLCV / market data
הקיימים בפרויקט (אין Data Feed כפול), ובתשתית האחסון / logging / Simulation
הקיימת.

## 1. Market Data
H1 — מגמה והקשר. M15 — פריצה ואישור. M5 — תזמון כניסה. רק נרות **סגורים**.
אין נתונים עתידיים / candle לא סגור.

## 2. אינדיקטורים (כולם configurable)
- H1: ATR(14) · Supertrend(ATR 10, mult 3.0) · EMA50 · EMA200 · Donchian(20)
- M15: ATR(14) · Donchian(20) · EMA20 · EMA50 · Volume SMA(20)
- M5: ATR(14) · EMA9 · EMA21 · Volume SMA(20)

## 3. הגדרת מגמה
LONG רק אם `Supertrend=UP AND EMA50>EMA200 AND Close>EMA50`. SHORT = המראה.
אחרת `TREND=NEUTRAL` → אין עסקה.

## 4. Breakout Signal (M15)
LONG: `Close > previous Donchian High(20)` **וגם** `Volume >= VolumeSMA20 × 1.2`
**וגם** בכיוון מגמת H1. SHORT = המראה מול `Donchian Low(20)`.

## 5. M5 Entry Confirmation
לא נכנסים מיד עם הפריצה. לאחר SETUP ב-M15 מחכים לאישור M5:
LONG: `EMA9 > EMA21 AND Close > EMA9`, ומחיר הכניסה במרחק ≤ `1.0 × ATR(M5)`
ממחיר ה-breakout (אחרת `ENTRY = INVALID`, לא רודפים). SHORT = המראה.

## 6. Signal States
`NO_SIGNAL → TREND_DETECTED → SETUP → ENTRY_CONFIRMATION → SIGNAL → IN_POSITION → EXIT`.
Signal רק כשכל התנאים מתקיימים.

## 7. Confidence Score (0–100, לא הסתברות)
H1 Supertrend 25 · H1 EMA trend 20 · M15 Donchian breakout 25 ·
Volume confirmation 15 · M5 entry confirmation 15. סף כניסה `MIN_CONFIDENCE = 70`.

## 8. Entry
כניסה במחיר ה-M5 הסגור הבא / מחיר ה-execution של הסימולציה. תיעוד: signal ts,
signal candle, breakout price, entry price, confidence, ATR, trend, position
size, SL, TP. **אין כניסה כפולה על אותו breakout.**

## 9. Stop Loss (דינמי, ATR)
LONG: `SL = Entry − ATR(M15) × 2.8` · SHORT: `SL = Entry + ATR(M15) × 2.8`.
`R = |Entry − SL|`. תקרת 4.2% (`MAX_LOSS_PERCENT`) מצמידה פנימה סטופ רחב מדי —
היא תקרה, לא יעד (החלטת מפעיל 2026-09-08: המכפיל הורחב מ-1.5 כדי שהסטופ יימתח
לכיוון התקרה בתנודתיות רגילה).

## 10. Take Profit
`TP1 = Entry ± max(R × tpRMultiplier, tp1FloorDistance)` — יעד 2R, אך לא קרוב
מ-`max(1.5% מ-Entry, 1.5×R)` (רצפת רווח, החלטת מפעיל 2026-09-08). `TP2 = TP1 × 1.5`.
חצי הפוזיציה נסגר ב-TP1, השאר רץ ל-TP2. שער `minRewardRisk` (1.2, כמו בשאר
הבוטים) דוחה SIGNAL שבו `|TP1−Entry| / R < 1.2` (`RR_TOO_LOW`) — backstop.

**סטייה מהמפרט (2026-09-09):** `R` ל-TP הוא מרחק הסטופ ה**מצומצם בפועל** (אחרי
תקרת 4.2%), לא `slAtrMultiplier × ATR(M15)` הגולמי. במטבע עם סטופ מצומצם הנוסחה
הישנה הציבה את TP1 ב-~2.4× ה-R המצומצם — בלתי-מושג בטווח 24 נרות בזמן ש-BE וה-scale
כבר ירו ב-R המצומצם. עכשיו "2R" הוא אותו R בכל מקום.

## 11. SCALE — Scale-in מדורג (לא פותחים הכול בבת אחת)
ברירת מחדל 50% / 30% / 20%. SCALE_2 (30%) רק אם המחיר ≥ +1.0R **וגם** המגמה
תקפה **וגם** אין ביטול setup. SCALE_3 (20%) רק אם המחיר ≥ +1.5R **וגם**
Supertrend עדיין בכיוון **וגם** אין Exit Signal. סך כל ה-scale-ins ≤ Max
Position Size של Risk Engine. **אין הגדלת פוזיציה בהפסד — NO MARTINGALE,
NO AVERAGING DOWN.**

**סטייה מהמפרט (2026-09-09):** ה-Rים הועברו מ-+0.5R / +1.0R ל-**+1.0R / +1.5R**
(= `breakEvenR` / `trailingStartR`). הוספת 60% גודל ב-+0.5R — לפני שהסטופ הגיע
ל-break-even — הפכה בדיקת-פריצה רגילה של מרווח קטן להפסד **גדול** מסטופ נקי של
−1R (לוט שנכנס ב-+0.5R עם הסטופ המקורי מסתכן 1.5R). כעת scale נכנס רק אחרי
נעילת break-even (SCALE_2) או זריעת ה-trail (SCALE_3), ו-`effectiveStop` מושך
את הסטופ המשותף כך שאף לוט לא מסתכן ביותר מ-1R (ראה §12).

## 12. Stop Management
ב-+1R → הזז SL ל-Break Even (`SL = Entry`). ב-+1.5R → trailing stop במרחק
`1.5 × ATR(M15)`, מתקדם רק בכיוון הרווח, לעולם לא מתרחק אחרי שהוקטן.

**סטייה מהמפרט (2026-09-09) — הגבלת סיכון ל-scale-in:** הסטופ המשותף לעולם לא
רופף מ-`(entry של הלוט הכי גרוע) − R`. לוט scale-in נכנס גבוה יותר (נמוך יותר
ב-SHORT) מלוט 0, אז בלי זה הוא מסתכן 1.5R–2R מהסטופ המשותף; ההגבלה מבטיחה שאף
לוט לא מסתכן ביותר מ-R אחד (≤ תקרת 4.2%). בנוסף, בלם חירום **per-lot**: אם לוט
כלשהו יורד יותר מ-4.2% מהכניסה שלו — יציאת חירום מיידית (הבלם הישן נמדד רק מול
כניסת לוט 0). ליחיד-לוט אין שינוי.

## 13. Exit Conditions
A. SL נחצה — **מיד במגע/חצייה** של המחיר החי (אין אישור סגירת נר). תקרת 4.2%
   היא סטופ נפרד שגם הוא נבדק על המחיר החי.
B. TP נחצה (TP1 חלקי 50%, TP2 מלא). C. Trend Reversal — LONG נסגרת אם
H1 Supertrend → DOWN (SHORT → UP). D. Time Stop — אחרי 24 נרות H1.
E. Invalidated Setup — חוסם scale נוסף (לא סוגר).

## 14. Risk Management
גודל = `sizingBase × positionTargetPct (10%)`, ללא תלות במרחק הסטופ.
`sizingBase` = ההון ההתחלתי (סימולציה). ה-SL רק **מודד** את הסיכון בדולרים,
לא קובע את הגודל. Scale-in: כל לוט הוא שבר מהיעד הזה (50/30/20), סך הכול ≤ 10%.

## 15. Exposure Limits
`PER_ASSET_EXPOSURE_CAP_PERCENT = 10%` · `MAX_TOTAL_EXPOSURE_PERCENT = 80%`
(סימולציה), שניהם מ-`sizingBase`. אין מספיק headroom/מזומן → הכניסה מדולגת עם
סיבה שמזהה את החסם שנקשר.

## 16. Drawdown Protection
Daily DD ≥ 8% → BLOCK new entries. Weekly DD ≥ 15% → LOCK new entries.
לא סוגר פוזיציות קיימות אוטומטית בגלל ה-breaker.

## 17. Simulation Execution
מתחשב ב-Trading Fee / Slippage / Spread / Funding כשרלוונטי. `signalPrice ≠
executionPrice`.

## 18. No Lookahead
אסור future candle / high / low / volume / indicator / outcome ליצירת Signal.

## 19. Data Reuse
משתמש בנתוני H1/M15/M5/Ticker/Volume הקיימים. **לא** יוצר API client נוסף,
**לא** משתמש בלוגיקה של Intraday/Pro/Path לייצור הסיגנל.

## 20. Isolation
positions / trades / PnL / state / configuration / statistics משלו. עסקה של
TrendBreakout לא משנה state של Intraday/Pro/Path.

## 21. Backtest + Simulation — אותה פונקציית Strategy
`Market Data → TrendBreakoutStrategy → Signal → Risk Engine → Simulation
Execution`. אין לוגיקה כפולה.

## 22. Output לכל Candle (debug)
timestamp · symbol · H1 trend · Supertrend · EMA50 · EMA200 · M15 Donchian ·
M15 volume ratio · M5 EMA9 · M5 EMA21 · confidence · setup state · entry state ·
signal · reason. סיבות ל-NO_SIGNAL: `H1_TREND_NEUTRAL`,
`BREAKOUT_NOT_CONFIRMED`, `VOLUME_TOO_LOW`, `M5_CONFIRMATION_FAILED`,
`ENTRY_TOO_EXTENDED`, `CONFIDENCE_BELOW_MIN`, `RISK_LIMIT`.

## 23. פרמטרים configurable (ללא אופטימיזציה אוטומטית בשלב ראשון)
`SUPERTREND_ATR_PERIOD=10` · `SUPERTREND_MULTIPLIER=3.0` · `DONCHIAN_PERIOD=20` ·
`ATR_PERIOD=14` · `VOLUME_MULTIPLIER=1.2` · `MIN_CONFIDENCE=70` ·
`SL_ATR_MULTIPLIER=2.8` · `TP_R_MULTIPLIER=2.0` · `RISK_PER_TRADE=0.5%` ·
`BREAK_EVEN_R=1.0` · `TRAILING_START_R=1.5` · `TRAILING_ATR_MULTIPLIER=1.0` ·
`MAX_HOLD_HOURS=24`. ראה `DEFAULT_TREND_BREAKOUT_PARAMS` ב-`trendBreakout.ts`.

## 24. מטרת שלב ראשון
Correctness · Reproducibility · No Lookahead · Correct Execution · Correct Risk ·
Clean Architecture. אופטימיזציה רק אחר כך.

---

## החלטות מודל (התנגשות עם רכיבים קיימים — הוכרעו מול המשתמש)

- **Scale-in:** מנוע המילוי המשותף (`fillDueOrders`) לא יודע להוסיף לפוזיציה,
  לכן כל scale הוא `SimPosition` נפרד; עסקה לוגית = כל ה-lots עם אותו
  בסיס+כיוון, אותו SL/TP, נסגרים יחד.
- **SHORT:** בסימולציה אי-אפשר לשרטט ב-SPOT → SHORT = `FUTURES` מינוף 1x.
  `maxFuturesPositions = 3` ב-registry (בניגוד ל-Pro/Path = 0).
- **Funding:** נוסף למנוע המשותף (`applyFundingAccrual`) ומוחל על **כל ארבעת
  הבוטים** אחיד, כדי לשמור מודל עלויות זהה. בפועל רק ה-futures של Intraday
  והשורטים של Bybit מרגישים אותו.
- **תקרת נכס 8% מול סיזינג לפי סיכון:** ה-SL הדוק גורם לתקרת ה-8% להיות
  לרוב האילוץ הכובל — התוצאה: הסיכון בפועל לעסקה לרוב < 0.5%. זו הקריאה
  הסטנדרטית של "סיזינג לפי סיכון עם תקרות חשיפה" (כמו ב-Path).
