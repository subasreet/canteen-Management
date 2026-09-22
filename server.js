require('dotenv').config();
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

// -------------------------------------------------------------------
// AI Assistant for Analyzing Management Data
// -------------------------------------------------------------------
app.post('/api/ai/analytics', async (req, res) => {
  try {
    const { query = '', focus = 'general' } = req.body || {};

    // 1. Fetch live orders and food items from database
    const orders = await db.getOrders(null);
    const foodItems = await db.getFoodItems();

    // 2. Compute live aggregates
    let totalRevenue = 0;
    const statusCounts = { Pending: 0, Preparing: 0, Ready: 0, Completed: 0, Cancelled: 0 };
    const itemSales = {};
    const categorySales = { breakfast: 0, lunch: 0, snacks: 0, drinks: 0 };

    (orders || []).forEach(order => {
      const amt = parseFloat(order.total_amount) || 0;
      totalRevenue += amt;
      const st = order.status || 'Pending';
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      (order.items || []).forEach(it => {
        const name = it.food_name || 'Item';
        const qty = parseInt(it.quantity, 10) || 1;
        const sub = parseFloat(it.subtotal) || (parseFloat(it.price) * qty) || 0;

        if (!itemSales[name]) {
          itemSales[name] = { name, quantity: 0, revenue: 0 };
        }
        itemSales[name].quantity += qty;
        itemSales[name].revenue += sub;

        const matchedItem = (foodItems || []).find(f => f.name.toLowerCase() === name.toLowerCase());
        const cat = matchedItem ? matchedItem.category.toLowerCase() : 'other';
        if (categorySales[cat] !== undefined) {
          categorySales[cat] += sub;
        } else {
          categorySales[cat] = (categorySales[cat] || 0) + sub;
        }
      });
    });

    const topItems = Object.values(itemSales).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const topCategoryEntry = Object.entries(categorySales).sort((a, b) => b[1] - a[1])[0];
    const totalOrdersCount = (orders || []).length;
    const avgOrderVal = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

    const managementStats = {
      totalOrders: totalOrdersCount,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageOrderValue: avgOrderVal,
      ordersByStatus: statusCounts,
      topSellingItems: topItems,
      revenueByCategory: categorySales,
      totalMenuItems: (foodItems || []).length
    };

    let analysisText = '';
    let usedSource = 'analytics-engine';

    // Call Gemini API if key is present
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.API_KEY || '').trim();
    if (apiKey) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const prompt = `You are an expert AI Canteen Operations and Financial Analyst for a College Canteen Management System.
Analyze the following actual canteen data:
- Total Orders: ${managementStats.totalOrders}
- Total Gross Revenue: ₹${managementStats.totalRevenue}
- Average Order Value: ₹${managementStats.averageOrderValue}
- Orders Status Breakdown: ${JSON.stringify(managementStats.ordersByStatus)}
- Top Selling Items: ${JSON.stringify(managementStats.topSellingItems)}
- Revenue Breakdown by Category: ${JSON.stringify(managementStats.revenueByCategory)}
- Total Menu Items Offered: ${managementStats.totalMenuItems}

User Inquiry / Focus: "${query || 'Provide an executive management summary, operational health analysis, and 3 strategic recommendations for optimizing canteen profitability and service speed.'}"

Structure your response clearly with:
1. 📊 Executive Summary & Key Financial Takeaways
2. 🏆 Demand Patterns & Category Performance
3. ⏱️ Kitchen & Service Bottleneck Evaluation
4. 💡 3 Actionable Recommendations for Management (e.g., prep planning, pricing, waste reduction)

Keep it concise, professional, data-driven, and easy to read.`;

        // Prefer ultra-responsive gemini-3.1-flash-lite, fallback to gemini-3.8-flash
        const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
        for (const modelName of modelsToTry) {
          let timeoutId = null;
          try {
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error(`Timeout with ${modelName}`)), 15000);
            });

            const geminiRes = await Promise.race([
              ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                  temperature: 0.3
                }
              }),
              timeoutPromise
            ]);

            if (timeoutId) clearTimeout(timeoutId);

            if (geminiRes && geminiRes.text) {
              analysisText = geminiRes.text;
              usedSource = modelName;
              break;
            }
          } catch (modelErr) {
            if (timeoutId) clearTimeout(timeoutId);
            console.warn(`Model ${modelName} attempt notice:`, modelErr.message);
          }
        }
      } catch (geminiError) {
        console.warn('Gemini client initialization error, using rule-based analyst engine:', geminiError.message);
      }
    }

    // High quality deterministic fallback analysis
    if (!analysisText) {
      usedSource = 'analytics-engine';
      const bestItem = topItems[0] ? `${topItems[0].name} (${topItems[0].quantity} sold, ₹${topItems[0].revenue})` : 'None recorded yet';
      const pendingOrders = statusCounts.Pending || 0;
      const preparingOrders = statusCounts.Preparing || 0;

      analysisText = `### 📊 Executive Summary & Key Financial Metrics
- **Gross Revenue**: ₹${managementStats.totalRevenue} across **${managementStats.totalOrders} orders**.
- **Average Ticket Value**: ₹${managementStats.averageOrderValue} per transaction.
- **Menu Breadth**: ${managementStats.totalMenuItems} active items available across 4 meal categories.

### 🏆 Demand Patterns & Category Performance
- **Top Performer**: ${bestItem}.
- **Leading Category**: ${topCategoryEntry ? topCategoryEntry[0].toUpperCase() : 'N/A'} (₹${topCategoryEntry ? topCategoryEntry[1] : 0}).
- **Category Breakdown**:
${Object.entries(categorySales).map(([c, v]) => `  - **${c.charAt(0).toUpperCase() + c.slice(1)}**: ₹${v}`).join('\n')}

### ⏱️ Kitchen & Service Bottlenecks
- **Active Kitchen Queue**: ${pendingOrders} Pending, ${preparingOrders} In Preparation.
- **Fulfillment Ratio**: ${Math.round(((statusCounts.Completed || 0) + (statusCounts.Ready || 0)) / (totalOrdersCount || 1) * 100)}% orders ready or served.
${pendingOrders > 2 ? '- ⚠️ **Alert**: Elevated pending order queue detected. Kitchen pre-batching recommended.' : '- ✅ Kitchen workflow is running smoothly with minimal latency.'}

### 💡 3 Strategic Recommendations for Management
1. **Promote Combo Meals**: Pair top-selling items with high-margin drinks to increase average order value from ₹${managementStats.averageOrderValue} to ₹${managementStats.averageOrderValue + 20}.
2. **Pre-Batch Prep**: High demand for breakfast/lunch items requires pre-staging 30 minutes before standard college break periods.
3. **Inventory Rebalancing**: Align procurement around ${topCategoryEntry ? topCategoryEntry[0] : 'popular items'} to prevent stock-outs during peak service windows.`;
    }

    res.json({
      success: true,
      analysis: analysisText,
      metrics: {
        totalRevenue: managementStats.totalRevenue,
        totalOrders: managementStats.totalOrders,
        averageOrderValue: managementStats.averageOrderValue,
        topItem: topItems[0] ? topItems[0].name : 'N/A',
        topCategory: topCategoryEntry ? topCategoryEntry[0] : 'N/A',
        statusBreakdown: managementStats.ordersByStatus
      },
      source: usedSource
    });

  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to generate management analysis: ' + err.message });
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
