'use strict';

const fs = require('fs');
const path = require('path');
const { generateEmbedding, saveMemoryWithEmbedding, logJson } = require('../utils.js');

const CHUNK_WORD_LIMIT = 800;

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--client' && args[i + 1]) result.client = args[++i];
    if (args[i] === '--file' && args[i + 1]) result.file = args[++i];
  }
  return result;
}

function chunkTranscript(text, wordLimit) {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const chunks = [];
  let current = '';
  let wordCount = 0;
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    if (wordCount + sentenceWords > wordLimit && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
      wordCount = sentenceWords;
    } else {
      current += sentence;
      wordCount += sentenceWords;
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

async function main() {
  const { client, file } = parseArgs();
  if (!client || !file) { console.error('Usage: node ingest_transcript.js --client [client_id] --file [path]'); process.exit(1); }
  if (!fs.existsSync(file)) { console.error(`File not found: ${file}`); process.exit(1); }
  const rawText = fs.readFileSync(file, 'utf8');
  const chunks = chunkTranscript(rawText, CHUNK_WORD_LIMIT);
  logJson('info', { event: 'ingest_transcript_start', client_id: client, file, total_chunks: chunks.length });
  let saved = 0, failed = 0;
  for (let i = 0; i < chunks.length; i++) {
    try {
      const result = await saveMemoryWithEmbedding({ type: 'meeting_transcript', content: chunks[i], client_id: client, importance: 8, tags: ['meeting_transcript', `client_${client}`] });
      if (result) { saved++; logJson('info', { event: 'chunk_saved', chunk_index: i + 1, memory_id: result.id }); }
      else { failed++; logJson('warn', { event: 'chunk_save_failed', chunk_index: i + 1 }); }
    } catch (err) { failed++; logJson('error', { event: 'chunk_error', chunk_index: i + 1, error: err.message }); }
  }
  console.log(`\nIngestion complete. Saved: ${saved} | Failed: ${failed} | Total chunks: ${chunks.length}`);

  if (failed > 0) {
    const { sendDiscordAlert } = require('../lib/clients/discord');
    await sendDiscordAlert(
      `⚠️ Transcript ingest completed with ${failed} errors. ` +
      'Check /data/.openclaw/workspace/logs/ingest.log for details.'
    );
  }
}

main().catch(err => { console.error('Fatal error:', err.message); process.exit(1); });