const { extractInsights } = require('./coaching/call_review.js');
const reviewText = 'Call review: gatekeeper blocked 6 calls today, used name-drop technique successfully on 3 calls, price objection came up 4 times, decision maker was receptive to ROI framing on 2 calls, voicemail scripts need refinement';
console.log('Call review extraction result:');
console.log(JSON.stringify(extractInsights(reviewText), null, 2));