const { clients } = require('./registry.js');
const { validateDocumentType, DOCUMENT_TYPES } = require('./glossary.js');
const { processFile } = require('./file_processor.js');
const { saveMemoryWithEmbedding } = require('../utils.js');
const { updateClientState } = require('./client_state.js');
const { sendMessage } = require('../cron/message_bridge.js');

async function ingestDocument({ file_content, file_buffer, client_id, document_type_id, file_format, notes = '' }) {
 // Validate client
 const client = clients.find(c => c.id === client_id);
 if (!client) throw new Error(`Invalid client_id: '${client_id}'. Valid clients: ${clients.map(c => c.id).join(', ')}`);

 // Validate document type
 const docType = validateDocumentType(document_type_id);

 // Validate file format
 const fmt = file_format.toLowerCase().replace('.', '');
 if (!docType.file_formats.includes(fmt)) {
 throw new Error(`File format '${file_format}' not supported for ${docType.name}. Supported: ${docType.file_formats.join(', ')}`);
 }

 // Confirmation step
 const confirmMsg = `INGESTION REQUEST\nClient: ${client.name}\nDocument Type: ${docType.name}\nFolder: ${docType.folder}${docType.subfolder ? ' > ' + docType.subfolder : ''}\nSource: ${docType.source_type}\nConfidence Level: ${docType.confidence_level}\n\nReply YES to proceed or NO to cancel.`;
 await sendMessage(confirmMsg);

 // Wait for confirmation -- poll for YES/NO response
 // Note: confirmation is handled by AGENTS.md protocol.
 // The agent will call proceedWithIngestion() after user confirms YES.
 return { status: 'awaiting_confirmation', client: client.name, document_type: docType.name };
}

async function proceedWithIngestion({ file_content, file_buffer, client_id, document_type_id, file_format, notes = '', source_document_name = 'unknown' }) {
 const client = clients.find(c => c.id === client_id);
 const docType = DOCUMENT_TYPES[document_type_id];
 const fmt = file_format.toLowerCase().replace('.', '');

 // Process file
 const buffer = file_buffer || Buffer.from(file_content || '', 'utf8');
 const processed = await processFile(buffer, fmt);

 const memories_created = [];
 const folder_path = `${docType.folder}${docType.subfolder ? ' > ' + docType.subfolder : ''}`;

 // Special handling for cold_call_script_client -- store verbatim
 if (document_type_id === 'cold_call_script_client') {
 const memory = await saveMemoryWithEmbedding({
 type: 'client_intel',
 content: `[SOURCE MATERIAL - VERBATIM - DO NOT PARAPHRASE]\n${processed.text}`,
 importance: 9,
 tags: [client_id, document_type_id, 'source_material', 'verbatim'],
 client_id,
 document_type: document_type_id,
 confidence_level: 'high',
 folder_path,
 source_type: 'client_provided',
 notes: `Source: ${source_document_name}. ${notes}`
 });
 memories_created.push(memory);
 }
 // Special handling for transcripts -- extract structured items
 else if (['discovery_call_transcript', 'presentation_transcript', 'sales_enablement_transcript', 'partnership_recording_transcript', 'call_recording_transcript'].includes(document_type_id)) {
 for (const section of processed.sections) {
 if (section.content.length > 100) {
 const memory = await saveMemoryWithEmbedding({
 type: 'client_intel',
 content: section.content,
 importance: 7,
 tags: [client_id, document_type_id, 'transcript'],
 client_id,
 document_type: document_type_id,
 confidence_level: 'medium',
 folder_path,
 source_type: 'client_provided',
 notes: `Source: ${source_document_name}. Section: ${section.title}. ${notes}`
 });
 memories_created.push(memory);
 }
 }
 }
 // All other document types -- extract key facts by section
 else {
 for (const section of processed.sections) {
 if (section.content.length > 80) {
 const memory = await saveMemoryWithEmbedding({
 type: 'client_intel',
 content: section.content,
 importance: 8,
 tags: [client_id, document_type_id, docType.source_type],
 client_id,
 document_type: document_type_id,
 confidence_level: docType.confidence_level,
 folder_path,
 source_type: docType.source_type,
 notes: `Source: ${source_document_name}. Section: ${section.title}. ${notes}`
 });
 memories_created.push(memory);
 }
 }
 }

 // Update client state
 await updateClientState(client_id, {
 last_interaction_summary: `Ingested ${docType.name} (${source_document_name}). ${memories_created.length} memories created.`
 });

 // Send completion summary
 const summary = `INGESTION COMPLETE\nClient: ${client.name}\nDocument: ${docType.name}\nSource: ${source_document_name}\nMemories created: ${memories_created.length}\nConfidence: ${docType.confidence_level}\nFolder: ${folder_path}`;
 await sendMessage(summary);

 return { memories_created: memories_created.length, client: client.name, document_type: docType.name, confidence_level: docType.confidence_level };
}

module.exports = { ingestDocument, proceedWithIngestion };