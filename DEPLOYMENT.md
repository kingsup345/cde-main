# DEPLOYMENT — הגדרת Render + Netlify + Firebase

הוראות מלאות לפריסת המערכת. שלושה שירותים, כל אחד עם ההגדרות שלו.

```
┌─────────────┐      HTTPS        ┌──────────────────┐     Firestore REST
│  Netlify    │ ───────────────▶ │  Render (worker) │ ──────────────────▶ ┌──────────┐
│  (frontend) │  VITE_TRADING_   │  server/worker   │  service-account    │ Firebase │
│  React/Vite │  API_URL         │  4 בוטי סימולציה │  JWT auth           │ Firestore│
└─────────────┘                  └──────────────────┘                     └──────────┘
```

- **Netlify** = ה-UI. Build-time בלבד — משתנה סביבה חדש דורש **rebuild**.
- **Render** = ה-worker שמריץ את 4 בוטי הסימולציה 24/7 ומחשב את כל ההחלטות.
- **Firebase (Firestore)** = אחסון עמיד ל-state של הבוטים, ל-**ארכיון הריצות** (BacktestResults) ול-warm-cache של הנרות. בלעדיו כל restart של Render מוחק הכל.

> ⚠️ **כלל זהב:** שינוי במנוע ההחלטות (`packages/engine/`, `server/`) דורש **rebuild של Render**. שינוי ב-UI או ב-`VITE_*` דורש **rebuild של Netlify**. שינוי שנוגע בשניהם — שניהם.

---

## 1. Firebase — Firestore + Service Account

### 1.1 יצירת הפרויקט
1. https://console.firebase.google.com → **Add project** (או השתמש בקיים).
2. בתפריט: **Build → Firestore Database → Create database**.
   - מצב: **Production mode** (הכללים לא רלוונטיים — הגישה דרך service-account שעוקף כללים).
   - Location: כל אזור (למשל `eur3` / `us-central`).

