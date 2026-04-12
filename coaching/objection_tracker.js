#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * Fetch all call review memories.
 */
async function fetchCallReviews() {
    const url = `${SUPABASE_URL}/rest/v1/memories?type=eq.call_review&select=content,created_at&order=created_at.desc`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch call reviews: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Parse objections and successful techniques from a call review content.
 */
function parseReview(content) {
    const lines = content.split('\n');
    let objections = [];
    let successfulTechniques = [];
    for (const line of lines) {
        if (line.startsWith('Objections:')) {
            const parts = line.substring('Objections:'.length).split(';').map(s => s.trim()).filter(s => s);
            objections = parts;
        }
        if (line.startsWith('Successful techniques:')) {
            const parts = line.substring('Successful techniques:'.length).split(';').map(s => s.trim()).filter(s => s);
            successfulTechniques = parts;
        }
    }
    // Fallback: extract sentences containing keywords
    if (objections.length === 0) {
        const lower = content.toLowerCase();
        if (lower.includes('objection')) {
            // crude extraction
            const sentences = content.split(/[.!?]+/);
            objections = sentences.filter(s => s.toLowerCase().includes('objection')).map(s => s.trim());
        }
    }
    return { objections, successfulTechniques };
}

/**
 * Build frequency map of objections.
 */
function countObjections(reviews) {
    const freq = {};
    for (const review of reviews) {
        const { objections } = parseReview(review.content);
        for (const obj of objections) {
            // Normalize: lowercase, remove extra spaces
            const key = obj.toLowerCase().trim();
            freq[key] = (freq[key] || 0) + 1;
        }
    }
    return freq;
}

/**
 * Build map of successful techniques.
 */
function collectSuccessfulTechniques(reviews) {
    const techniques = [];
    for (const review of reviews) {
        const { successfulTechniques } = parseReview(review.content);
        techniques.push(...successfulTechniques.map(t => t.trim()));
    }
    // Deduplicate
    return [...new Set(techniques)];
}

/**
 * Suggest counter-strategies for an objection based on techniques.
 */
function suggestCounterStrategy(objection, techniques) {
    // Simple keyword matching
    const objectionWords = objection.toLowerCase().split(/\W+/);
    const candidates = techniques.filter(tech => {
        const techLower = tech.toLowerCase();
        return objectionWords.some(word => word.length > 3 && techLower.includes(word));
    });
    if (candidates.length > 0) {
        return candidates[0];
    }
    // Generic counters based on objection type
    if (objection.toLowerCase().includes('price') || objection.toLowerCase().includes('cost')) {
        return 'Emphasize ROI, break down cost per value, offer flexible pricing tiers.';
    }
    if (objection.toLowerCase().includes('time') || objection.toLowerCase().includes('busy')) {
        return 'Highlight time‑saving benefits, offer a short pilot, frame as investment.';
    }
    if (objection.toLowerCase().includes('trust') || objection.toLowerCase().includes('new')) {
        return 'Share case studies, offer references, provide trial period.';
    }
    return 'Acknowledge concern, ask probing questions to uncover root cause, reframe around value.';
}

/**
 * Generate objection report.
 */
async function generateReport() {
    const reviews = await fetchCallReviews();
    if (reviews.length === 0) {
        return {
            topObjections: [],
            techniques: [],
            suggestions: {},
        };
    }
    
    const objectionFreq = countObjections(reviews);
    const techniques = collectSuccessfulTechniques(reviews);
    
    // Sort objections by frequency
    const topObjections = Object.entries(objectionFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([obj, count]) => ({ objection: obj, frequency: count }));
    
    // Generate suggestions for top 3 objections
    const suggestions = {};
    topObjections.slice(0, 3).forEach(({ objection }) => {
        suggestions[objection] = suggestCounterStrategy(objection, techniques);
    });
    
    return {
        topObjections,
        techniques,
        suggestions,
    };
}

/**
 * Command-line interface.
 */
async function main() {
    try {
        const report = await generateReport();
        console.log('=== Objection Intelligence Report ===');
        console.log('\nTop Objections:');
        report.topObjections.forEach(({ objection, frequency }, i) => {
            console.log(`${i + 1}. "${objection}" (${frequency} occurrence${frequency > 1 ? 's' : ''})`);
        });
        console.log('\nSuggested Counter‑Strategies:');
        Object.entries(report.suggestions).forEach(([obj, suggestion], i) => {
            console.log(`${i + 1}. For "${obj}": ${suggestion}`);
        });
        console.log('\nSuccessful Techniques Observed:');
        report.techniques.forEach((tech, i) => {
            console.log(`${i + 1}. ${tech}`);
        });
    } catch (err) {
        console.error('Error generating objection report:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateReport, parseReview, suggestCounterStrategy };