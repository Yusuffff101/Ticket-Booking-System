import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/prisma.js';

const app = createApp();
const PORT = 5099;

async function runTests() {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`🧪 Test server running on http://localhost:${PORT}`);
      resolve();
    });
  });

  const baseUrl = `http://localhost:${PORT}/api`;

  try {
    console.log('\n--- 1. Healthcheck Test ---');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('Health status:', healthRes.status, healthData);
    if (healthRes.status !== 200 || healthData.status !== 'healthy') {
      throw new Error('Healthcheck failed');
    }

    console.log('\n--- 2. Admin Login Test ---');
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@ticketbooking.com',
        password: 'Password123!',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    console.log('Admin login status:', adminLoginRes.status, 'Role:', adminLoginData.data?.user?.role);
    if (adminLoginRes.status !== 200 || !adminLoginData.data?.tokens?.accessToken) {
      throw new Error('Admin login failed');
    }
    const adminToken = adminLoginData.data.tokens.accessToken;
    const adminRefreshToken = adminLoginData.data.tokens.refreshToken;

    console.log('\n--- 3. Customer Login Test ---');
    const customerLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'Password123!',
      }),
    });
    const customerLoginData = await customerLoginRes.json();
    console.log('Customer login status:', customerLoginRes.status, 'Role:', customerLoginData.data?.user?.role);
    if (customerLoginRes.status !== 200 || !customerLoginData.data?.tokens?.accessToken) {
      throw new Error('Customer login failed');
    }
    const customerToken = customerLoginData.data.tokens.accessToken;

    console.log('\n--- 4. Profile /me Endpoint Test ---');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meData = await meRes.json();
    console.log('Profile status:', meRes.status, 'Name:', meData.data?.name);
    if (meRes.status !== 200 || meData.data?.email !== 'admin@ticketbooking.com') {
      throw new Error('Profile fetch failed');
    }

    console.log('\n--- 5. RBAC Guard: Admin Accessing Admin Route ---');
    const adminRouteRes = await fetch(`${baseUrl}/auth/admin-only`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminRouteData = await adminRouteRes.json();
    console.log('Admin accessing admin-only status:', adminRouteRes.status, adminRouteData.message);
    if (adminRouteRes.status !== 200) {
      throw new Error('Admin could not access admin-only route');
    }

    console.log('\n--- 6. RBAC Guard: Customer Accessing Admin Route (Should get 403) ---');
    const customerAdminRouteRes = await fetch(`${baseUrl}/auth/admin-only`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const customerAdminRouteData = await customerAdminRouteRes.json();
    console.log('Customer accessing admin-only status:', customerAdminRouteRes.status, customerAdminRouteData.error);
    if (customerAdminRouteRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden, got ${customerAdminRouteRes.status}`);
    }

    console.log('\n--- 7. Register New User Test ---');
    const randomEmail = `test_${Date.now()}@example.com`;
    const registerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        email: randomEmail,
        password: 'Password123!',
      }),
    });
    const registerData = await registerRes.json();
    console.log('Register status:', registerRes.status, 'New user email:', registerData.data?.user?.email);
    if (registerRes.status !== 201 || registerData.data?.user?.email !== randomEmail) {
      throw new Error('Registration failed');
    }

    console.log('\n--- 8. Refresh Token Rotation Test ---');
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    const refreshData = await refreshRes.json();
    console.log('Refresh status:', refreshRes.status, 'Got new accessToken:', !!refreshData.data?.accessToken);
    if (refreshRes.status !== 200 || !refreshData.data?.accessToken) {
      throw new Error('Token refresh failed');
    }

    console.log('\n🎉 ALL PHASE 1 INTEGRATION TESTS PASSED PERFECTLY! 🎉\n');
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite error:', err);
  process.exit(1);
});
