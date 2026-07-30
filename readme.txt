=== Meow Mailer ===
Contributors: TigrouMeow
Tags: smtp, email, mailer, email log, deliverability
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.1.6
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reliable WordPress email through the provider of your choice, with a beautiful log, offline mode, and one click resend. Simple by design.

== Description ==

For years, almost every WordPress site I ran ended up with a different plugin just to send email. I never really chose them. I installed whatever looked fine at the time, because honestly there is no clear winner. Most of them advertise features I don't need, or hide the basics behind a paywall. At one point I simply wanted to see the emails my site had sent, or failed to send, and even that asked me to upgrade. That felt wrong.

So I decided to build the simplest and most honest email plugin I could for WordPress. You pick one provider, set it up once, and every email your site sends goes through it. Everything is logged, so you always know what happened. No upsell maze, no ads, nothing basic locked away.

That is Meow Mailer, and all of this is free:

* **One provider, set up once.** Pick the one you use and forget about it. No confusing multi provider routing.
* **A real email log, free.** Every email in a clean table with recipient, subject, provider and status (sent, failed, offline, pending). Click any row to read the full message, see the error, and resend it. Many plugins charge for this. Here it is free.
* **Stays out of the way.** Until you pick a provider, Meow Mailer doesn't touch your email, so activating it never breaks what already works.
* **Never miss a failure.** A dashboard warning appears when emails fail, so silent problems don't go unnoticed. Dismiss it once you have had a look and it stays away until a new email fails.
* **Failure alerts by email, free.** Get told when your site stops being able to send, instead of finding out from a customer. The alert is sent by WordPress itself rather than your provider, so it still reaches you when the provider is the thing that broke. One alert per hour at most, however many emails fail.
* **Weekly summary, free.** A short email with what was sent, what failed, and the most common errors. Nothing is sent on a quiet week.
* **Control WordPress's own emails.** Switch off the notifications WordPress sends by itself: new user registrations, password and email change confirmations, comment moderation, automatic update reports. Password resets are never affected, so nobody gets locked out.
* **Background sending.** Email goes out after the page has loaded, so your visitors never wait on the mail server.
* **Offline mode.** Capture every email in the log without sending. Perfect for staging and development.
* **Filters and export.** Filter by status and provider, search by subject or recipient, and export to CSV.
* **Test and resend.** Check your setup with an HTML or plain text test, and resend any logged message in one click.
* **Auto prune.** Keep logs forever, or delete anything older than 7, 30 or 90 days.
* **Multisite ready.** Set your provider up once on the main site and let every site of the network use it, or leave each site to configure its own. Email logs always stay per site.
* **Light and private.** No bloat, no tracking. Your credentials can live in `wp-config.php` instead of the database.

= What Meow Mailer will never do =

**No open or click tracking.** Other email plugins advertise it as a premium feature. It works by putting an invisible pixel in every message and rewriting every link to pass through a redirect, which means logging when your recipients read their mail and what they clicked. That is surveillance of the people your site writes to, it is personal data you then have to account for under the GDPR, and rewritten links make your email look more like spam, not less. Meow Mailer does not do it, and that is not a gap waiting to be filled in a Pro version. There is no Pro version.

= Supported providers =

Generic SMTP, Mailgun, Brevo, SendGrid, Amazon SES, Postmark, SMTP2GO, Mailjet, Resend, MailerSend, Maileroo, Gmail / Google Workspace (OAuth 2.0), and Microsoft 365 / Outlook (OAuth 2.0).

= About Meow Apps =

Meow Mailer is part of the Meow Apps family of plugins, focused on doing one thing well with a clean, modern interface.

== Installation ==

1. Upload the `meow-mailer` folder to `/wp-content/plugins/`, or install it from the Plugins screen.
2. Activate the plugin.
3. Go to **Meow Apps > Meow Mailer**, open the **Settings** tab, choose your provider and enter its credentials.
4. Send a test email to confirm everything works. Watch the **Logs** tab.

On a Multisite network, you can also network activate the plugin, then turn on **Shared Settings** on the main site to configure the provider once for every site.

== External services ==

Meow Mailer contacts an external service only after you choose and configure an email provider. Until then (the default "None") and in "Offline" mode, it sends nothing anywhere.

When you pick a provider, your outgoing email (recipients, subject, body, headers and attachments) and the credentials you entered are sent to that provider so it can be delivered, and only when your site actually sends an email. For Gmail and Microsoft 365, Meow Mailer also contacts their OAuth servers when you connect and refresh your account. Nothing else is ever sent.

