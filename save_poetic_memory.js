const { saveMemoryWithEmbedding } = require('./utils.js');

async function main() {
    const memory = {
        type: 'conversation',
        content: 'User sent a series of poetic, abstract messages: "Play music. It\'s just Japanese. When do you play? Doing everything. So now I will meet you. But honey, sorry. Is it just a way to say? Do you lying all the time? Just gave me you. Begin Shani Bhagnan Sachdeva song. Tune into." Followed by "Try and not to learn.", "The Kings wouldn\'t be so, and I wanted to use.", "Can I always hear you?", "Without a typical." This appears to be stream‑of‑consciousness, lyrical, possibly testing assistant\'s response style.',
        importance: 5,
        tags: ['poetic', 'music', 'abstract', 'stream_of_consciousness']
    };
    try {
        const saved = await saveMemoryWithEmbedding(memory);
        console.log('Poetic conversation memory saved:', saved.id);
    } catch (err) {
        console.error('Failed to save memory:', err.message);
        process.exit(1);
    }
}

main();