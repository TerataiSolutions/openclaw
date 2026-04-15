const DOCUMENT_TYPES = {
 // Partner Collateral / Deliverables > Sales Materials
 cold_call_script_client: {
 id: 'cold_call_script_client',
 name: 'Cold Call Script (Client-Provided)',
 folder: 'Partner Collateral / Deliverables',
 subfolder: 'Sales Materials',
 description: 'Source material provided by client during onboarding reflecting their original messaging and positioning',
 purpose: 'Reference material for understanding client voice. Read-only. Never paraphrased or modified.',
 confidence_level: 'high',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['opening_statement', 'value_proposition', 'objection_responses', 'closing_statement', 'key_differentiators']
 },
 cold_call_script_opp: {
 id: 'cold_call_script_opp',
 name: 'Cold Call Script (OPP-Produced)',
 folder: 'OPP Deliverables',
 subfolder: null,
 description: 'Strategy-driven execution asset developed by OPP team building on client source material',
 purpose: 'Optimized outbound cold calling script for execution. OPP-authored.',
 confidence_level: 'high',
 source_type: 'opp_produced',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['opening_statement', 'value_proposition', 'objection_responses', 'closing_statement', 'key_differentiators', 'strategic_notes']
 },
 client_knowledge_base: {
  id: 'client_knowledge_base',
  name: 'Client Knowledge Base',
  folder: 'Partner Collateral / Deliverables',
  subfolder: 'Sales Materials',
  description: 'Comprehensive verified knowledge base document prepared by Opp Agency Sales Enablement Division covering company overview, services, ICP, differentiators, messaging, objection handling, and talk tracks',
  purpose: 'Master reference document for all client intelligence. High authority source for BDR preparation, call strategy, and campaign development.',
  confidence_level: 'high',
  source_type: 'opp_produced',
  file_formats: ['docx', 'pdf'],
  extract_fields: ['company_overview', 'services', 'icp', 'differentiators', 'messaging', 'objections', 'talk_tracks', 'approved_claims', 'prohibited_claims']
 },
 icp_file: {
 id: 'icp_file',
 name: 'ICP File',
 folder: 'Partner Collateral / Deliverables',
 subfolder: 'Sales Materials',
 description: 'Ideal Customer Profile defining target company and persona',
 purpose: 'Defines who to target. Authoritative on target market.',
 confidence_level: 'high',
 source_type: 'client_provided',
 file_formats: ['pptx', 'pdf', 'docx'],
 extract_fields: ['target_company_profile', 'target_persona', 'pain_points', 'triggers', 'disqualifiers', 'firmographics']
 },
 client_sales_presentation: {
 id: 'client_sales_presentation',
 name: 'Client Sales Presentation',
 folder: 'Partner Collateral / Deliverables',
 subfolder: 'Sales Materials',
 description: 'Client sales deck',
 purpose: 'Understanding client positioning and how they present to prospects.',
 confidence_level: 'high',
 source_type: 'client_provided',
 file_formats: ['html', 'pdf', 'pptx'],
 extract_fields: ['value_proposition', 'product_overview', 'differentiators', 'social_proof', 'call_to_action']
 },
 demo: {
 id: 'demo',
 name: 'Demo',
 folder: 'Partner Collateral / Deliverables',
 subfolder: 'Sales Materials',
 description: 'Product or service demonstration material',
 purpose: 'Understanding what the product does in practice.',
 confidence_level: 'high',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx', 'html'],
 extract_fields: ['product_features', 'use_cases', 'technical_requirements', 'key_outcomes']
 },
 lead_magnet: {
 id: 'lead_magnet',
 name: 'Lead Magnet',
 folder: 'Partner Collateral / Deliverables',
 subfolder: 'Approved to Share with Prospects',
 description: 'Prospect-facing content approved for sharing',
 purpose: 'Content to use in outreach to attract prospects.',
 confidence_level: 'high',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['key_message', 'target_audience', 'value_offered', 'call_to_action']
 },
 one_pager: {
 id: 'one_pager',
 name: 'One-Pager',
 folder: 'Partner Collateral / Deliverables',
 subfolder: 'Approved to Share with Prospects',
 description: 'Single-page prospect-facing summary document',
 purpose: 'Quick reference for prospects. Approved for sharing.',
 confidence_level: 'high',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['headline', 'value_proposition', 'key_benefits', 'differentiators', 'contact_information']
 },
 discovery_call_transcript: {
 id: 'discovery_call_transcript',
 name: 'Discovery Call Transcript',
 folder: 'Discovery / Presentation Recordings / Transcriptions',
 subfolder: null,
 description: 'Transcript from discovery call recording',
 purpose: 'Extract decisions, commitments, objections, and action items.',
 confidence_level: 'medium',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['decisions_made', 'commitments', 'objections_raised', 'action_items', 'key_stakeholders', 'pain_points_mentioned']
 },
 presentation_transcript: {
 id: 'presentation_transcript',
 name: 'Presentation Transcript',
 folder: 'Discovery / Presentation Recordings / Transcriptions',
 subfolder: null,
 description: 'Transcript from presentation recording',
 purpose: 'Extract messaging, positioning, and prospect reactions.',
 confidence_level: 'medium',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['key_messages', 'prospect_reactions', 'objections_raised', 'decisions_made', 'follow_up_items']
 },
 sales_enablement_transcript: {
 id: 'sales_enablement_transcript',
 name: 'Sales Enablement Transcript',
 folder: 'Discovery / Presentation Recordings / Transcriptions',
 subfolder: null,
 description: 'Transcript from sales enablement session recording',
 purpose: 'Extract training insights, best practices, and coaching points.',
 confidence_level: 'medium',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['best_practices', 'coaching_points', 'key_techniques', 'examples_given', 'action_items']
 },
 partnership_recording_transcript: {
 id: 'partnership_recording_transcript',
 name: 'Partnership Recording Transcript',
 folder: 'Discovery / Presentation Recordings / Transcriptions',
 subfolder: null,
 description: 'Transcript from partnership meeting recording',
 purpose: 'Extract partnership decisions, commitments, and strategic direction.',
 confidence_level: 'medium',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['decisions_made', 'commitments', 'strategic_direction', 'action_items', 'key_stakeholders']
 },
 call_recording_transcript: {
 id: 'call_recording_transcript',
 name: 'Call Recording Transcript',
 folder: 'Discovery / Presentation Recordings / Transcriptions',
 subfolder: null,
 description: 'Transcript from cold call or sales call recording',
 purpose: 'Extract objections, successful techniques, and prospect sentiment.',
 confidence_level: 'medium',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['objections_raised', 'successful_techniques', 'prospect_sentiment', 'outcome', 'follow_up_required']
 },
 go_to_market_playbook: {
 id: 'go_to_market_playbook',
 name: 'Go-to-Market Playbook',
 folder: 'OPP Deliverables',
 subfolder: null,
 description: 'OPP-produced GTM strategy and execution playbook',
 purpose: 'Master strategic document for campaign execution.',
 confidence_level: 'high',
 source_type: 'opp_produced',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['campaign_strategy', 'target_segments', 'messaging_framework', 'channel_strategy', 'kpis', 'timeline']
 },
 dashboard_export: {
 id: 'dashboard_export',
 name: 'Dashboard Export',
 folder: 'GTM Progress',
 subfolder: null,
 description: 'Exported metrics and performance data from campaign dashboard',
 purpose: 'Hard performance data. Track campaign metrics over time.',
 confidence_level: 'high',
 source_type: 'client_provided',
 file_formats: ['pdf', 'docx'],
 extract_fields: ['date_range', 'pitches_made', 'meetings_booked', 'voicemails_dropped', 'follow_ups', 'meetings_pending', 'response_rate', 'conversion_rate']
 }
};

function getDocumentType(id) {
 return DOCUMENT_TYPES[id] || null;
}

function validateDocumentType(id) {
 if (!DOCUMENT_TYPES[id]) {
 throw new Error(`Unknown document type: '${id}'. Valid types: ${Object.keys(DOCUMENT_TYPES).join(', ')}`);
 }
 return DOCUMENT_TYPES[id];
}

function getDocumentsByFolder(folder) {
 return Object.values(DOCUMENT_TYPES).filter(d => d.folder === folder);
}

module.exports = { DOCUMENT_TYPES, getDocumentType, validateDocumentType, getDocumentsByFolder };