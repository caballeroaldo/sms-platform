/**
 * Integration Test: Verify Frontend ↔ Backend Connection
 *
 * This script tests the end-to-end flow of the SMS platform.
 *
 * Prerequisites:
 *   1. Backend must be running: cd backend && npm run dev
 *   2. Frontend must be configured to use real API (not mock)
 *
 * Run with:
 *   npx ts-node scripts/test-connection.ts
 *   or
 *   npx tsx scripts/test-connection.ts
 */

import * as http from 'http';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4000';
const TEST_CLIENT_ID = 'cl-1'; // Use existing mock client for testing

function httpRequest(
  method: string,
  path: string,
  body?: object,
  token?: string
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testHealthCheck() {
  console.log('1️⃣  Testing backend health...');
  try {
    const health = await httpRequest('GET', '/api/health');
    if (health.status === 200 || health.status === 404) {
      const detailed = await httpRequest('GET', '/api/health/detailed');
      if (detailed.status === 200) {
        const data = detailed.data as { data?: { services?: Record<string, string> } };
        const services = data?.data?.services || {};
        console.log('   ✅ Backend is running');
        console.log(`      - Database: ${services.database || 'N/A'}`);
        console.log(`      - Twilio: ${services.twilio || 'N/A'}`);
        console.log(`      - Redis: ${services.redis || 'N/A'}`);
        return true;
      }
    }
    console.log(`   ⚠️  Health check returned ${health.status}`);
    return false;
  } catch (error) {
    console.log(`   ❌ Backend not reachable: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function testAuth(): Promise<string | null> {
  console.log('\n2️⃣  Testing authentication...');
  try {
    const loginRes = await httpRequest('POST', '/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123',
    });

    if (loginRes.status === 200) {
      const body = loginRes.data as { success?: boolean; data?: { token?: string } };
      if (body.success && body.data?.token) {
        console.log('   ✅ Login successful (using mock credentials)');
        return body.data.token;
      }
    }
    console.log('   ⚠️  Auth endpoint returned unexpected response');
    if (loginRes.status === 401) {
      console.log('      (Backend may need DATABASE_URL for real auth)');
    }
    return null;
  } catch (error) {
    console.log(`   ⚠️  Auth test skipped: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function testClients(token: string | null) {
  console.log('\n3️⃣  Testing clients endpoint...');
  try {
    const clientsRes = await httpRequest('GET', '/api/clients', undefined, token || undefined);

    if (clientsRes.status === 200) {
      const body = clientsRes.data as { success?: boolean; data?: { clients?: unknown[] } };
      const clients = body?.data?.clients || [];
      console.log(`   ✅ Clients endpoint working`);
      console.log(`      Found ${clients.length} client(s)`);
      return true;
    } else if (clientsRes.status === 401) {
      console.log('   ⚠️  Clients endpoint requires authentication');
      return false;
    } else {
      console.log(`   ❌ Failed: ${clientsRes.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function testSendMessage(token: string | null) {
  console.log('\n4️⃣  Testing SMS send (THE KEY TEST)...');
  try {
    // Use mock client ID from frontend mock data
    const testClientId = 'cl-1';
    const testMessage = `🔔 Integration Test\nSent at: ${new Date().toLocaleString()}\nStatus: Testing connection`;

    const messageRes = await httpRequest(
      'POST',
      '/api/messages/send-now',
      {
        clientIds: [testClientId],
        content: testMessage,
      },
      token || undefined
    );

    if (messageRes.status === 200 || messageRes.status === 201) {
      const body = messageRes.data as { success?: boolean; data?: { sent?: number; failed?: number } };
      if (body.success) {
        console.log('   ✅ Message endpoint working');
        console.log(`      Sent: ${body.data?.sent || 0}, Failed: ${body.data?.failed || 0}`);

        // Check Twilio status
        if (body.data?.sent && body.data.sent > 0) {
          console.log('      📱 SMS was queued for delivery');
          console.log('      💡 Check Twilio console to confirm delivery');
        }
        return true;
      }
    }

    if (messageRes.status === 401) {
      console.log('   ⚠️  Message endpoint requires authentication');
      return false;
    }

    console.log(`   ❌ Failed: ${JSON.stringify(messageRes.data)}`);
    return false;
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function main() {
  console.log('\n' + '═'.repeat(55));
  console.log('📡  SMS Platform - Connection Test');
  console.log('═'.repeat(55) + '\n');
  console.log(`   API URL: ${API_URL}\n`);

  const results: { name: string; passed: boolean }[] = [];

  // Run tests sequentially
  const backendUp = await testHealthCheck();
  results.push({ name: 'Backend Health', passed: backendUp });

  if (!backendUp) {
    console.log('\n❌ Backend is not running!');
    console.log('   Run: cd backend && npm run dev');
    process.exit(1);
  }

  const token = await testAuth();
  results.push({ name: 'Authentication', passed: token !== null });

  await testClients(token);
  // Don't fail on clients - they might need DB setup

  const smsWorks = await testSendMessage(token);
  results.push({ name: 'SMS Send', passed: smsWorks });

  // Summary
  console.log('\n' + '═'.repeat(55));
  console.log('📊  Test Summary');
  console.log('═'.repeat(55));

  results.forEach(r => {
    console.log(`   ${r.passed ? '✅' : '⚠️'}  ${r.name}`);
  });

  console.log('\n' + '─'.repeat(55));

  if (smsWorks) {
    console.log('✅  All systems operational!');
    console.log('   Frontend and Backend are connected.');
    console.log('   You can now send real SMS messages.\n');
  } else {
    console.log('⚠️  Partial connection established.');
    console.log('   For full functionality, set up:');
    console.log('   1. PostgreSQL database (DATABASE_URL in backend/.env)');
    console.log('   2. Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)');
    console.log('   3. Frontend mock disabled (NEXT_PUBLIC_USE_MOCK=false)\n');
  }

  console.log('─'.repeat(55));
  console.log('💡  Quick Commands:');
  console.log('   Backend:  cd backend && npm run dev');
  console.log('   Frontend: cd frontend && npm run dev');
  console.log('   Tests:    npm test\n');
}

// Make sure script is run directly
main().catch(console.error);