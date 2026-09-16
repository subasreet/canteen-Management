const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from root directory
app.use(express.static(path.join(__dirname, '.')));

// -------------------------------------------------------------------
// Database Status & Diagnostics API
// -------------------------------------------------------------------
app.get('/api/db-status', async (req, res) => {
  try {
    const status = await db.getDbStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// FR-01: Authentication API (Login, Logout, Me)
// -------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await db.findUserByUsername(username.trim());
    // NFR-03: Reject invalid login credentials with 100% accuracy
    if (!user || user.password !== password.trim()) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Return sanitized user profile
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name || user.username
    });
  } catch (err) {
    res.status(500).json({ error: 'Authentication service error: ' + err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, full_name, role = 'user' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const existing = await db.findUserByUsername(username.trim());
    if (existing) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const newUser = await db.createUser({
      username: username.trim(),
      password: password.trim(),
      role: role === 'admin' ? 'admin' : 'user',
      full_name: full_name ? full_name.trim() : username.trim()
    });

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      full_name: newUser.full_name
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// -------------------------------------------------------------------
// FR-02: Food Items Menu API
// -------------------------------------------------------------------
app.get('/api/food-items', async (req, res) => {
  try {
    const { category, search } = req.query;
    const items = await db.getFoodItems(category, search);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch food items: ' + err.message });
  }
});

app.get('/api/food-items/:id', async (req, res) => {
  try {
    const item = await db.getFoodItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Food item not found.' });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch item: ' + err.message });
  }
});

// Middleware to enforce NFR-04: Restrict food-item management to authenticated administrators
function requireAdmin(req, res, next) {
  const role = req.headers['x-user-role'];
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }
  next();
}

// -------------------------------------------------------------------
// FR-06: Administrator Management of Food Items (Add, Update, Remove)
// -------------------------------------------------------------------
app.post('/api/food-items', requireAdmin, async (req, res) => {
  const { name, category, price, description, image_url, is_available } = req.body;

  if (!name || !category || price === undefined) {
    return res.status(400).json({ error: 'Name, category, and price are required.' });
  }

  try {
    const newItem = await db.addFoodItem({
      name: name.trim(),
      category: category.trim().toLowerCase(),
      price: parseFloat(price),
      description: description ? description.trim() : '',
      image_url: image_url ? image_url.trim() : '',
      is_available: is_available !== false
    });
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create food item: ' + err.message });
  }
});

app.put('/api/food-items/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await db.updateFoodItem(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Food item not found.' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update food item: ' + err.message });
  }
});

app.delete('/api/food-items/:id', requireAdmin, async (req, res) => {
  try {
    const success = await db.deleteFoodItem(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Food item not found or already deleted.' });
    }
    res.json({ message: 'Food item removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove food item: ' + err.message });
  }
});

// -------------------------------------------------------------------
// FR-04: Place and Confirm Food Orders
// -------------------------------------------------------------------
app.post('/api/orders', async (req, res) => {
  const { user_id, customer_name, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one food item.' });
  }

  try {
    const order = await db.createOrder({
      user_id: user_id || null,
      customer_name: (customer_name || 'Student').trim(),
      items
    });
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to place order: ' + err.message });
  }
});

// -------------------------------------------------------------------
// FR-05: Order Status and Order History
// -------------------------------------------------------------------
app.get('/api/orders', async (req, res) => {
  try {
    const { user_id } = req.query;
    const orders = await db.getOrders(user_id);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders: ' + err.message });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    const updated = await db.updateOrderStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status: ' + err.message });
  }
});

// Frontend pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/canteen.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'canteen.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Canteen Management Server running at http://0.0.0.0:${PORT}`);
});
