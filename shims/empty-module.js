// Empty module stub for server-only packages on web platform.
// Used by metro.config.js to prevent server code (mysql2, drizzle drivers,
// nodemailer etc.) from leaking into the web bundle.
module.exports = {};
module.exports.default = {};
