# רשימת השקה — 5 חברים דרך TestFlight, שרת על ה־Mac

**החלטה מחייבת לפיילוט:** FastAPI ו־AI Worker על ה־Mac האישי דרך Cloudflare Tunnel (`api.kipscloset.com`); Supabase נשאר Hosted. **לא להעביר את ה־Backend לענן כרגע.**

## א. מוכנות ה־Mac — לפני בניית ההזמנה

**כלים שקיימים בקוד (קריאה בלבד, לא מאתחלים ולא משנים דבר):**

```bash
scripts/mac_preflight.sh
```

```bash
python -m scripts.health_check --url http://127.0.0.1:8000/healthz --url https://api.kipscloset.com/healthz
```

קוד יציאה: 0 תקין, 1 אזהרה, 2 קריטי. HTTP 200 עם worker תקוע = **קריטי**. כשהמקומי עונה והציבורי לא — הבעיה ב־Tunnel/רשת.

- [ ] ה־Mac מחובר לחשמל, לרשת יציבה ומוגדר כך שלא יישן בזמן חלון הבטא (לבדוק בפועל; לא להסיק מהימצאות launchd). `mac_preflight.sh` מזהיר כשה־Mac על סוללה או כשהשינה לא חסומה. **ב־2026-11-02 הבדיקה מצאה את ה־Mac על סוללה (46%)** — לחבר לחשמל לפני ההזמנות.
- [ ] `com.kipscloset.api` ב־launchd תקין; בדוק את שירות Cloudflare Tunnel לפי השם שקיים **באמת** במחשב (לא להמציא מזהה שירות). בבדיקת קריאה בלבד ב־2026-11-02 נמצא ב־launchd של המשתמש: `com.cloudflare.cloudflared` — לאמת שזה אכן ה־Tunnel של `api.kipscloset.com`.
- [ ] בדיקה מרשת **חיצונית**: `https://api.kipscloset.com/healthz` מחזיר נתונים תקינים. לבדוק גם `worker_seconds_since_beat`, `queued`, `oldest_queued_seconds`, `failed_jobs_last_hour` ו־`generation`, לא רק `status: ok`.
- [ ] סטטוס תור ו־worker תקינים לאחר login/restart של השירותים (אימות בפועל; אל תאתחל באמצע עבודה של נסיין ללא צורך).
- [ ] `/healthz` מנוטר מחוץ ל־Mac, כך שנפילת חשמל/אינטרנט לא תסתיר את עצמה; יש התראה לבעלים, או לפחות חלופת בדיקה ידנית מוגדרת עד אישור שירות ניטור.
- [ ] קיים מסלול חירום: `WARDROBE_GENERATION=off` עוצר **יצירה חדשה** (דורש שינוי מאושר ואתחול מבוקר); אין להשתמש ב־`WARDROBE_BILLING=off` כ־Kill Switch.
- [ ] הוגדר תקציב יומי מוגבל ל־Gemini ומגבלת concurrency/עבודות, תועדו הלוגים ומדיניות מחיקתם; אין להשאיר מפתחות ב־Git.
- [ ] קיימת הודעת 'בטא לא זמינה כרגע' לשליחה לחברים אם ה־Mac נופל; להחזיק מחברת תקלות פרטית.

## ב. בדיקת אפליקציה מלאה לפני ההפצה

