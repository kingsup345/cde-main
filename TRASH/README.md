# TRASH — קבצים שהוצאו משימוש

הועברו לכאן ב-2026-09-10 בארגון תיעוד. **לא נמחקו** — אפשר להחזיר כל קובץ
עם `git mv` אם מתברר שצריך אותו. בטוח למחוק את התיקייה כולה אחרי שמוודאים
שאין צורך.

## `analyst-reports/`
דוחות ניתוח נקודתיים. הממצאים כבר יושמו בקוד; הדוחות עצמם הם צילום-רגע.
- `ANALYST_REPORT_2026-09-07_VERIFICATION.md`
- `ANALYST_REPORT_2026-09-07_bot-comparison.md`
- `ANALYST_REPORT_2026-09-07_position-sizing-audit-gaps.md`
- `ANALYST_REPORT_2026-09-08_audit-verification.md`
- `ANALYST_REPORT_2026-09-09_entry-frequency-and-consistency.md`

## `superseded-docs/`
- `ASTRAT.MD` — dump אסטרטגיות "נכון ל-2026-09-07". הוחלף ב-`ALGO_MATH.md` + `BOTS_REFERENCE.md`.
- `DEPLOYMENT.md` — מדריך הפריסה הישן. הוחלף ב-`INSTALL_GUIDE.md` (שמוסיף Bybit / Telegram / GitHub Actions).
- `FIX_PLAN_2026-09-09_unblock-and-simplify.md` — תוכנית תיקונים נקודתית, בוצעה.
- `SCOPING_2026-09-07_entry-mode-and-risk-profile.md` — מסמך scoping נקודתי, בוצע.

## `scratch/`
סקריפטים חד-פעמיים ופלטי כלים.
- `test-24-7.mjs` — smoke test מקומי מול `/api/sim`.
- `find-update.py` / `graphify-update-detect.py` — עוזרים לכלי graphify.
- `detect-log.txt` — פלט graphify.
- `done` — קובץ ריק.
- `firebase-debug.log` / `.snapshot-long.log` — לוגים ישנים (untracked; gitignored).
