-- Seed Data for an Indian Restaurant: "The Royal Spice"

-- 1. Insert the Restaurant
-- Using a fixed UUID for seeding makes it easier to reference, but for general use let's use a variable approach
DO $$ 
DECLARE 
    rest_id UUID;
BEGIN
    -- Insert Restaurant
    INSERT INTO public.restaurants (name, slug)
    VALUES ('The Royal Spice', 'the-royal-spice')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO rest_id;

    -- 2. Insert Menu Items
    INSERT INTO public.menu_items (restaurant_id, name, description, price, category, type, availability, image_url)
    VALUES 
    -- Starters
    (rest_id, 'Hara Bhara Kabab', 'Spinach and green pea patties with traditional Indian spices.', 220.00, 'Starter', 'Veg', true, '/assets/menu/hara-bhara-kabab.png'),
    (rest_id, 'Chicken 65', 'Spicy deep-fried chicken tempered with curry leaves and mustard seeds.', 350.00, 'Starter', 'Non-Veg', true, '/assets/menu/chicken-65.png'),
    (rest_id, 'Gobi Manchurian', 'Crispy cauliflower florets tossed in a spicy Indo-Chinese sauce.', 180.00, 'Starter', 'Veg', true, '/assets/menu/gobi-manchurian.png'),
    (rest_id, 'Fish Amritsari', 'Batter fried fish flavored with carom seeds and spices.', 420.00, 'Starter', 'Non-Veg', true, '/assets/menu/fish-amritsari.png'),

    -- Main Course (Veg)
    (rest_id, 'Dal Tadka', 'Yellow lentils tempered with cumin, garlic, and red chilies.', 250.00, 'Main Course', 'Veg', true, '/assets/menu/dal-tadka.png'),
    (rest_id, 'Malai Kofta', 'Cottage cheese dumplings in a rich, creamy cashew-based gravy.', 380.00, 'Main Course', 'Veg', true, '/assets/menu/malai-kofta.png'),
    (rest_id, 'Baingan Bharta', 'Smoky roasted eggplant mashed and cooked with tomatoes and peas.', 320.00, 'Main Course', 'Veg', true, '/assets/menu/baingan-bharta.png'),

    -- Main Course (Non-Veg)
    (rest_id, 'Mutton Rogan Josh', 'Slow-cooked lamb in a traditional Kashmiri red chili and yogurt gravy.', 550.00, 'Main Course', 'Non-Veg', true, '/assets/menu/mutton-rogan-josh.png'),
    (rest_id, 'Goan Fish Curry', 'Tangy and spicy fish curry with coconut milk and tamarind.', 480.00, 'Main Course', 'Non-Veg', true, '/assets/menu/goan-fish-curry.png'),
    (rest_id, 'Chicken Kadhai', 'Chicken cooked with bell peppers and freshly ground kadhai masala.', 450.00, 'Main Course', 'Non-Veg', true, '/assets/menu/chicken-kadhai.png'),

    -- Bread & Rice (Side Dish)
    (rest_id, 'Butter Naan', 'Soft tandoori bread brushed with butter.', 60.00, 'Side Dish', 'Veg', true, '/assets/menu/butter-naan.png'),
    (rest_id, 'Jeera Rice', 'Fragrant basmati rice tempered with cumin seeds.', 150.00, 'Side Dish', 'Veg', true, '/assets/menu/jeera-rice.png'),
    (rest_id, 'Hyderabadi Veg Biryani', 'Slow-cooked aromatic rice with seasonal vegetables and saffron.', 350.00, 'Main Course', 'Veg', true, '/assets/menu/hyderabadi-veg-biryani.png'),

    -- Desserts
    (rest_id, 'Rasmalai (2 Pcs)', 'Soft paneer discs soaked in thickened, sweetened saffron milk.', 150.00, 'Dessert', 'Veg', true, '/assets/menu/rasmalai.png'),
    (rest_id, 'Gajar Ka Halwa', 'Traditional warm carrot pudding made with milk and nuts.', 180.00, 'Dessert', 'Veg', true, '/assets/menu/dessert-default.png'),

    -- Drinks
    (rest_id, 'Sweet Lassi', 'Classic thick yogurt drink.', 100.00, 'Drink', 'Veg', true, '/assets/menu/drink-default.png'),
    (rest_id, 'Jaljeera', 'Refreshing cumin-flavored lemonade.', 60.00, 'Drink', 'Veg', true, '/assets/menu/drink-default.png');

    RAISE NOTICE 'Seed completed for restaurant: %', rest_id;
END $$;
