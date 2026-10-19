# App Store Connect — texts for the TestFlight beta

Ready-to-paste answers for App Store Connect (app `KIPS`, bundle ID `com.roisafran.kips`). Fill these once the
Apple Developer Program enrollment is active and the first build has been uploaded (see [DEPLOY.md](DEPLOY.md) §3–4).
Facts here follow `site/public/privacy/index.html` and `PRODUCT.md`; change them together.

**Never put the demo password in this file or anywhere in the repo.** It is printed once by
`python -m scripts.demo_account create --apply` and goes only into App Store Connect.

## 1. TestFlight → Test Information

| Field | Value |
|---|---|
| Beta App Description | see below |
| Feedback Email | `support@kipscloset.com` |
| Marketing URL | `https://kipscloset.com` |
| Privacy Policy URL | `https://kipscloset.com/privacy/` |

**Beta App Description** (≤ 4,000 characters):

> KIPS turns a quick photo of your clothes into a clean catalog image of each piece, so you can see everything you own in one closet.
>
> Lay one or a few pieces flat on a bed or the floor and take a photo from above. KIPS finds each garment and creates a catalog image that keeps the real colors, wash, prints and details, then cuts it out for your closet. You can add a photo of the back, correct details by hand, and ask for an AI-made 360° view (labelled as AI).
>
> Each new account starts with free AI Credits for the beta. Finding garments is free; each image the AI creates uses credits, and the app shows the cost first. There are no purchases in this beta.
>
> Your wardrobe is private to your account. Photos are processed by Google's Gemini AI service to find garments and make images.

## 2. TestFlight → Test Information → Beta App Review Information

| Field | Value |
|---|---|
| First / last name, phone, email | the owner's contact details (email: `support@kipscloset.com` or your own) |
| Sign-in required | ✓ |
| User name | `review@kipscloset.com` |
| Password | the one printed by `scripts.demo_account create --apply` (private) |

**Review Notes** (paste as is):

> KIPS signs people in with a six-digit code sent by email. Because you can't receive that email, we created a demo account that signs in with a password:
>
> 1. Open the app and tap "I already have an account" on the welcome screen. The "Sign in with email" screen opens.
> 2. Press and hold the title "Sign in with email" for one second. A password sign-in screen opens.
> 3. Enter the user name and password above, then tap Sign In.
>
> The demo account has free AI Credits. To try the main feature: Add tab → take or choose a photo of clothes laid flat (a shirt or jeans on a bed works well). Processing takes about 15–60 seconds; the pieces then appear in the Closet tab. Account → Delete Account removes the account and all its data.
>
> The app's server and AI processing are live during review. Contact support@kipscloset.com with any problem.

## 3. Build → What to Test

Shown to testers for each build (≤ 4,000 characters). For the first build:

> Thanks for trying KIPS! Please try:
> • Sign up with your email and the six-digit code.
> • Photograph a few clothes laid flat (bed or floor, from above, good light). Try one piece, then several in one photo.
> • Check the catalog images: do they look like YOUR pieces — colors, wash, prints, text, details? Tell us when something is off.
> • Optional: add a back photo or a 360° view to a piece, and correct a detail by hand.
>
> Send feedback with a screenshot from TestFlight (take a screenshot in the app) or write to support@kipscloset.com.

## 4. External testers

1. TestFlight → External Testing → **+** → group name `Beta`.
2. Add the build, answer the review questions with §2, and **Submit for Review**.
3. After approval: add testers by email, or turn on **Public Link** (optionally with a tester limit) and share it.
   Testers install the TestFlight app, open the link, install KIPS and sign up with the email code as usual.

## 5. App Privacy (App Store → App Privacy)

Not needed for TestFlight itself, but App Store Connect may ask for it; it is required before an App Store release.
Answers matching what the app does today (no analytics, no advertising, no tracking, no purchases):

| Data type | Collected | Linked to the user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact Info → Email Address | yes | yes | no | App Functionality (sign-in) |
| Contact Info → Name | yes (the name chosen at sign-up) | yes | no | App Functionality |
| User Content → Photos or Videos | yes | yes | no | App Functionality |
| User Content → Other User Content (piece details, credits activity) | yes | yes | no | App Functionality |
| Identifiers → Device ID | no (the push token isn't a device ID) | | | |
| Usage Data, Diagnostics, Location, Purchases, Financial Info | no | | | |

- "Do you or your third-party partners use data for tracking?" → **No**.
- Photos are sent to Google Gemini to process them; that is processing for app functionality, not tracking.

## 6. Already set in the build

- Export compliance: `ITSAppUsesNonExemptEncryption = false` in `mobile/app.json`, so App Store Connect won't ask.
- Camera, photo library and notification permission texts: `mobile/app.json`.
