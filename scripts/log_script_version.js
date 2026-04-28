'use strict';

const { saveMemoryWithEmbedding, logJson } = require('../utils.js');

// Usage from Discord: "Log script: CLIENT_ID | CHANGE_SUMMARY | full script text here"
// Example: "Log script: sturdy | Updated opener to reference AI signal detection | Hi [Name], saw you're using..."

async function main(rawInput) {
 const parts = rawInput.replace(/^Log script:\s*/i, '').split('|').map(s => s.trim());

 if (parts.length < 3) {
 return 'Usage: `Log script: CLIENT_ID | CHANGE_SUMMARY | full script text`';
 }

 const [clientId, changeSummary, scriptText] = parts;
 const timestamp = new Date().toISOString();

 const content =
 `Script version logged for ${clientId} on ${timestamp}.\n` +
 `Change: ${changeSummary}\n\n` +
 `Script:\n${scriptText}`;

 const result = await saveMemoryWithEmbedding({
 type: 'script_version',
 content,
 client_id: clientId,
 importance: 7,
 tags: ['script_version', `client_${clientId}`, 'versioned']
 });

 if (result) {
 logJson('info', { event: 'script_version_saved', client_id: clientId, memory_id: result.id });
 return `Script version saved for \`${clientId}\`. Change: "${changeSummary}". Memory ID: \`${result.id}\``;
 }
 return `Failed to save script version for \`${clientId}\`.`;
}

const rawInput = process.argv.slice(2).join(' ');
main(rawInput).then(console.log).catch(err => {
 console.error('Fatal:', err.message);
 process.exit(1);
});