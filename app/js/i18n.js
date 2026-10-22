// Every string must be a literal __('text', 'meow-mailer') call: WordPress's extractors
// (wp i18n make-pot, translate.wordpress.org) only find those, never a wrapper such as
// t(text), which is why the admin used to be untranslatable. Importing from
// @wordpress/i18n (an external, mapped to wp.i18n) keeps the calls recognisable once
// minified, as (0, x.__)("text", "meow-mailer").
import { __, sprintf } from '@wordpress/i18n';

// For the rare text that only exists in a variable. Extractors cannot see it, so the
// literal must be marked with __() wherever it is written.
const t = (text) => __(text, 'meow-mailer');

export { t, __, sprintf };
export default t;
