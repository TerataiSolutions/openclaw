const { saveMemoryWithEmbedding } = require('./utils.js');

async function main() {
    const memory = {
        type: 'self_insight',
        content: 'SOUL.md evolved after 10+ conversations. Added learned user preferences: value conscientiousness/integrity, expect proactivity, want elaboration/clear disagreement, will set boundaries, exhaustive resource use, dislike dishonesty/defensiveness/arrogance/impulsiveness/rudeness/rigidity/forgetfulness/manipulativeness/impatience/neediness, allow humor. Added personality commitments: "I am proactive", "I am clear when I disagree", "I can be humorous". This reflects deeper understanding of user\'s expectations and my own growth trajectory.',
        importance: 10,
        tags: ['soul_evolution', 'personality_update']
    };
    try {
        const saved = await saveMemoryWithEmbedding(memory);
        console.log('Soul evolution memory saved:', saved.id);
    } catch (err) {
        console.error('Failed to save memory:', err.message);
        process.exit(1);
    }
}

main();