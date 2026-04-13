function parsePersonalLog(logLine) {
    const match = logLine.match(/Log my activity:\s*(\d+)\s*pitches,\s*(\d+)\s*meetings booked,\s*(\d+)\s*voicemails,\s*(\d+)\s*follow-ups,\s*(\d+)\s*meetings pending\s*,?\s*(.*)/i);
    if (!match) {
        throw new Error('Invalid personal log format. Expected: "Log my activity: [X] pitches, [X] meetings booked, [X] voicemails, [X] follow-ups, [X] meetings pending, [optional notes]"');
    }
    const [, pitches, meetingsBooked, voicemails, followUps, meetingsPending, notes] = match;
    return {
        pitches: parseInt(pitches),
        meetingsBooked: parseInt(meetingsBooked),
        voicemails: parseInt(voicemails),
        followUps: parseInt(followUps),
        meetingsPending: parseInt(meetingsPending),
        notes: (notes || '').trim(),
    };
}

const line = 'Log my activity: 35 pitches, 2 meetings booked, 15 voicemails, 10 follow-ups, 2 meetings pending, strong day on objection handling';
console.log('Testing:', line);
try {
    const m = parsePersonalLog(line);
    console.log('Parsed:', m);
} catch (e) {
    console.log('Error:', e.message);
}