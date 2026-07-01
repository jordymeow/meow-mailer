=== Meow Mailer ===
Contributors: TigrouMeow
Tags: smtp, email, mailer, email log, deliverability
Requires at least: 6.5
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.1.1
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
* **Never miss a failure.** A dashboard warning appears when emails fail, so silent problems don't go unnoticed.
* **Background sending.** Email goes out after the page has loaded, so your visitors never wait on the mail server.
* **Offline mode.** Capture every email in the log without sending. Perfect for staging and development.
* **Filters and export.** Filter by status and provider, search by subject or recipient, and export to CSV.
* **Test and resend.** Check your setup with an HTML or plain text test, and resend any logged message in one click.
* **Auto prune.** Keep logs forever, or delete anything older than 7, 30 or 90 days.
* **Light and private.** No bloat, no tracking. Your credentials can live in `wp-config.php` instead of the database.

= Supported providers =

Generic SMTP, Mailgun, Brevo, SendGrid, Amazon SES, Postmark, SMTP2GO, Mailjet, Resend, MailerSend, Gmail / Google Workspace (OAuth 2.0), and Microsoft 365 / Outlook (OAuth 2.0).

= About Meow Apps =

Meow Mailer is part of the Meow Apps family of plugins, focused on doing one thing well with a clean, modern interface.

== Installation ==

1. Upload the `meow-mailer` folder to `/wp-content/plugins/`, or install it from the Plugins screen.
2. Activate the plugin.
3. Open the **Meow Mailer** menu in your WordPress admin, go to the **Settings** tab, choose your provider and enter its credentials.
4. Send a test email to confirm everything works. Watch the **Logs** tab.

== External services ==

Meow Mailer contacts an external service only after you choose and configure an email provider. Until then (the default "None") and in "Offline" mode, it sends nothing anywhere.

When you pick a provider, your outgoing email (recipients, subject, body, headers and attachments) and the credentials you entered are sent to that provider so it can be delivered, and only when your site actually sends an email. For Gmail and Microsoft 365, Meow Mailer also contacts their OAuth servers when you connect and refresh your account. Nothing else is ever sent.

You choose a single provider. Generic SMTP talks only to the server you configure. For the others, please review their terms and privacy policy:

* Mailgun: https://www.mailgun.com/legal/terms/ , https://www.mailgun.com/legal/privacy-policy/
* Brevo: https://www.brevo.com/legal/termsofuse/ , https://www.brevo.com/legal/privacypolicy/
* SendGrid: https://www.twilio.com/en-us/legal/tos , https://www.twilio.com/en-us/legal/privacy
* Amazon SES: https://aws.amazon.com/service-terms/ , https://aws.amazon.com/privacy/
* Postmark: https://postmarkapp.com/terms-of-service , https://postmarkapp.com/privacy-policy
* SMTP2GO: https://www.smtp2go.com/terms/ , https://www.smtp2go.com/privacy/
* Mailjet: https://www.mailjet.com/legal/terms/ , https://www.mailjet.com/legal/privacy-policy/
* Resend: https://resend.com/legal/terms-of-service , https://resend.com/legal/privacy-policy
* MailerSend: https://www.mailersend.com/legal , https://www.mailersend.com/legal/privacy-policy
* Gmail: https://policies.google.com/terms , https://policies.google.com/privacy
* Microsoft 365: https://www.microsoft.com/en-us/servicesagreement , https://privacy.microsoft.com/en-us/privacystatement

== Frequently Asked Questions ==

= Can I use more than one provider at a time? =

No, that's on purpose. One active provider keeps configuration simple and predictable. You can switch provider any time in Settings.

= Does it store my email password? =

For SMTP and API providers, credentials are stored in the WordPress database. You can instead define them as PHP constants in `wp-config.php` (e.g. `MWMAIL_SMTP_PASSWORD`) to keep them out of the database. Gmail uses OAuth 2.0, so no password is ever stored.

= What does Offline Mode do? =

When enabled, no email is sent. Every message WordPress tries to send is recorded in the log instead. Ideal for staging sites where you don't want real emails going out.

= Will it work with WooCommerce / contact form plugins? =

Yes. Meow Mailer intercepts WordPress's standard `wp_mail()`, which is what those plugins use.

= What does Background Send do? =

When enabled, the page is returned to your visitor immediately and the email is sent a moment later in the background, so a slow mail server never slows down your site. The email shows as "Pending" in the log, then updates to Sent or Failed.

= How do I connect Gmail or Microsoft 365? =

Both use OAuth 2.0, so no password is stored. Create an OAuth app (Google Cloud Console for Gmail, Azure Portal for Microsoft 365), paste the Client ID and Secret into the provider settings, add the shown redirect URI to your OAuth app, then click Connect.

== Development ==

Meow Mailer is open source. The full source, including the React code used to build the admin interface, lives on GitHub: https://github.com/jordymeow/meow-mailer

== Changelog ==

= 0.1.1 =
* Made Meow Mailer fully self contained and lighter.
* Rewrote the readme and published the source on GitHub.

= 0.1.0 =
* First release.
* Providers: Generic SMTP, Mailgun, Brevo, SendGrid, Amazon SES, Postmark, SMTP2GO, Mailjet, Resend, MailerSend, Gmail (OAuth), Microsoft 365 / Outlook (OAuth).
* Email log with content preview, status, filters, search, CSV export, and one-click resend.
* Offline mode, background sending, dashboard failure warnings, HTML/plain test emails, and automatic log pruning.
