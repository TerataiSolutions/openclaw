'use strict';

require('dotenv').config();
const { updateClientState } = require('../clients/updateClientState');

const OPP_AGENCY_STATE = {
  current_campaign_strategy:
    "Omni-channel outbound (cold call, cold email, LinkedIn) on behalf of B2B clients " +
    "across SaaS, professional services, and adjacent sectors. Fractional BDR team runs " +
    "simultaneous campaigns across 12 active clients. Core performance standard: 1 meeting " +
    "booked per 25 pitches. Below that threshold requires immediate diagnosis across three " +
    "variables: message-market fit, lead quality, and BDR execution.",

  icp_focus:
    "Varies by client campaign. OPP's own ICP for new client acquisition: B2B companies " +
    "spending on outbound sales or considering building an outbound function. Decision makers: " +
    "CEOs, CROs, VP Sales at companies between $2M-$50M ARR who lack internal SDR/BDR capacity " +
    "or are dissatisfied with current outbound performance.",

  messaging_working: [
    "Fractional BDR model: outbound revenue without full-time headcount cost",
    "Speed to pipeline: campaigns live within [X] days of contract",
    "Performance accountability: meeting-per-pitch ratio as the core metric",
    "Multi-client experience as signal: pattern recognition across verticals"
  ],

  messaging_not_working: [],

  key_contacts: [
    "Lance Goldman - CEO",
    "Cole Smith - CRO",
    "Jennifer Holahan - Director of Client Success"
  ],

  red_flags: [
    "BDR pitch rate below 1 meeting per 25 requires immediate triage — not a trend to monitor",
    "Client messaging that cannot be reduced to a single qualifying question is not ready for BDR execution",
    "Lead list quality issues compound faster than messaging issues — diagnose data before script"
  ],

  open_items: [],

  active_priorities: [
    "Maintain performance standard across all 12 active client campaigns",
    "BDR coaching cadence: identify execution gaps before they become metric failures",
    "Message-market fit review cycle: flag scripts showing declining conversion"
  ],

  performance_benchmarks: {
    target_meetings_per_pitches: "1:25",
    alert_threshold: "below 1:25 on any active campaign",
    review_cadence: "weekly per client"
  },

  internal_structure: {
    ceo: "Lance Goldman",
    cro: "Cole Smith",
    director_client_success: "Jennifer Holahan",
    revenue_architect_sales_enablement: "Kanji Yokai"
  },

  notes:
    "OPP is both a client-of-record in the system and the operating context for all BDR " +
    "performance, coaching, and client management work. Treat OPP state updates as high-priority."
};

async function run() {
  console.log('[seed] Writing OPP Agency initial state...');
  try {
    const result = await updateClientState('opp_agency', OPP_AGENCY_STATE, {
      importance: 10,
      extra_tags: ['internal', 'seed']
    });
    console.log('[seed] Success.');
    console.log(`  New row ID: ${result.newRowId}`);
    console.log(`  Version timestamp: ${result.version}`);
    console.log(`  Previous version ID: ${result.previousVersionId || 'none (first write)'}`);
  } catch (err) {
    console.error('[seed] Failed:', err.message);
    process.exit(1);
  }
}

run();
