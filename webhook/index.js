#!/usr/bin/env node

const express = require('express');
const bodyParser = require('body-parser');
const handleMemoryInsert = require('./memory_insert_handler.js');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(bodyParser.json());

// Health check
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'memory-insert-webhook' });
});

// Supabase webhook endpoint
app.post('/webhook/memory-insert', (req, res) => {
    handleMemoryInsert(req, res).catch(err => {
        console.error('Unhandled error in webhook handler:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
});

app.listen(PORT, () => {
    console.log(`Memory‑insert webhook listening on port ${PORT}`);
});