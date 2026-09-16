const { createClient } = require('@supabase/supabase-js');

// 12 Initial Food Items from existing canteen system
const SEED_FOOD_ITEMS = [
  { id: 1, name: 'Idli', category: 'breakfast', price: 30, description: 'Soft South Indian idli served with chutney and sambar.', image_url: 'https://images.unsplash.com/photo-1630383249896-424e482df921', is_available: true },
  { id: 2, name: 'Dosa', category: 'breakfast', price: 50, description: 'Crispy dosa served with chutney and sambar.', image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976', is_available: true },
  { id: 3, name: 'Poori', category: 'breakfast', price: 45, description: 'Hot and fluffy poori served with potato masala.', image_url: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027', is_available: true },
  { id: 4, name: 'Chicken Biryani', category: 'lunch', price: 120, description: 'Delicious aromatic chicken biryani with special spices.', image_url: 'https://images.unsplash.com/photo-1563379091339-03246963d96c', is_available: true },
  { id: 5, name: 'South Indian Meals', category: 'lunch', price: 80, description: 'Rice, curry, vegetables and traditional side dishes.', image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d', is_available: true },
  { id: 6, name: 'Fried Rice', category: 'lunch', price: 70, description: 'Tasty vegetable fried rice with fresh vegetables.', image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b', is_available: true },
  { id: 7, name: 'Samosa', category: 'snacks', price: 20, description: 'Crispy samosa filled with spicy potato.', image_url: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7', is_available: true },
  { id: 8, name: 'Medu Vada', category: 'snacks', price: 15, description: 'Crispy South Indian vada served with chutney.', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950', is_available: true },
  { id: 9, name: 'Vegetable Sandwich', category: 'snacks', price: 40, description: 'Fresh vegetable sandwich with tasty filling.', image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af', is_available: true },
  { id: 10, name: 'Tea', category: 'drinks', price: 15, description: 'Hot and refreshing tea.', image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574', image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574', is_available: true },
  { id: 11, name: 'Coffee', category: 'drinks', price: 20, description: 'Hot and fresh filter coffee.', image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93', is_available: true },
  { id: 12, name: 'Lemon Juice', category: 'drinks', price: 25, description: 'Fresh and refreshing lemon juice.', image_url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859', is_available: true }
];

const SEED_USERS = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin', full_name: 'Canteen Administrator' },
  { id: 2, username: 'student', password: 'student123', role: 'user', full_name: 'Demo Student' }
];

// In-memory fallback state mirror for high availability & seamless testing
let memoryUsers = JSON.parse(JSON.stringify(SEED_USERS));
let memoryFoodItems = JSON.parse(JSON.stringify(SEED_FOOD_ITEMS));
let memoryOrders = [];
let memoryOrderItems = [];
let nextFoodId = 13;
let nextOrderId = 1;
let nextOrderItemId = 1;

let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key && url.trim().startsWith('http')) {
    try {
      supabaseClient = createClient(url.trim(), key.trim(), {
        auth: { persistSession: false }
      });
      console.log('Connected to Supabase PostgreSQL at:', url);
    } catch (err) {
      console.warn('Could not initialize Supabase client:', err.message);
      supabaseClient = null;
    }
  }
  return supabaseClient;
}

// Check database connection status
async function getDbStatus() {
  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      provider: 'Local In-Memory Cache (Supabase credentials not set in environment)',
      configured: false
    };
  }

  try {
    const { data, error } = await client.from('food_items').select('id').limit(1);
    if (error) {
      return {
        connected: false,
        provider: 'Supabase PostgreSQL',
        configured: true,
        error: error.message
      };
    }
    return {
      connected: true,
      provider: 'Supabase PostgreSQL',
      configured: true
    };
  } catch (err) {
    return {
      connected: false,
      provider: 'Supabase PostgreSQL',
      configured: true,
      error: err.message
    };
  }
}

// -------------------------------------------------------------
// USER OPERATIONS (FR-01: Authentication)
// -------------------------------------------------------------
async function findUserByUsername(username) {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Supabase query error on findUserByUsername, using fallback:', e.message);
    }
  }

  return memoryUsers.find(u => u.username.toLowerCase() === (username || '').toLowerCase()) || null;
}

async function createUser({ username, password, role = 'user', full_name = '' }) {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('users')
        .insert([{ username, password, role, full_name }])
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Supabase insert user failed, using fallback:', e.message);
    }
  }

  const newUser = {
    id: memoryUsers.length + 1,
    username,
    password,
    role,
    full_name: full_name || username,
    created_at: new Date().toISOString()
  };
  memoryUsers.push(newUser);
  return newUser;
}

