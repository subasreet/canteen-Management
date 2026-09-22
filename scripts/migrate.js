require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SEED_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin', full_name: 'Canteen Administrator' },
  { username: 'student', password: 'student123', role: 'user', full_name: 'Demo Student' }
];

const SEED_FOOD_ITEMS = [
  { name: 'Idli', category: 'breakfast', price: 30, description: 'Soft South Indian idli served with chutney and sambar.', image_url: 'https://images.unsplash.com/photo-1630383249896-424e482df921', is_available: true },
  { name: 'Dosa', category: 'breakfast', price: 50, description: 'Crispy dosa served with chutney and sambar.', image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976', is_available: true },
  { name: 'Poori', category: 'breakfast', price: 45, description: 'Hot and fluffy poori served with potato masala.', image_url: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027', is_available: true },
  { name: 'Chicken Biryani', category: 'lunch', price: 120, description: 'Delicious aromatic chicken biryani with special spices.', image_url: 'https://images.unsplash.com/photo-1563379091339-03246963d96c', is_available: true },
  { name: 'South Indian Meals', category: 'lunch', price: 80, description: 'Rice, curry, vegetables and traditional side dishes.', image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d', is_available: true },
  { name: 'Fried Rice', category: 'lunch', price: 70, description: 'Tasty vegetable fried rice with fresh vegetables.', image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b', is_available: true },
  { name: 'Samosa', category: 'snacks', price: 20, description: 'Crispy samosa filled with spicy potato.', image_url: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7', is_available: true },
  { name: 'Medu Vada', category: 'snacks', price: 15, description: 'Crispy South Indian vada served with chutney.', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950', is_available: true },
  { name: 'Vegetable Sandwich', category: 'snacks', price: 40, description: 'Fresh vegetable sandwich with tasty filling.', image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af', is_available: true },
  { name: 'Tea', category: 'drinks', price: 15, description: 'Hot and refreshing tea.', image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574', is_available: true },
  { name: 'Coffee', category: 'drinks', price: 20, description: 'Hot and fresh filter coffee.', image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93', is_available: true },
  { name: 'Lemon Juice', category: 'drinks', price: 25, description: 'Fresh and refreshing lemon juice.', image_url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859', is_available: true }
];

async function migrate() {
  console.log('--- Starting Supabase Data Migration ---');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log('ℹ SUPABASE_URL or SUPABASE_ANON_KEY not set.');
    console.log('  The backend is currently operating with in-memory SQLite/Postgres mirror.');
    console.log('  To connect to your own Supabase project:');
    console.log('  1. Run the SQL script located in supabase/schema.sql in your Supabase SQL Editor.');
    console.log('  2. Configure SUPABASE_URL and SUPABASE_ANON_KEY in your environment/Settings.');
    return;
  }

  console.log(`Connecting to Supabase at: ${url}`);
  const supabase = createClient(url, key);

  // 1. Migrate Users
  console.log('\nMigrating Users...');
  for (const user of SEED_USERS) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', user.username)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('users').insert([user]);
      if (error) {
        console.error(`  ✗ Error migrating user ${user.username}:`, error.message);
      } else {
        console.log(`  ✓ Inserted user: ${user.username} (${user.role})`);
      }
    } else {
      console.log(`  ✓ User already exists: ${user.username}`);
    }
  }

  // 2. Migrate Food Items
  console.log('\nMigrating Food Items (12 Items from SRS/Canteen Menu)...');
  for (const item of SEED_FOOD_ITEMS) {
    const { data: existing } = await supabase
      .from('food_items')
      .select('id')
      .eq('name', item.name)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('food_items').insert([item]);
      if (error) {
        console.error(`  ✗ Error inserting ${item.name}:`, error.message);
      } else {
        console.log(`  ✓ Migrated: ${item.name} (${item.category}, ₹${item.price})`);
      }
    } else {
      console.log(`  ✓ Food item already exists: ${item.name}`);
    }
  }

  console.log('\n--- Supabase Migration Complete! ---');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