You choose a single provider. Generic SMTP talks only to the server you configure. For the others, please review their terms and privacy policy: Mailgun ([terms](https://www.mailgun.com/legal/terms/), [privacy](https://www.mailgun.com/legal/privacy-policy/)), Brevo ([terms](https://www.brevo.com/legal/termsofuse/), [privacy](https://www.brevo.com/legal/privacypolicy/)), SendGrid ([terms](https://www.twilio.com/en-us/legal/tos), [privacy](https://www.twilio.com/en-us/legal/privacy)), Amazon SES ([terms](https://aws.amazon.com/service-terms/), [privacy](https://aws.amazon.com/privacy/)), Postmark ([terms](https://postmarkapp.com/terms-of-service), [privacy](https://postmarkapp.com/privacy-policy)), SMTP2GO ([terms](https://www.smtp2go.com/terms/), [privacy](https://www.smtp2go.com/privacy/)), Mailjet ([terms](https://www.mailjet.com/legal/terms/), [privacy](https://www.mailjet.com/legal/privacy-policy/)), Resend ([terms](https://resend.com/legal/terms-of-service), [privacy](https://resend.com/legal/privacy-policy)), MailerSend ([terms and privacy](https://www.mailersend.com/legal)), Maileroo ([terms](https://maileroo.com/terms-conditions), [privacy](https://maileroo.com/privacy-policy)), Gmail ([terms](https://policies.google.com/terms), [privacy](https://policies.google.com/privacy)), and Microsoft 365 ([terms](https://www.microsoft.com/en-us/servicesagreement), [privacy](https://privacy.microsoft.com/en-us/privacystatement)).

== Frequently Asked Questions ==

= Can I use more than one provider at a time? =

No, that's on purpose. One active provider keeps configuration simple and predictable. You can switch provider any time in Settings.

= Does it store my email password? =

For SMTP and API providers, credentials are stored in the WordPress database. You can instead define them as PHP constants in `wp-config.php` (e.g. `MWMAIL_SMTP_PASSWORD`) to keep them out of the database. Gmail and Microsoft 365 use OAuth 2.0, so no password is ever stored.

= What does Offline Mode do? =

When enabled, no email is sent. Every message WordPress tries to send is recorded in the log instead. Ideal for staging sites where you don't want real emails going out.

= Does it work on Multisite? =

Yes, and you can set it up once for the whole network. Activate it as usual (network activate works too), then on the main site turn on **Shared Settings**: every site of the network will send through the same provider, configured once from the main site. Subsites see that section as managed elsewhere and cannot change it, so nobody can reconfigure the network by accident.

You decide how far the sharing goes. The provider is always shared once the option is on. The sender details (From address, name, Reply-To) and the delivery options (background send, logging, retention) are each optional, so you can share the mail account but let every site keep its own From address, which is usually what you want since each site has its own domain.

Email logs are never shared. Each site keeps its own log and only ever sees its own emails.

Leave **Shared Settings** off and nothing changes: every site configures itself, exactly like a standalone install.

= Will it work with WooCommerce / contact form plugins? =

Yes. Meow Mailer intercepts WordPress's standard `wp_mail()`, which is what those plugins use.

= What does Background Send do? =

When enabled, the page is returned to your visitor immediately and the email is sent a moment later in the background, so a slow mail server never slows down your site. The email shows as "Pending" in the log, then updates to Sent or Failed.

= How do I connect Gmail or Microsoft 365? =

Both use OAuth 2.0, so no password is stored. Create an OAuth app (Google Cloud Console for Gmail, Azure Portal for Microsoft 365), paste the Client ID and Secret into the provider settings, add the shown redirect URI to your OAuth app, then click Connect.

== Screenshots ==

1. The email log: every message with recipient, subject, provider and status. Search, filter by status or provider, and export to CSV.
2. Settings: pick one provider and set it up once, with sender options, delivery controls, and a test email.
3. Any logged email opens in full, with its status, its error if it failed, and a one-click resend.

== Development ==

Meow Mailer is open source. The full source, including the React code used to build the admin interface, lives [on GitHub](https://github.com/jordymeow/meow-mailer).

== Changelog ==

= 0.1.6 (2026/07/28) =
* Add: Cc, Bcc and Reply-To details in the email logs.
* Add: Warning when a form plugin can override the sender address.
* Update: Readme now describes the third screenshot.

= 0.1.5 (2026/07/28) =
* Add: Maileroo as an email provider via its API.
* Add: Support for inline images, with attachments keeping the filename given by the caller.
* Fix: The wp_mail filter running twice, which duplicated changes other plugins made to emails.
* Fix: Brevo rejecting emails with "name is missing in to" when a recipient had no display name.
* Update: The failed emails notice is now dismissible and stays hidden until a new email fails.
* Update: Resend is no longer offered when the email content was not stored, and resends are counted on the original entry.

= 0.1.4 (2026/07/27) =
* Add: Shared settings for multisite, letting one provider serve the whole network.
* Update: Redesigned admin interface with Logs and Settings in the header and a status bar showing email activity.
* Update: Documented multisite support in the readme.
* Fix: Corrected the minimum WordPress version in the plugin header to match the readme.

= 0.1.3 (2026/07/02) =
* Update: Renamed the menu item to "Mailer".
* Add: Dismissable message inviting users to provide feedback on the forums.

= 0.1.2 (2026/07/02) =
* Add: Integrated Meow Mailer into the Meow Apps menu alongside other Meow plugins.
* 🎵 Discuss with others about Meow Mailer on [the Discord](https://discord.gg/bHDGh38).
* 🌴 Keep us motivated with [a little review here](https://wordpress.org/support/plugin/meow-mailer/reviews/). Thank you!
* 🥰 If you want to help us, check our [Patreon](https://www.patreon.com/meowapps). Thank you!

= 0.1.1 =
* Made Meow Mailer fully self contained and lighter.
* Rewrote the readme and published the source on GitHub.

= 0.1.0 =
* First release.
* Providers: Generic SMTP, Mailgun, Brevo, SendGrid, Amazon SES, Postmark, SMTP2GO, Mailjet, Resend, MailerSend, Gmail (OAuth), Microsoft 365 / Outlook (OAuth).
* Email log with content preview, status, filters, search, CSV export, and one-click resend.
* Offline mode, background sending, dashboard failure warnings, HTML/plain test emails, and automatic log pruning.