### 1.2 יצירת Service Account
1. **Project settings** (גלגל שיניים) → לשונית **Service accounts**.
2. **Generate new private key** → מוריד קובץ JSON. **זה סוד — לא לcommit.**
3. הקובץ נראה כך:
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com",
     "client_id": "...",
     ...
   }
   ```

### 1.3 המרה לשורה אחת (חובה למשתנה סביבה)
משתנה סביבה לא יכול להכיל newline אמיתי. צריך את כל ה-JSON בשורה אחת, כשה-`\n` שבתוך `private_key` **נשארים כטקסט `\n`** (לא newline).

```bash
# מ-Bash / Git Bash:
node -e "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync('service-account.json','utf8'))))"
```
או ב-PowerShell:
```powershell
(Get-Content service-account.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 10)
```
העתק את הפלט — זה הערך של `FIREBASE_SERVICE_ACCOUNT_KEY`.

### 1.4 שני המשתנים ל-Render
| משתנה | ערך |
|---|---|
| `FIREBASE_PROJECT_ID` | ה-`project_id` מתוך ה-JSON (למשל `cryptom-f7a95`) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | ה-JSON כולו בשורה אחת (מ-1.3) |

**בדיקה:** אחרי deploy, בלוג של Render בהפעלה תראה `[kv] durable storage configured` (או אזהרה חד-פעמית רועשת אם משהו חסר).

**היכן נשמר מה ב-Firestore:** collection `kv`, מסמכים לפי prefix:
- `<botId>-sim-state:state` — snapshot חי של כל בוט.
- `bot-archive:<botId>` — ארכיון הריצות (מערך, עד 25 ריצות/בוט). נכתב בכל "אפס את כל הבוטים", נמחק ב-"איפוס מטמון + שרת".
- `historical-candles:*` — warm-cache של נרות.

---

## 2. Render — ה-worker

### 2.1 הגדרות השירות
| שדה | ערך | הערה |
|---|---|---|
| **Root Directory** | *(ריק — שורש ה-repo)* | ⚠️ אסור להגדיר ל-`server`. ראה ההערה ב-`render.yaml` — ה-worker מייבא ~28 מודולים מ-`packages/engine/`, ואם ה-Root Directory הוא `server` אז שינויים במנוע לא מפעילים auto-deploy והבוט רץ קוד ישן. |
| **Build Command** | `npm install && npm --prefix server install && npm --prefix server run build` | |
| **Start Command** | `node server/dist/worker.js` | |
| **Health Check Path** | `/health` | |
| **Auto-Deploy** | On | |
| **Instance Type** | Free / Starter | Free עושה spin-down אחרי חוסר פעילות → ה-Firestore הוא מה שמשמר את ה-state |

### 2.2 משתני סביבה (Dashboard → Environment)

**סודות (`sync: false` — להזין ידנית):**
| משתנה | הערה |
|---|---|
| `BOT_ADMIN_TOKEN` | מחרוזת אקראית ארוכה. שומר על endpoints של כסף אמיתי בלבד. |
| `BYBIT_API_KEY` / `BYBIT_SECRET_KEY` | רק אם `BOT_DRY_RUN=false`. לסימולציה בלבד — ערכי דמה מספיקים. |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | אופציונלי (התראות). |
| `FIREBASE_PROJECT_ID` | מפרק 1.4 |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | מפרק 1.4 (שורה אחת!) |

**ערכים גלויים:**
| משתנה | ערך מומלץ | הערה |
|---|---|---|
| `NPM_CONFIG_PRODUCTION` | `false` | כדי ש-devDependencies יותקנו ל-build |
| `BYBIT_TESTNET` | `false` | |
| `BOT_DRY_RUN` | `true` | הבוט האמיתי לא שולח פקודות. **4 בוטי הסימולציה מתעלמים מזה בכל מקרה.** |
| `BOT_AUTOSTART` | `false` | |
| `BOT_RISK_LEVEL` | `medium` | |
| `BOT_SYMBOLS` | `100` | |
| `BOT_MIN_CONFIDENCE` | `60` | SCORE 0-100. מגיע ל-4 בוטי הסימולציה + הבוט האמיתי. |
| `BOT_PATH_MIN_CONFIDENCE` | *(ריק / `sync:false`)* | **מתעלמים ממנו.** "Path" הישן הוחלף ב-Prev-4H Range שהוא score bot. |
| `BOT_POSITION_PERCENT` | `10` | תקרת מפעיל בלבד. הגודל בפועל = 10% מ-equity (`POSITION_TARGET_PCT`). |
| `BOT_MAX_OPEN_POSITIONS` | **`7`** | תקרת פוזיציות מקבילות לבוטי הסימולציה: 7 (7 × 10% = 70% מושקע, ~20% buffer מזומן מתחת לתקרת ה-80% `MAX_TOTAL_EXPOSURE_PERCENT`). ה-worker חותך ל-`MAX_TOTAL_EXPOSURE_PERCENT / POSITION_TARGET_PCT` (= 8) כדי שערך גבוה מדי לא יזרוק `EXPOSURE_MODEL_INVALID` ויקפיא את הסימולציות. הבוט האמיתי שומר על תקרה 2 משלו (`DEFAULT_INTRADAY_PARAMS`). |
| `BOT_MAX_FUTURES_POSITIONS` | `2` | |
| `BOT_SCAN_CONCURRENCY` | `5` | |
| `BOT_SCAN_INTERVAL_SECONDS` | `300` | |
| `BOT_KLINE_INTERVAL` | `240` | |
| `BOT_RATE_LIMIT_MAX` | `120`–`300` | |
| `BOT_RATE_LIMIT_WINDOW_MS` | `60000` | |
| `BOT_REQUEST_TIMEOUT_MS` | `15000` | |
| `BOT_REENTRY_COOLDOWN_HOURS` | `24` | |
| `CORS_ORIGIN` | `https://<your-site>.netlify.app,http://localhost:8080,http://localhost:5173` | ⚠️ **חייב לכלול את כתובת ה-Netlify המדויקת** אחרת הדפדפן חוסם את כל הבקשות (CORS). ללא wildcard. |
| `PORT` | `3001` | (Render גם מזריק `PORT` משלו — הקוד מכבד אותו) |

> `render.yaml` שב-repo הוא **reference** — השירות בפועל נוצר ידנית (ה-hostname נגזר משם ה-repo). שנה ערכים ב-Dashboard, לא רק בקובץ.

### 2.3 בדיקה אחרי deploy
```
curl https://<your-worker>.onrender.com/health          → 200
curl https://<your-worker>.onrender.com/api/bybit-sim/state   → JSON עם snapshot
curl https://<your-worker>.onrender.com/api/public/backtest-archive
     → { "intraday": [], "pro": [], "path": [], "bybit": [] }  (ריק עד ה-reset הראשון)
```
בלוג: `[<bot>-engine] evals=... willExecute=... pos=... cash=...` בכל טיק (כל 4 שניות).
**אם רואים `tick failed: EXPOSURE_MODEL_INVALID`** → `BOT_MAX_OPEN_POSITIONS` × 10% חורג מתקרת ה-`MAX_TOTAL_EXPOSURE_PERCENT` (80%), כלומר גדול מ-8. הורד ל-7 והפעל redeploy. (ה-worker אמור לחתוך את זה לבד — אם השגיאה קיימת, בדוק ש-`.env` / Dashboard לא מגדירים ערך חריג.)

