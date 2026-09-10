# crypto-decision-engine

מערכת החלטות מסחר בקריפטו עם **4 בוטי סימולציה** שרצים 24/7 זה לצד זה, כל
אחד עם אסטרטגיה נפרדת, כדי להשוות תוחלת אחרי עלויות ולבחור מי ראוי לקידום
לכסף אמיתי.

> **סימולציה בלבד.** אף אחד מ-4 הבוטים לא שולח פקודה אמיתית. יש בוט אמיתי
> נפרד (`/real-trading`) מאחורי טוקן, שברירת המחדל שלו `BOT_DRY_RUN=true`.

---

## הבוטים (`/simulation-bot`)

| שם בממשק | מה הוא עושה |
|---|---|
| **מנוע חדש · Multi-Timeframe** (`intraday`) | רג'ים 1H → setup 15M → אישור כניסה 5M. סטופ/יעד דינמיים, trailing R-capped, time-stop מודע-MFE. |
| **Pro · alg.md** (`pro`) | 8 אינדיקטורים משוקללים (RSI/MA/MACD/Bollinger/Stochastic/Volume×2/מומנטום) → ציון ביטחון. סף שטוח 70. spot בלבד. |
| **נתיב 4H · טווח נר קודם** (`path`) | פורץ את טווח נר ה-4H הקודם בכיוון מגמת EMA20(4H). break-even runner אחרי TP1. |
| **Bybit · TrendBreakout** (`bybit`) | Supertrend+EMA (H1) → פריצת Donchian+נפח (15M) → אישור EMA (5M). scale-in ב-3 lots, כל לוט ≤ 1R. |

מתמטיקה מלאה: [`ALGO_MATH.md`](ALGO_MATH.md) · ייחוס עם הפניות-שורה:
[`BOTS_REFERENCE.md`](BOTS_REFERENCE.md).

---

## ארכיטקטורה

```
Netlify (React/Vite, dist/)  ──VITE_TRADING_API_URL──▶  Render (Node worker)  ──service-account──▶  Firebase Firestore
       ה-UI                                              4 בוטי הסימולציה                            state · ארכיון · cache
                                                         + כל ההחלטות
```

**כל** החלטת מסחר מחושבת ב-`packages/engine/` (`@cde/engine`) — משותף
ל-frontend ול-worker. לכן תיקון במנוע דורש **build של Render וגם של Netlify**.

מפה מלאה: [`PROJECT_MAP.md`](PROJECT_MAP.md).

---

## הרצה מקומית

```bash
cp .env.example .env          # Firebase אופציונלי (יורד ל-server/.data/)
npm install                   # workspaces: packages/* + server

npm run dev                   # frontend → http://localhost:8080
npm --prefix server run dev   # worker   → http://localhost:3001
```

הגדר ב-`.env`: `VITE_TRADING_API_URL=http://localhost:3001` ו-`CORS_ORIGIN`
שכולל `http://localhost:8080`.

## בדיקות ו-typecheck (לפני push)

```bash
npm test                                        # vitest
npm run typecheck                               # frontend (tsconfig.app.json)
npm run typecheck:worker                        # server + engine (tsconfig.worker.json)
cd packages/engine && npx tsc --noEmit          # engine לבד
npx vite build                                  # אימות build מלא
```

CI (`.github/workflows/ci.yml`) מריץ את כולם על כל PR ל-`main`.

## פריסה

מדריך התקנה מלא לכל החיבורים — Firebase, Bybit, Render, Netlify, Telegram,
GitHub Actions: [`INSTALL_GUIDE.md`](INSTALL_GUIDE.md).

```
שינוי ב-src/**                        → build של Netlify
שינוי ב-packages/engine/** או server/** → build של Render (+ Netlify אם ה-UI נוגע בזה)
שינוי ב-VITE_*                         → Netlify: Clear cache and deploy
```

---

## סטאק

React 18 · TypeScript · Vite · Tailwind · shadcn/ui (Radix) · recharts ·
react-router · TanStack Query · Node (`node:http`, esbuild bundle) ·
Firestore · Vitest · npm workspaces.

## מבנה

```
src/                React frontend (→ Netlify)
server/             Node worker (→ Render)
packages/engine/    @cde/engine — כל לוגיקת ההחלטה
scripts/            כלי backtest/ניתוח (tsx, לא נפרס)
.github/workflows/  CI + keepalive
TRASH/              תיעוד/סקריפטים ישנים (ראה TRASH/README.md)
```

## תיעוד

| קובץ | מה |
|---|---|
| [`INSTALL_GUIDE.md`](INSTALL_GUIDE.md) | התקנת כל החיבורים |
| [`ALGO_MATH.md`](ALGO_MATH.md) | מבנה + מתמטיקה של 4 הבוטים |
| [`PROJECT_MAP.md`](PROJECT_MAP.md) | מפת הקוד — מי קורא למי, איפה לגעת |
| [`BOTS_REFERENCE.md`](BOTS_REFERENCE.md) | ייחוס הבוטים עם הפניות-שורה — מקור האמת |
| [`TRENDBREAKOUT_SPEC.md`](TRENDBREAKOUT_SPEC.md) | המפרט המלא של בוט TrendBreakout |
