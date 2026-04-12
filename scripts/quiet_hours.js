#!/usr/bin/env node

const TIMEZONE = 'America/New_York';

function getEasternHour(date = new Date()) {
    return parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        hour: 'numeric',
        hour12: false
    }).format(date));
}

function isQuietHours() {
    const hour = getEasternHour();
    return hour >= 23 || hour < 7;
}

if (isQuietHours()) {
    console.log('quiet');
} else {
    console.log('active');
}