- [ ] App Store Connect כולל KIPS (`com.roisafran.kips`) ובילד **חתום לחנות**, לא Expo Go.
- [ ] סביבת EAS production מפנה את האפליקציה ל־`https://api.kipscloset.com` ול־Supabase Hosted, עם מפתחות Publishable בלבד.
- [ ] בטלפון אמיתי על רשת סלולרית: התקנה → הרשמה/OTP → קרדיטים ראשוניים → First 3 Pieces → צילום/ספרייה → זיהוי → יצירה → בגד שמור → יציאה/כניסה חוזרת.
- [ ] וודא מה השרת באמת מריץ: flags `WARDROBE_AUTH`, `WARDROBE_GENERATION`, `WARDROBE_OUTFIT`, `WARDROBE_OUTFIT_BUILDER`, `WARDROBE_WELCOME_CREDITS`, `WARDROBE_BILLING`, `WARDROBE_CREDIT_PRICES` (לא להעתיק ערכי סודות ללוג/צ'אט).
- [ ] בדיקות שתי זהויות: חשבונות נפרדים, תמונות פרטיות, הרשאות נתונים, מחיקת חשבון, retry אחרי ניתוק, אי־חיוב כפול.
- [ ] בדוק שהניטור קולט `screen_viewed`, שלבי First 3 Pieces, `job_finished`, AI cost ו־`client_error`; אמת על חשבון QA עם הרשאה.
- [ ] בדוק שאפשר לאתר עבודה דרך `request_id` → `job_id` → ניסיון worker/קריאת Gemini, ושהלוגים לא כוללים טוקנים, תמונות או URLs חתומים.
- [ ] בדוק שה־Mac יכול להשלים עבודה גם לאחר שהאייפון ננעל/החליף רשת; ותעד זמני עיבוד אמיתיים.

## ג. App Store Connect ו־TestFlight

- [ ] TestFlight → הכנת Test Information וכתובת תמיכה `support@kipscloset.com`.
- [ ] צור קבוצת Internal Testing אם נדרש להקמת External Testing; צור External group בשם `KIPS First 5`; שייך אליה את הבילד.
- [ ] השלם Beta App Review לבילד החיצוני הראשון (או אישור Apple הרלוונטי); ללא אישור לא שולחים הזמנה כהתקנה עובדת.
- [ ] בחר: **הזמנות במייל** לחמישה מסוימים, או **Public Link + Limit 5** להפצה ב־WhatsApp. Public Link מוגבל בכמות, לא בזהות, וניתן להעברה.
- [ ] עבור Public Link הדבק את הקישור האמיתי בכל המקומות המסומנים `{{KIPS_TESTFLIGHT_LINK}}`, והגדר `KIPS_BETA_URL` ב־HTML. עבור הזמנות אישיות, השתמש בנוסח המייל/WhatsApp המתאים.
- [ ] נסה את הקישור על אייפון אמיתי (או נסיין מורשה), והבטח שהקבוצה והבילד נגישים.

## ד. הזמנה וחוויית משתמש

- [ ] בחר חמישה בעלי אייפון עם רמות טכנולוגיות שונות; תאם חלון בדיקה שבו ה־Mac זמין.
- [ ] שלח `01-WHATSAPP-INVITE-HE.md` עם קישור Apple TestFlight + קישור KIPS; לא להעמיס מסמכים טכניים על החברים.
- [ ] בקש **שלושה בגדים בלבד** בתחילת הדרך, בלי להדריך מה ללחוץ; התמקד בחיכוך של הוספה ובדיוק התמונות.
- [ ] תעד הזמנה/התקנה באופן פרטי; אין לשמור שמות, מיילים או מזהי חשבונות של חברים בריפו.
- [ ] תן להם אפשרות לשלוח משוב פשוט; לא לבקש צילומי מסך עם קודים או מידע רגיש.

## ה. ניטור במהלך השבוע הראשון

- [ ] לפחות פעם ביום: `/healthz`, תור, worker, שגיאות API, כישלונות Gemini, תקציב AI, קרדיטים.
- [ ] פעם ביום: הרשמה → בגד ראשון → 3 בגדים → חזרה ביום אחר לפי `scripts.usage_report`, עם הבחנה בין >30 דקות לבין יום חדש. לחמשת הנסיינים: `python -m scripts.usage_report --cohort ~/kips-private/first-five.txt` — קובץ פרטי **מחוץ לריפו** בשורות `T1 email`; הפלט מציג כינויים בלבד ("2 of 5"), ומפריד בין מי שעדיין בתוך חלון 7 הימים ("open") לבין מי שלא חזר.
- [ ] במקרה תקלה: שעת האירוע, המשתמש בהסכמה, `request_id` או `job_id`, סטטוס job וסיבת הכשל, התיקון והאם עוד משתמשים נפגעו. `usage_report --user` מציג `request_id=` בשגיאות אפליקציה ו־`[job …]` בעבודות; לחפש אותם ב־`logs/server.jsonl` (ראו `06` → "Following one failure").
- [ ] אירוע אבטחה/פרטיות/חיוב או אובדן נתונים: עצור הזמנות חדשות, חקור, ואל תמשיך עד שיש תיקון ואימות.

## קבצים תפעוליים

- `06-MAC-OPERATIONS-RUNBOOK.md`: פקודות בדיקה והפעלה בטוחה.
- `07-OBSERVABILITY-QA-ACCEPTANCE.md`: בדיקות מוכנות לניטור.
- `08-PILOT-TRACKING-AND-DECISIONS.md`: מעקב אחר חמישה משתתפים.

**אין אישור בפנייה זו** לפרסם בילד, להפעיל Billing, לשנות ייצור, לחבר ספק איסוף חדש או להזמין חברים בפועל.