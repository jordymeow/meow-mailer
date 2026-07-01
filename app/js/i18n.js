// Minimal i18n wrapper. wp.i18n is provided by WordPress.
const { __, sprintf } = wp.i18n;

const t = (text) => __(text, 'meow-mailer');

export { t, __, sprintf };
export default t;
