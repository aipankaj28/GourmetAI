-- SQL Schema for GourmetAI Multi-tenant Setup

-- 1. Restaurants Table
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    total_tables INTEGER DEFAULT 10 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Menu Items Table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category TEXT NOT NULL, -- e.g., Starter, Main Course
    type TEXT NOT NULL,     -- e.g., Veg, Non-Veg
    availability BOOLEAN DEFAULT true NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    table_number TEXT,
    status TEXT DEFAULT 'In Progress' NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure Realtime sends the full row (essential for JSONB updates)
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Note: For simple testing, you can disable Row Level Security (RLS) 
-- but for production, RLS should be enabled to isolate restaurant data.
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Simple Policy (For Development): Anyone can read/write data
-- In production, you'd restrict this based on auth.uid()
CREATE POLICY "Public permissive" ON public.restaurants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public permissive" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public permissive" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 4. Enable Realtime for these tables
-- Run these in your Supabase SQL Editor if they fail to apply automatically
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;

-- 6. Service Alerts Table
CREATE TABLE IF NOT EXISTS public.service_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    table_number TEXT,
    type TEXT, -- e.g., 'water', 'server'
    message TEXT,
    resolved BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.service_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public permissive" ON public.service_alerts FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_alerts;

-- 5. Migrations (Apply if table already exists)
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS total_tables INTEGER DEFAULT 10 NOT NULL;
