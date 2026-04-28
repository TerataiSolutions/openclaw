#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { logJson } = require('../utils.js');

/**
 * Fetch recent strategy inputs for a client (last 7 days).
 */
async function fetchClientStrategyInputs(clientId) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Query memories of type 'strategy_input' with client_id = clientId from last week
  // Also ensure tags contain 'client_calibration' (saved by post_ingest_analysis.js)
  const url = `${SUPABASE_URL}/rest/v1/memories?` + 
    `type=eq.strategy_input` +
    `&client_id=eq.${encodeURIComponent(clientId)}` +
    `&created_at=gte.${oneWeekAgo}` +
    `&order=created_at.desc` +
    `&select=content,created_at,importance,tags`;
  
  logJson('info', { event: 'client_digest_fetch', client_id: clientId, url });
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Supabase query failed: ${err}`);
  }
  
  const memories = await response.json();
  logJson('info', { event: 'client_digest_fetch_result', client_id: clientId, count: memories.length });
  return memories;
}

/**
 * Format strategy inputs into a readable digest.
 */
function formatDigest(clientId, memories) {
  if (memories.length === 0) {
    return `No recent strategy inputs for client \`${clientId}\` (last 7 days).`;
  }
  
  let output = `# Client Digest – ${clientId}\n`;
  output += `*${memories.length} strategy input${memories.length > 1 ? 's' : ''} from the last 7 days*\n\n`;
  
  memories.forEach((mem, idx) => {
    const date = new Date(mem.created_at).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    output += `## ${date}\n`;
    
    // Extract sections from the stored content (format from post_ingest_analysis.js)
    const content = mem.content;
    const lines = content.split('\n');
    let inSection = false;
    let sectionTitle = '';
    let sectionLines = [];
    
    for (const line of lines) {
      if (line.startsWith('CONCERNS:') || line.startsWith('GOALS:') || line.startsWith('OPEN QUESTIONS:')) {
        // Finish previous section
        if (sectionTitle && sectionLines.length > 0) {
          output += `**${sectionTitle}**\n${sectionLines.join('\n')}\n\n`;
        }
        // Start new section
        sectionTitle = line.replace(':', '').trim();
        sectionLines = [];
        inSection = true;
      } else if (inSection && line.trim() !== '') {
        sectionLines.push(line.trim());
      }
    }
    // Add last section
    if (sectionTitle && sectionLines.length > 0) {
      output += `**${sectionTitle}**\n${sectionLines.join('\n')}\n\n`;
    }
    
    // If no sections detected, just show raw content (truncated)
    if (!sectionTitle) {
      output += `${content.substring(0, 300)}${content.length > 300 ? '…' : ''}\n\n`;
    }
    
    output += '---\n';
  });
  
  return output;
}

/**
 * Parse command line argument.
 * Expected format: "Client digest: CLIENT_ID"
 */
function parseMessage(message) {
  const prefix = 'Client digest:';
  if (!message.toLowerCase().startsWith(prefix.toLowerCase())) {
    console.error('Invalid command format. Expected "Client digest: CLIENT_ID"');
    process.exit(1);
  }
  const clientId = message.slice(prefix.length).trim();
  if (!clientId) {
    console.error('Client ID is required after colon.');
    process.exit(1);
  }
  return clientId;
}

async function main() {
  const message = process.argv.slice(2).join(' ');
  if (!message) {
    console.error('Usage: node client_digest.js "Client digest: CLIENT_ID"');
    process.exit(1);
  }
  
  const clientId = parseMessage(message);
  logJson('info', { event: 'client_digest_start', client_id: clientId });
  
  try {
    const memories = await fetchClientStrategyInputs(clientId);
    const digest = formatDigest(clientId, memories);
    console.log(digest);
  } catch (err) {
    logJson('error', { event: 'client_digest_failed', client_id: clientId, error: err.message });
    console.error(`❌ Failed to generate digest for ${clientId}: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { fetchClientStrategyInputs, formatDigest };