---

## 3. Netlify — ה-frontend

### 3.1 הגדרות Build (Site settings → Build & deploy)
| שדה | ערך |
|---|---|
| **Base directory** | *(ריק)* |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |
| **Node version** | 24 (מוגדר ב-`netlify.toml`) |

`netlify.toml` כבר מטפל ב-SPA redirect (`/* → /index.html 200`) וב-cache headers.

### 3.2 משתני סביבה (Site settings → Environment variables)
| משתנה | ערך | הערה |
|---|---|---|
| `VITE_TRADING_API_URL` | `https://<your-worker>.onrender.com` | ⚠️ **build-time** — נצרב ל-bundle. שינוי דורש **rebuild** (Deploys → Trigger deploy → Clear cache and deploy). |
| `VITE_ENABLE_ANALYTICS` | `true` / `false` | אופציונלי |

> המשתמש יכול גם לעקוף את ה-URL בזמן ריצה מדף בוט הסימולציה ("Worker URL" → נשמר ב-localStorage). זה נועד לבדיקות; ה-`VITE_TRADING_API_URL` הוא ברירת המחדל.

### 3.3 בדיקה
פתח את הדף → `/simulation-bot`. בשורת ה-Worker אמור להופיע ה-URL עם מקור "משתנה סביבה (Netlify)". "בדיקת /health" → פותח את ה-health של ה-worker.

---

## 4. Checklist פריסה (סדר פעולות)

1. **Firebase**: פרויקט + Firestore + service account → JSON בשורה אחת.
2. **Render**: צור/עדכן את השירות, הזן את כל המשתנים מפרק 2.2 (במיוחד `BOT_MAX_OPEN_POSITIONS=7` ושני משתני Firebase), deploy.
3. אמת: `/health` = 200, בלוג מראה טיקים, אין `EXPOSURE_MODEL_INVALID`.
4. **Netlify**: הגדר `VITE_TRADING_API_URL` = כתובת ה-Render, **Clear cache and deploy**.
5. אמת: הדף נטען, `/simulation-bot` מתחבר ל-worker, הפעל בוט, ראה פוזיציות/עסקאות.
6. `POST /api/{bot}-sim/reset` (או "אפס את כל הבוטים" ב-UI) → אמת ש-`GET /api/public/backtest-archive` מחזיר ריצה שמורה.

## 5. Gotchas — הכי נפוצים

| תסמין | סיבה | תיקון |
|---|---|---|
| כל הבוטים "קפואים", בלוג `tick failed: EXPOSURE_MODEL_INVALID` | `maxPositions × 10%` חורג מ-`MAX_TOTAL_EXPOSURE_PERCENT` (`BOT_MAX_OPEN_POSITIONS > 8`) | הורד ל-7, redeploy את Render |
| "CORS blocked" בקונסול הדפדפן | `CORS_ORIGIN` לא כולל את כתובת ה-Netlify | הוסף אותה ב-Render, redeploy |
| הבוטים "מתאפסים" בכל restart של Render | Firebase לא מוגדר → נשמר לדיסק זמני | הגדר `FIREBASE_PROJECT_ID` + `FIREBASE_SERVICE_ACCOUNT_KEY` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` לא עובד | newline אמיתי בתוך המפתח, או JSON חסר | שורה אחת, `\n` כטקסט (פרק 1.3), ה-JSON **מלא** (כולל `client_id` / `client_x509_cert_url`) |
| ה-UI מציג נתונים ישנים אחרי שינוי מנוע | רק Netlify נבנה מחדש | redeploy גם את Render |
| שינוי `VITE_TRADING_API_URL` לא נתפס | build-time בלבד | Netlify → Clear cache and deploy |
| BacktestResults ריק אחרי "אפס את כל הבוטים" | Firebase לא מוגדר (הארכיון נכתב לדיסק זמני), או שרת לא נגיש | ראה שורה 3 |
| BacktestResults עדיין מראה היסטוריה אחרי "איפוס מטמון + שרת" | ה-`POST /api/public/backtest-archive/clear` נכשל | בדוק שה-worker נגיש; אפשר לקרוא לו ידנית |

## 6. הרצה מקומית

```bash
cp .env.example .env        # מלא ערכים (Firebase אופציונלי — ירד לקובץ .data/ מקומי)
npm install
npm run dev                 # frontend  → http://localhost:8080
npm --prefix server install
npm --prefix server run dev # worker     → http://localhost:3001
```
ה-frontend המקומי מדבר עם ה-worker המקומי אם `VITE_TRADING_API_URL=http://localhost:3001` ב-`.env`, או דרך שדה ה-Worker URL ב-UI.
