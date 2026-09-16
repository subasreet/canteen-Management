-- ==========================================================
-- Supabase PostgreSQL Schema for College Canteen Management
-- ==========================================================

-- 1. Users Table (FR-01: User and Admin Authentication)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' or 'admin'
    full_name VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Food Items Table (FR-02, FR-06: Food item catalog and admin management)
CREATE TABLE IF NOT EXISTS food_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'breakfast', 'lunch', 'snacks', 'drinks'
    price NUMERIC(10, 2) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Orders Table (FR-04, FR-05: Order placement, status and history)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Order Items Table (FR-03, FR-04: Items within each confirmed order)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    food_item_id INT REFERENCES food_items(id) ON DELETE SET NULL,
    food_name VARCHAR(150) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- Enable Row Level Security (Optional: adjust as needed for Supabase)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Permissive policies for application backend or anon client (if using direct REST)
CREATE POLICY "Allow public read of food items" ON food_items FOR SELECT USING (true);
CREATE POLICY "Allow authenticated admin food modifications" ON food_items FOR ALL USING (true);
CREATE POLICY "Allow user orders read" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow user orders insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow user order_items read" ON order_items FOR SELECT USING (true);
CREATE POLICY "Allow user order_items insert" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow user read" ON users FOR SELECT USING (true);

-- ==========================================================
-- Initial Seed Data
-- ==========================================================

-- Seed Users: Admin and Student
INSERT INTO users (username, password, role, full_name)
VALUES 
    ('admin', 'admin123', 'admin', 'Canteen Administrator'),
    ('student', 'student123', 'user', 'Demo Student')
ON CONFLICT (username) DO NOTHING;

-- Seed 12 Food Items from Existing Canteen Menu
INSERT INTO food_items (name, category, price, description, image_url, is_available)
VALUES
    ('Idli', 'breakfast', 30.00, 'Soft South Indian idli served with chutney and sambar.', 'https://images.unsplash.com/photo-1630383249896-424e482df921', true),
    ('Dosa', 'breakfast', 50.00, 'Crispy dosa served with chutney and sambar.', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976', true),
    ('Poori', 'breakfast', 45.00, 'Hot and fluffy poori served with potato masala.', 'https://images.unsplash.com/photo-1626132647523-66f5bf380027', true),
    ('Chicken Biryani', 'lunch', 120.00, 'Delicious aromatic chicken biryani with special spices.', 'https://images.unsplash.com/photo-1563379091339-03246963d96c', true),
    ('South Indian Meals', 'lunch', 80.00, 'Rice, curry, vegetables and traditional side dishes.', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d', true),
    ('Fried Rice', 'lunch', 70.00, 'Tasty vegetable fried rice with fresh vegetables.', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b', true),
    ('Samosa', 'snacks', 20.00, 'Crispy samosa filled with spicy potato.', 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7', true),
    ('Medu Vada', 'snacks', 15.00, 'Crispy South Indian vada served with chutney.', 'https://images.unsplash.com/photo-1601050690597-df0568f70950', true),
    ('Vegetable Sandwich', 'snacks', 40.00, 'Fresh vegetable sandwich with tasty filling.', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af', true),
    ('Tea', 'drinks', 15.00, 'Hot and refreshing tea.', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574', true),
    ('Coffee', 'drinks', 20.00, 'Hot and fresh filter coffee.', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93', true),
    ('Lemon Juice', 'drinks', 25.00, 'Fresh and refreshing lemon juice.', 'https://images.unsplash.com/photo-1621263764928-df1444c5e859', true)
ON CONFLICT DO NOTHING;