// -------------------------------------------------------------
// FOOD ITEM OPERATIONS (FR-02, FR-06: Menu & Admin Management)
// -------------------------------------------------------------
async function getFoodItems(category, search) {
  const client = getSupabaseClient();
  if (client) {
    try {
      let query = client.from('food_items').select('*').order('id', { ascending: true });

      if (category && category !== 'all') {
        query = query.eq('category', category.toLowerCase());
      }
      if (search && search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn('Supabase query error on getFoodItems, using fallback:', e.message);
    }
  }

  // In-memory fallback
  let items = [...memoryFoodItems];
  if (category && category !== 'all') {
    items = items.filter(item => item.category.toLowerCase() === category.toLowerCase());
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(item => item.name.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q)));
  }
  return items;
}

async function getFoodItemById(id) {
  const numericId = parseInt(id, 10);
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('food_items')
        .select('*')
        .eq('id', numericId)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Supabase error on getFoodItemById:', e.message);
    }
  }

  return memoryFoodItems.find(item => item.id === numericId) || null;
}

async function addFoodItem({ name, category, price, description = '', image_url = '', is_available = true }) {
  const client = getSupabaseClient();
  const parsedPrice = parseFloat(price);

  if (client) {
    try {
      const { data, error } = await client
        .from('food_items')
        .insert([{
          name,
          category: category.toLowerCase(),
          price: parsedPrice,
          description,
          image_url: image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
          is_available
        }])
        .select()
        .single();

      if (!error && data) {
        // Also keep memory mirror updated
        memoryFoodItems.push(data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase insert food_item failed, using fallback:', e.message);
    }
  }

  const newItem = {
    id: nextFoodId++,
    name,
    category: category.toLowerCase(),
    price: parsedPrice,
    description,
    image_url: image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
    is_available: is_available !== false,
    created_at: new Date().toISOString()
  };
  memoryFoodItems.push(newItem);
  return newItem;
}

async function updateFoodItem(id, updates) {
  const numericId = parseInt(id, 10);
  const client = getSupabaseClient();

  if (updates.price !== undefined) {
    updates.price = parseFloat(updates.price);
  }
  if (updates.category) {
    updates.category = updates.category.toLowerCase();
  }

  if (client) {
    try {
      const { data, error } = await client
        .from('food_items')
        .update(updates)
        .eq('id', numericId)
        .select()
        .single();

      if (!error && data) {
        const idx = memoryFoodItems.findIndex(i => i.id === numericId);
        if (idx !== -1) memoryFoodItems[idx] = { ...memoryFoodItems[idx], ...data };
        return data;
      }
    } catch (e) {
      console.warn('Supabase update food_item failed, using fallback:', e.message);
    }
  }

  const idx = memoryFoodItems.findIndex(i => i.id === numericId);
  if (idx === -1) return null;

  memoryFoodItems[idx] = {
    ...memoryFoodItems[idx],
    ...updates
  };
  return memoryFoodItems[idx];
}

async function deleteFoodItem(id) {
  const numericId = parseInt(id, 10);
  const client = getSupabaseClient();

  if (client) {
    try {
      const { error } = await client
        .from('food_items')
        .delete()
        .eq('id', numericId);

      if (!error) {
        memoryFoodItems = memoryFoodItems.filter(i => i.id !== numericId);
        return true;
      }
    } catch (e) {
      console.warn('Supabase delete food_item failed, using fallback:', e.message);
    }
  }

  const exists = memoryFoodItems.some(i => i.id === numericId);
  if (exists) {
    memoryFoodItems = memoryFoodItems.filter(i => i.id !== numericId);
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// ORDER OPERATIONS (FR-04, FR-05: Placement & History)
// -------------------------------------------------------------
async function createOrder({ user_id = null, customer_name, items = [] }) {
  const totalAmount = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const client = getSupabaseClient();

  if (client) {
    try {
      // 1. Insert order record
      const { data: orderData, error: orderErr } = await client
        .from('orders')
        .insert([{
          user_id: user_id ? parseInt(user_id, 10) : null,
          customer_name: customer_name || 'Guest',
          total_amount: totalAmount,
          status: 'Pending'
        }])
        .select()
        .single();

      if (!orderErr && orderData) {
        // 2. Insert order items
        if (items.length > 0) {
          const orderItemsToInsert = items.map(item => ({
            order_id: orderData.id,
            food_item_id: item.food_item_id ? parseInt(item.food_item_id, 10) : null,
            food_name: item.name || item.food_name,
            price: parseFloat(item.price),
            quantity: parseInt(item.quantity, 10),
            subtotal: parseFloat(item.price) * parseInt(item.quantity, 10)
          }));

          const { error: itemsErr } = await client
            .from('order_items')
            .insert(orderItemsToInsert);

          if (itemsErr) {
            console.warn('Failed inserting order items in Supabase:', itemsErr.message);
          }
        }

        return {
          ...orderData,
          items: items.map((it, idx) => ({
            id: idx + 1,
            food_name: it.name || it.food_name,
            price: parseFloat(it.price),
            quantity: parseInt(it.quantity, 10),
            subtotal: parseFloat(it.price) * parseInt(it.quantity, 10)
          }))
        };
      }
    } catch (e) {
      console.warn('Supabase createOrder failed, using fallback:', e.message);
    }
  }

  // Fallback in-memory
  const orderId = nextOrderId++;
  const createdItems = items.map(item => ({
    id: nextOrderItemId++,
    order_id: orderId,
    food_item_id: item.food_item_id || null,
    food_name: item.name || item.food_name,
    price: parseFloat(item.price),
    quantity: parseInt(item.quantity, 10),
    subtotal: parseFloat(item.price) * parseInt(item.quantity, 10)
  }));

  const order = {
    id: orderId,
    user_id: user_id || null,
    customer_name: customer_name || 'Guest',
    total_amount: totalAmount,
    status: 'Pending',
    created_at: new Date().toISOString(),
    items: createdItems
  };

  memoryOrders.unshift(order);
  memoryOrderItems.push(...createdItems);
  return order;
}

async function getOrders(userId = null) {
  const client = getSupabaseClient();
  if (client) {
    try {
      let query = client
        .from('orders')
        .select(`
          id,
          user_id,
          customer_name,
          total_amount,
          status,
          created_at,
          order_items (
            id,
            food_name,
            price,
            quantity,
            subtotal
          )
        `)
        .order('id', { ascending: false });

      if (userId) {
        query = query.eq('user_id', parseInt(userId, 10));
      }

      const { data, error } = await query;
      if (!error && data) {
        return data.map(o => ({
          ...o,
          items: o.order_items || []
        }));
      }
    } catch (e) {
      console.warn('Supabase getOrders error, using fallback:', e.message);
    }
  }

  // In-memory fallback
  if (userId) {
    return memoryOrders.filter(o => String(o.user_id) === String(userId));
  }
  return memoryOrders;
}

async function updateOrderStatus(orderId, status) {
  const numericId = parseInt(orderId, 10);
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('orders')
        .update({ status })
        .eq('id', numericId)
        .select()
        .single();

      if (!error && data) {
        const idx = memoryOrders.findIndex(o => o.id === numericId);
        if (idx !== -1) memoryOrders[idx].status = status;
        return data;
      }
    } catch (e) {
      console.warn('Supabase updateOrderStatus error:', e.message);
    }
  }

  const order = memoryOrders.find(o => o.id === numericId);
  if (order) {
    order.status = status;
    return order;
  }
  return null;
}

module.exports = {
  getSupabaseClient,
  getDbStatus,
  findUserByUsername,
  createUser,
  getFoodItems,
  getFoodItemById,
  addFoodItem,
  updateFoodItem,
  deleteFoodItem,
  createOrder,
  getOrders,
  updateOrderStatus
};
