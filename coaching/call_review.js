#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const { saveMemoryWithEmbedding } = require('../utils.js');

/**
 * Extract key insights from call review text.
 */
function extractInsights(text) {
    const insights = {
        objections: [],
        successfulTechniques: [],
        areasForImprovement: [],
    };
    
    // Split into sentences
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    
    for (const sentence of sentences) {
        const lower = sentence.toLowerCase();
        // Objections
        if (lower.includes('objection') || lower.includes('objected') || lower.includes('concern') || lower.includes('pushback')) {
            insights.objections.push(sentence);
        }
        // Successful techniques
        if (lower.includes('successful') || lower.includes('worked') || lower.includes('good') || lower.includes('effective') || lower.includes('technique')) {
            insights.successfulTechniques.push(sentence);
        }
        // Areas for improvement
        if (lower.includes('struggled') || lower.includes('did not') || lower.includes('failed') || lower.includes('improve') || lower.includes('need to')) {
            insights.areasForImprovement.push(sentence);
        }
    }
    
    // Deduplicate
    insights.objections = [...new Set(insights.objections)];
    insights.successfulTechniques = [...new Set(insights.successfulTechniques)];
    insights.areasForImprovement = [...new Set(insights.areasForImprovement)];
    
    return insights;
}

/**
 * Save call review as memory.
 */
async function saveCallReview(reviewText) {
    const insights = extractInsights(reviewText);
    const content = `Call review: ${reviewText}\n\nExtracted insights:\nObjections: ${insights.objections.join('; ')}\nSuccessful techniques: ${insights.successfulTechniques.join('; ')}\nAreas for improvement: ${insights.areasForImprovement.join('; ')}`;
    
    const memory = {
        type: 'call_review',
        content,
        importance: 8,
        tags: ['call_review', `date_${new Date().toISOString().slice(0, 10)}`],
    };

    const saved = await saveMemoryWithEmbedding(memory);
    console.log('Call review saved (id: ' + saved.id + ')');
    return { insights, content };
}

/**
 * Main processing.
 */
async function processCallReview(logLine) {
    try {
        // Expect logLine to start with "Call review: "
        const reviewText = logLine.replace(/^Call review:\s*/i, '').trim();
        if (!reviewText) {
            throw new Error('No review text provided');
        }
        const { insights, content } = await saveCallReview(reviewText);
        return {
            success: true,
            insights,
            summary: content.substring(0, 200) + '...',
        };
    } catch (err) {
        console.error('Error processing call review:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Command-line interface.
 */
async function main() {
    const logLine = process.argv.slice(2).join(' ');
    if (!logLine) {
        console.error('Usage: node call_review.js "Call review: ..."');
        process.exit(1);
    }
    const result = await processCallReview(logLine);
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main();
}

module.exports = { processCallReview, extractInsights };