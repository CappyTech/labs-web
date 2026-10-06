# Cairn beta sign-up — one-time setup

`cairn.cappylabs.uk/beta` signs people up for the Play internal test track (and
an iPhone waitlist). Once the steps below are done it runs on its own:

1. Someone signs up → their email + platform are stored (`betatesters` collection).
2. Under the cap → they're emailed (and shown) the Google Group join link and the
   Play opt-in link. Over the cap, or no build for their platform → waitlist email.
3. You get a "new sign-up" email.
4. Every email has a leave link that deletes the record and invites the next
   person on the waitlist.
5. On every start-up, open places are filled from the waitlist, so setting
   `CAIRN_BETA_IOS_URL` and redeploying invites the whole iPhone waitlist.

## Why a Google Group

Google Play's API only manages testers as Google Groups (not individual
emails), so the group *is* the tester list and testers join it themselves.
No service account or API key is needed.

## Setup

1. **Create the group.** groups.google.com → Create group, e.g. `cairn-testers`.
   - Who can search for group: *Anyone on the web*
   - Who can join group: *Anyone can join*
   - Who can view conversations / post: *Group managers only* (the group is a
     list, not a mailing list)
2. **Point the internal track at it.** Play Console → Cairn → Testing →
   Internal testing → Testers → add the group's email
   (`cairn-testers@googlegroups.com`) as a tester list, and save.
3. **Copy the opt-in link** from the same page ("Join on the web").
4. **Set the env vars** in `.compose.env` (see `.compose.env.example`):
   `CAIRN_BETA_ANDROID_GROUP_URL`, `CAIRN_BETA_ANDROID_OPTIN_URL`,
   `SMTP_URL`, `MAIL_FROM`, and optionally `CAIRN_BETA_CAP` (default 100,
   Play's internal-track limit) and `CAIRN_BETA_NOTIFY`.
5. Redeploy (`docker compose pull && docker compose up -d`).

Until step 4 is done, Android sign-ups are waitlisted and invited
automatically on the first start-up after the links are set.

## iPhone later

When TestFlight is ready, create a public link in App Store Connect →
TestFlight → External testing, set `CAIRN_BETA_IOS_URL` to it and redeploy.

## Limits

- The cap counts sign-ups through this page. Someone can still join the
  Google Group directly; check the group's member count against Play's limit.
- Leaving the beta deletes the email here, but not the person's Google Group
  membership (the leave page links to the group so they can leave it).
- When the beta ends, delete the collection:
  `db.betatesters.drop()` (the privacy policy promises this).
