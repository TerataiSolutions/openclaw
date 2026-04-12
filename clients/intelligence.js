#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { clients } = require('./registry.js');
const { saveMemoryWithEmbedding } = require('../utils.js');

/**
 * Fetch HTML from a URL and return as text.
 */
async function fetchHTML(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; OpenClaw/1.0; +https://openclaw.ai)',
            },
            timeout: 10000,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
    } catch (err) {
        console.error(`Failed to fetch ${url}:`, err.message);
        return null;
    }
}

/**
 * Delete existing client_intel memories for a given client.
 */
async function deleteExistingClientIntel(client) {
    const url = `${SUPABASE_URL}/rest/v1/memories?tags=cs.{${client.id}}&type=eq.client_intel&select=id`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        console.error(`Failed to fetch existing intel for ${client.name}: ${response.statusText}`);
        return;
    }
    const existing = await response.json();
    if (existing.length === 0) {
        console.log(`No existing client_intel memories for ${client.name}`);
        return;
    }
    console.log(`Deleting ${existing.length} existing client_intel memories for ${client.name}...`);
    // Delete each memory (could batch, but simplicity)
    for (const mem of existing) {
        const deleteUrl = `${SUPABASE_URL}/rest/v1/memories?id=eq.${mem.id}`;
        const deleteRes = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            },
        });
        if (!deleteRes.ok) {
            console.error(`Failed to delete memory ${mem.id}: ${deleteRes.statusText}`);
        }
    }
    console.log(`Deleted ${existing.length} old memories for ${client.name}`);
}

/**
 * Fetch homepage plus additional paths for a client.
 * Returns concatenated HTML string.
 */
async function fetchAllPages(client) {
    const baseUrl = new URL(client.website);
    const paths = ['/', '/about', '/customers', '/case-studies', '/solutions', '/services', '/pricing'];
    let combinedHTML = '';
    for (const path of paths) {
        const url = new URL(path, baseUrl).href;
        console.log(`  Fetching ${url}`);
        const html = await fetchHTML(url);
        if (html) {
            combinedHTML += html + '\n';
        } else {
            console.log(`    (page not found or error)`);
        }
        // Be polite between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return combinedHTML;
}

/**
 * Extract key information from combined HTML.
 * Returns an object with description, products/services, value proposition, target market, case studies.
 */
function extractIntel(html, clientName) {
    const intel = {
        description: '',
        products_services: '',
        value_proposition: '',
        target_market: '',
        case_studies_social_proof: '',
    };
    if (!html) return intel;

    // Extract meta description
    const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (metaDescMatch) {
        intel.description = metaDescMatch[1];
    }

    // Extract title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch) {
        intel.description = intel.description || titleMatch[1];
    }

    // Extract first few paragraphs (p tags)
    const pMatches = html.match(/<p[^>]*>([^<]*)<\/p>/gi);
    if (pMatches) {
        const paragraphs = pMatches.slice(0, 10).map(p => p.replace(/<[^>]*>/g, '').trim());
        intel.products_services = paragraphs.join(' ');
    }

    // Look for h1/h2 headings
    const hMatches = html.match(/<h[12][^>]*>([^<]*)<\/h[12]>/gi);
    if (hMatches) {
        const headings = hMatches.map(h => h.replace(/<[^>]*>/g, '').trim());
        intel.value_proposition = headings.join(' | ');
    }

    // Look for words like "solution", "platform", "service", "product"
    const solutionRegex = /(solution|platform|service|product|tool|software|app)\s+[^.]*\./gi;
    const solutions = html.match(solutionRegex);
    if (solutions) {
        intel.products_services = (intel.products_services + ' ' + solutions.slice(0, 5).join(' ')).trim();
    }

    // Look for "customer", "client", "user" mentions
    const targetRegex = /(customer|client|user|business|enterprise|small business)[^.]*\./gi;
    const targets = html.match(targetRegex);
    if (targets) {
        intel.target_market = targets.slice(0, 5).join(' ');
    }

    // Look for "case study", "testimonial", "trusted by"
    const socialRegex = /(case study|testimonial|trusted by|used by|customer story)[^.]*\./gi;
    const socials = html.match(socialRegex);
    if (socials) {
        intel.case_studies_social_proof = socials.slice(0, 5).join(' ');
    }

    // Trim each field to reasonable length
    Object.keys(intel).forEach(k => {
        if (intel[k].length > 800) intel[k] = intel[k].substring(0, 797) + '...';
    });

    return intel;
}

/**
 * Save extracted intelligence as a Supabase memory.
 */
async function saveIntel(client, intel) {
    const content = `Client intelligence for ${client.name} (${client.website}):
Description: ${intel.description || 'Not extracted'}
Products/Services: ${intel.products_services || 'Not extracted'}
Value Proposition: ${intel.value_proposition || 'Not extracted'}
Target Market: ${intel.target_market || 'Not extracted'}
Case Studies/Social Proof: ${intel.case_studies_social_proof || 'Not extracted'}`;

    const memory = {
        type: 'client_intel',
        content,
        importance: 9,
        tags: [client.id, 'client_intelligence', 'enriched'],
    };

    const saved = await saveMemoryWithEmbedding(memory);
    console.log(`Saved enriched intelligence for ${client.name} (id: ${saved.id})`);
    return content;
}

/**
 * Main: process all clients.
 */
async function main() {
    console.log(`Running enriched client intelligence for ${clients.length} clients...`);
    for (const client of clients) {
        console.log(`\n=== ${client.name} ===`);
        // Delete existing shallow intel
        await deleteExistingClientIntel(client);
        // Fetch all pages
        const combinedHTML = await fetchAllPages(client);
        if (!combinedHTML) {
            console.log(`Skipping ${client.name} due to fetch errors`);
            continue;
        }
        // Extract from combined content
        const intel = extractIntel(combinedHTML, client.name);
        const savedContent = await saveIntel(client, intel);
        console.log(`Extracted: ${Object.keys(intel).filter(k => intel[k]).length} fields`);
        // Wait a bit to be polite before next client
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    console.log('\nClient intelligence enrichment completed.');
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { fetchHTML, extractIntel, saveIntel, deleteExistingClientIntel, fetchAllPages };