const http = require('http');

const PORT = 3000;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Canteen Management & Supabase Migration Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Test 1: Check Database Status
    console.log('\n[Test 1] DB Diagnostics:');
    const dbStatus = await request('GET', '/api/db-status');
    assert(dbStatus.status === 200, 'DB status returns 200');
    assert(dbStatus.body && dbStatus.body.provider !== undefined, `DB Provider detected: ${dbStatus.body?.provider}`);

    // Test 2: FR-01 & NFR-03 Authentication
    console.log('\n[Test 2] FR-01 & NFR-03 Authentication:');
    const invalidLogin = await request('POST', '/api/auth/login', { username: 'student', password: 'wrongpassword' });
    assert(invalidLogin.status === 401, 'NFR-03: Rejects invalid password with 401');

    const validStudentLogin = await request('POST', '/api/auth/login', { username: 'student', password: 'student123' });
    assert(validStudentLogin.status === 200, 'Allows valid student login');
    assert(validStudentLogin.body.role === 'user', 'Student has role "user"');

    const validAdminLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    assert(validAdminLogin.status === 200, 'Allows valid admin login');
    assert(validAdminLogin.body.role === 'admin', 'Admin has role "admin"');

    // Test 3: FR-02 Food Items Retrieval & Filtering
    console.log('\n[Test 3] FR-02 Food Items Menu Retrieval:');
    const allItems = await request('GET', '/api/food-items');
    assert(allItems.status === 200, 'Can fetch all food items');
    assert(Array.isArray(allItems.body) && allItems.body.length >= 12, `Fetched ${allItems.body?.length} food items`);

    const breakfastItems = await request('GET', '/api/food-items?category=breakfast');
    assert(breakfastItems.status === 200 && breakfastItems.body.every(i => i.category === 'breakfast'), 'Filter by category breakfast works');

    const searchResult = await request('GET', '/api/food-items?search=biryani');
    assert(searchResult.status === 200 && searchResult.body.some(i => i.name.toLowerCase().includes('biryani')), 'Search by name works');

    // Test 4: FR-06 & NFR-04 Food Items Admin Management & Security
    console.log('\n[Test 4] FR-06 & NFR-04 Admin Food Management & Security:');
    const unauthorizedAdd = await request('POST', '/api/food-items', {
      name: 'Unauthorized Burger',
      category: 'snacks',
      price: 60
    }, { 'x-user-role': 'user' });
    assert(unauthorizedAdd.status === 403, 'NFR-04: Non-admin rejected with 403 Forbidden');

    const adminAdd = await request('POST', '/api/food-items', {
      name: 'Paneer Butter Masala',
      category: 'lunch',
      price: 90,
      description: 'Cottage cheese cubes in rich spiced butter gravy.'
    }, { 'x-user-role': 'admin' });
    assert(adminAdd.status === 201, 'Admin can add food item (201 Created)');
    const createdItemId = adminAdd.body.id;

    const adminUpdate = await request('PUT', `/api/food-items/${createdItemId}`, {
      price: 95
    }, { 'x-user-role': 'admin' });
    assert(adminUpdate.status === 200 && adminUpdate.body.price === 95, 'Admin can update food item price');

    const adminDelete = await request('DELETE', `/api/food-items/${createdItemId}`, null, { 'x-user-role': 'admin' });
    assert(adminDelete.status === 200, 'Admin can remove food item');

    // Test 5: FR-03 & FR-04 Order Placement & Confirmation
    console.log('\n[Test 5] FR-03 & FR-04 Place and Confirm Order:');
    const orderPayload = {
      user_id: validStudentLogin.body.id,
      customer_name: validStudentLogin.body.full_name,
      items: [
        { food_item_id: 1, name: 'Idli', price: 30, quantity: 2 },
        { food_item_id: 10, name: 'Tea', price: 15, quantity: 1 }
      ]
    };
    const orderRes = await request('POST', '/api/orders', orderPayload);
    assert(orderRes.status === 201, 'Order placed successfully (201 Created)');
    assert(orderRes.body.total_amount === 75, `Order total calculated correctly (₹75 = 2x30 + 15), got ₹${orderRes.body.total_amount}`);
    assert(orderRes.body.status === 'Pending', 'Initial order status is "Pending"');

    // Test 6: FR-05 Order Status and Order History
    console.log('\n[Test 6] FR-05 View Order Status & Order History:');
    const ordersRes = await request('GET', `/api/orders?user_id=${validStudentLogin.body.id}`);
    assert(ordersRes.status === 200 && ordersRes.body.length > 0, 'Can retrieve user order history');

    const orderId = orderRes.body.id;
    const updateStatusRes = await request('PUT', `/api/orders/${orderId}/status`, { status: 'Preparing' });
    assert(updateStatusRes.status === 200 && updateStatusRes.body.status === 'Preparing', 'Can update order status to "Preparing"');

    console.log(`\n--- Test Summary: ${passed} passed, ${failed} failed ---`);
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test run error:', err);
    process.exit(1);
  }
}

runTests();
