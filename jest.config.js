module.exports = {
 testEnvironment: 'node',
 testMatch: ['**/test/**/*.test.js'],
 collectCoverageFrom: ['lib/**/*.js', 'cron/**/*.js', 'utils.js', 'scripts/**/*.js', 'security/**/*.js'],
 verbose: true,
 forceExit: true
};
