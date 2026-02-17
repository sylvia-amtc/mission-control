/**
 * Twenty CRM Integration Module
 * Syncs companies, contacts, and opportunities from Twenty CRM (crm.amtc.tv)
 * into the Mission Control local SQLite pipeline.
 */

const { db, stmts, logActivity } = require('./db');

const TWENTY_URL = process.env.TWENTY_CRM_URL || 'https://crm.amtc.tv';
const TWENTY_GRAPHQL = `${TWENTY_URL}/graphql`;

// Auth credentials for Twenty CRM
const TWENTY_EMAIL = process.env.TWENTY_EMAIL || 'elena@amtc.tv';
const TWENTY_PASSWORD = process.env.TWENTY_PASSWORD || 'AmteccoMC2024!';

let cachedAccessToken = null;
let tokenExpiresAt = 0;

// ─── Auth ───────────────────────────────────────────────────────

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  // Step 1: Sign in to get login token
  const signInRes = await gql(null, `mutation {
    signIn(email: "${TWENTY_EMAIL}", password: "${TWENTY_PASSWORD}") {
      availableWorkspaces {
        availableWorkspacesForSignIn {
          id loginToken
        }
      }
    }
  }`);

  const workspaces = signInRes?.data?.signIn?.availableWorkspaces?.availableWorkspacesForSignIn;
  if (!workspaces?.length) throw new Error('No workspaces found');

  const loginToken = workspaces[0].loginToken;

  // Step 2: Exchange login token for access token
  const tokenRes = await gql(null, `mutation {
    getAuthTokensFromLoginToken(loginToken: "${loginToken}", origin: "${TWENTY_URL}") {
      tokens {
        accessOrWorkspaceAgnosticToken { token expiresAt }
        refreshToken { token }
      }
    }
  }`);

  const tokens = tokenRes?.data?.getAuthTokensFromLoginToken?.tokens;
  if (!tokens) throw new Error('Failed to get access tokens');

  cachedAccessToken = tokens.accessOrWorkspaceAgnosticToken.token;
  tokenExpiresAt = new Date(tokens.accessOrWorkspaceAgnosticToken.expiresAt).getTime();

  return cachedAccessToken;
}

async function gql(token, query) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(TWENTY_GRAPHQL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ─── Data Fetching ──────────────────────────────────────────────

async function fetchCompanies(token) {
  const res = await gql(token, `{
    companies(first: 100) {
      edges {
        node {
          id name employees
          annualRecurringRevenue { amountMicros currencyCode }
          createdAt updatedAt
          domainName { primaryLinkUrl primaryLinkLabel }
          people { edges { node {
            id jobTitle
            name { firstName lastName }
            emails { primaryEmail }
          } } }
          opportunities { edges { node {
            id name stage amount { amountMicros currencyCode }
            closeDate probability createdAt
          } } }
        }
      }
      totalCount
    }
  }`);

  if (res.errors) throw new Error(`GraphQL error: ${JSON.stringify(res.errors)}`);
  return res.data.companies;
}

// ─── Stage Mapping ──────────────────────────────────────────────

const TWENTY_TO_MC_STAGE = {
  'PROSPECT': 'lead',
  'QUALIFIED': 'qualified',
  'DEMO': 'opportunity',
  'PROPOSAL': 'proposal',
  'NEGOTIATION': 'proposal',
  'CLOSED_WON': 'closed_won',
  'CLOSED_LOST': 'closed_lost',
};

function mapStage(twentyStage) {
  return TWENTY_TO_MC_STAGE[twentyStage] || 'lead';
}

// ─── Sync Logic ─────────────────────────────────────────────────

async function syncFromTwenty() {
  console.log('[Twenty CRM] Starting sync...');

  const token = await getAccessToken();
  const companies = await fetchCompanies(token);

  if (!companies?.edges?.length) {
    console.log('[Twenty CRM] No companies found');
    return { ok: true, source: 'twenty', companies: 0, deals: 0, contacts: 0 };
  }

  let dealCount = 0;
  let contactCount = 0;
  let companyCount = companies.edges.length;

  const sync = db.transaction(() => {
    // Clear old CRM-synced data (preserve manual entries)
    db.prepare("DELETE FROM crm_pipeline WHERE source = 'twenty-crm'").run();

    for (const edge of companies.edges) {
      const company = edge.node;
      const people = company.people?.edges || [];
      const opportunities = company.opportunities?.edges || [];

      // Primary contact for this company
      const primaryContact = people[0]?.node;
      const contactName = primaryContact
        ? `${primaryContact.name.firstName} ${primaryContact.name.lastName}`
        : '';
      const contactEmail = primaryContact?.emails?.primaryEmail || '';
      contactCount += people.length;

      if (opportunities.length > 0) {
        // Company has opportunities - create a deal per opportunity
        for (const oppEdge of opportunities) {
          const opp = oppEdge.node;
          const valueMicros = opp.amount?.amountMicros || 0;
          const value = valueMicros / 1000000;
          const currency = opp.amount?.currencyCode || 'USD';

          stmts.insertDeal.run({
            company_name: company.name,
            contact_name: contactName,
            stage: mapStage(opp.stage),
            value: value,
            currency: currency,
            owner: contactEmail ? contactName : '',
            source: 'twenty-crm',
            notes: `Twenty Opp: ${opp.name || ''}. Contact: ${contactName} ${contactEmail ? '(' + contactEmail + ')' : ''}. Employees: ${company.employees || 'N/A'}`,
            cross_sell_products: '[]',
            expected_close: opp.closeDate ? opp.closeDate.split('T')[0] : null,
            crm_id: opp.id,
          });
          dealCount++;
        }
      } else {
        // No opportunities yet — add as a lead/prospect
        stmts.insertDeal.run({
          company_name: company.name,
          contact_name: contactName,
          stage: 'lead',
          value: 0,
          currency: 'USD',
          owner: '',
          source: 'twenty-crm',
          notes: `Target account. Contact: ${contactName} ${contactEmail ? '(' + contactEmail + ')' : ''}. Employees: ${company.employees || 'N/A'}. ${primaryContact?.jobTitle || ''}`.trim(),
          cross_sell_products: '[]',
          expected_close: null,
          crm_id: company.id,
        });
        dealCount++;
      }
    }
  });

  sync();

  logActivity('sync', 'crm', 0, `Twenty CRM synced: ${companyCount} companies, ${dealCount} pipeline entries, ${contactCount} contacts`, 'system');
  console.log(`[Twenty CRM] Synced: ${companyCount} companies, ${dealCount} pipeline entries, ${contactCount} contacts`);

  return {
    ok: true,
    source: 'twenty',
    companies: companyCount,
    deals: dealCount,
    contacts: contactCount,
  };
}

// ─── Initial Sync ───────────────────────────────────────────────

async function initialSync() {
  try {
    await syncFromTwenty();
  } catch (e) {
    console.error('[Twenty CRM] Initial sync failed:', e.message);
  }
}

module.exports = { syncFromTwenty, initialSync, getAccessToken, fetchCompanies };
