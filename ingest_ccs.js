#!/usr/bin/env node

const { saveMemoryWithEmbedding } = require('./utils.js');

const memories = [
    {
        type: 'client_intel',
        importance: 9,
        tags: ['customer_contact_services', 'company_overview', 'client_knowledge_base'],
        content: 'Customer Contact Services (CCS) is a virtual contact center solutions company founded in 1972 (51+ years in operation). Headquartered at 14525 Highway 7, Suite 315, Minnetonka, MN 55345. Phone: 952-936-4000 / 888-832-5397. Sales email: Sales@yourccsteam.com. Website: yourccsteam.com. Team size: 300-350+ agents distributed across 18+ states, 100% North American-based with coverage in 45 states. Brick and mortar: 140+ seat facility in Illinois. Nearshore and offshore options available. Approximately 95% US-based agents. Mission: We enable businesses to do what they do best by enhancing lives one connection at a time. Vision: To be the contact service provider of choice for businesses looking to create exceptional connections with their customers. Core values: Every Connection Matters, Show Up and Answer the Call, Relentlessly Creative, Your Need Our Focus.',
        client_id: 'customer_contact_services'
    },
    {
        type: 'client_intel',
        importance: 9,
        tags: ['customer_contact_services', 'leadership', 'key_contacts', 'client_knowledge_base'],
        content: 'CCS Leadership: Aundrea Mitchell - President (since May 2020, previously Director of Operations 2012-2020). Accountable for hiring/staffing, forecasting, reporting, training, QA, and operational performance. APPOINTMENT POINT OF CONTACT - booking link: https://calendly.com/aundrea-mitchell-yourccsteam/new-meeting. Andrea Godsave - CFO, 17+ years with CCS, leads finance, regulatory reporting, budget/forecast, M&A due diligence. Mandy Shultz - Sales leadership, 20 years with CCS, leads sales division. Luanne Bibeau - Human Resources Manager, 5+ years with CCS.',
        client_id: 'customer_contact_services'
    },
    {
        type: 'client_intel',
        importance: 8,
        tags: ['customer_contact_services', 'services', 'TAS', 'client_knowledge_base'],
        content: 'CCS Service Line 1 - Telephone Answering Service (TAS): After hours answering, bilingual service, live answering, virtual receptionists, phone/voicemail answering, texting/SMS, live chat, email support, social media support. Coverage: full 24/7, business hours, after-hours, weekends, overnights, holidays, overflow. Average deal size: as small as $1,200/month, ranges from small business through Fortune 500. Average sales cycle: can close in a day. Average client lifecycle: 9 years.',
        client_id: 'customer_contact_services'
    },
    {
        type: 'client_intel',
        importance: 8,
        tags: ['customer_contact_services', 'services', 'BPO', 'client_knowledge_base'],
        content: 'CCS Service Line 2 - Business Process Outsourcing (BPO): Inbound and outbound customer engagement, outsourced support, back-office processing. Explicitly listed: Outbound Call Center, Order Taking/Reservations, Questionnaires and Surveys. Note: Outbound Call Center capability is listed without detail on type of outbound work. Do not claim CCS does outbound sales or lead generation specifically until Aundrea Mitchell confirms scope.',
        client_id: 'customer_contact_services'
    },
    {
        type: 'client_intel',
        importance: 8,
        tags: ['customer_contact_services', 'differentiators', 'client_knowledge_base'],
        content: 'CCS key differentiators: 51+ years in operation (founded 1972), 300-350+ agents across 18+ states, 95% US-based workforce, 140+ seat brick and mortar facility in Illinois, nearshore and offshore options available, 9-year average client lifecycle (TAS), flexible coverage including 24/7 and overflow, bilingual service available. Consultative sales process flows from Sales to Implementation to Support.',
        client_id: 'customer_contact_services'
    },
    {
        type: 'client_intel',
        importance: 8,
        tags: ['customer_contact_services', 'ICP', 'target_market', 'client_knowledge_base'],
        content: 'CCS serves businesses ranging from small business through Fortune 500. Industries served include healthcare, legal, property management, real estate, financial services, and any business requiring 24/7 customer contact coverage or overflow support. Ideal prospects: businesses with high inbound call volume, after-hours coverage gaps, or need for outsourced customer-facing operations.',
        client_id: 'customer_contact_services'
    },
    {
        type: 'client_intel',
        importance: 9,
        tags: ['customer_contact_services', 'approved_claims', 'prohibited_claims', 'client_knowledge_base'],
        content: 'APPROVED CLAIMS for BDR use: CCS has been in operation for 51+ years. CCS has 300-350+ agents across 18+ US states. CCS is 95% US-based. CCS offers TAS, BPO, and outbound call center services. CCS serves clients from small business through Fortune 500. Average TAS client stays 9 years. PROHIBITED CLAIMS: Do not claim CCS does outbound sales campaigns or lead generation. Do not claim specific PCI compliance status until confirmed by Aundrea Mitchell. Do not invent metrics not in source materials.',
        client_id: 'customer_contact_services'
    },
    {
        type: 'client_intel',
        importance: 8,
        tags: ['customer_contact_services', 'objections', 'gaps', 'client_knowledge_base'],
        content: 'Critical gaps in CCS source materials: (1) Probing Questions section in sales materials is blank. (2) No documented response to Not Interested objection. (3) Outbound Call Center scope unconfirmed. (4) PCI compliance status unconfirmed. (5) Bella role unconfirmed. (6) BPO pricing not documented. These gaps directly contribute to the 25-pitches-0-meetings red flag scenario and must be resolved with Aundrea Mitchell.',
        client_id: 'customer_contact_services'
    }
];

async function main() {
    console.log(`Starting CCS knowledge base ingestion (${memories.length} memories)...`);
    let successCount = 0;
    for (let i = 0; i < memories.length; i++) {
        const mem = memories[i];
        try {
            const saved = await saveMemoryWithEmbedding(mem);
            if (saved) {
                successCount++;
                console.log(`✓ Memory ${i+1} saved (${mem.type}, importance ${mem.importance})`);
            } else {
                console.error(`✗ Memory ${i+1} failed to save (no error thrown)`);
            }
        } catch (err) {
            console.error(`✗ Memory ${i+1} error: ${err.message}`);
        }
    }
    console.log(`Ingestion complete. ${successCount}/${memories.length} memories saved.`);
    process.exit(successCount === memories.length ? 0 : 1);
}

if (require.main === module) {
    main().catch(err => {
        console.error('Unhandled error:', err);
        process.exit(1);
    });
}