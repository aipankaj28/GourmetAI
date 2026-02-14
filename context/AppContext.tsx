import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { MenuItem, CartItem, Order, OrderStatus, ItemStatus, TaxRate, ServiceAlert, Category, MealType, AlertType } from '../types';
import { INITIAL_MENU_ITEMS, INITIAL_TAX_RATES } from '../constants';
import { supabase } from '../services/supabaseClient';

interface AppContextType {
  restaurantId: string | null;
  setRestaurantId: (id: string | null) => void;
  menuItems: MenuItem[];
  isLoading: boolean;
  lastSyncTime: Date;
  syncStatus: 'connected' | 'connecting' | 'error';
  refreshData: () => Promise<void>;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  taxRates: TaxRate[];
  addTaxRate: (tax: TaxRate) => void;
  updateTaxRate: (tax: TaxRate) => void;
  deleteTaxRate: (name: string) => void;
  cart: CartItem[];
  addToCart: (item: MenuItem, quantity: number) => void;
  clearCart: () => void;
  orders: Order[];
  placeOrder: (tableNumberOrOnline: string) => Promise<Order>;
  generateBill: (tableNumber: string) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateItemStatus: (orderId: string, itemId: string, status: OrderStatus) => Promise<void>;
  serviceAlerts: ServiceAlert[];
  sendServiceAlert: (alert: ServiceAlert) => void;
  resolveServiceAlert: (alertId: string) => void;
  filteredMenuItems: MenuItem[];
  setFilteredMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  updateFilteredMenu: (filters: { category?: Category; type?: MealType; name?: string }) => void;
  tableNumber: string;
  setTableNumber: (table: string) => void;
  totalTables: number;
  updateTotalTables: (count: number) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [restaurantId, setRestaurantId] = useState<string | null>(localStorage.getItem('restaurant_id') || null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');

  const [taxRates, setTaxRates] = useState<TaxRate[]>(INITIAL_TAX_RATES);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlert[]>([]);
  const [filteredMenuItems, setFilteredMenuItems] = useState<MenuItem[]>([]);
  const [tableNumber, setTableNumber] = useState<string>('Table 1');
  const tableNumberRef = useRef(tableNumber);
  const [totalTables, setTotalTables] = useState<number>(10);

  // Keep ref in sync with state
  useEffect(() => {
    tableNumberRef.current = tableNumber;
  }, [tableNumber]);

  // Load or Create initial restaurant for demo
  useEffect(() => {
    const initRestaurant = async () => {
      console.log('DB_INIT_LOG: Starting initRestaurant flow. Current restaurantId:', restaurantId);
      try {
        if (restaurantId) {
          // Verify if it still exists and fetch total_tables
          const { data: verify, error: vError } = await supabase
            .from('restaurants')
            .select('id, total_tables')
            .eq('id', restaurantId)
            .maybeSingle();

          if (vError || !verify) {
            console.warn('DEBUG: Stored restaurantId is invalid or deleted. Resetting.');
            setRestaurantId(null);
            localStorage.removeItem('restaurant_id');
          } else {
            setTotalTables(verify.total_tables || 10);
          }
        }

        if (!restaurantId) {
          // Try to find ANY existing restaurant
          const { data: existing } = await supabase.from('restaurants').select('id, total_tables').limit(1).maybeSingle();
          if (existing) {
            console.log('DEBUG: Found existing restaurant:', existing.id);
            setRestaurantId(existing.id);
            setTotalTables(existing.total_tables || 10);
            localStorage.setItem('restaurant_id', existing.id);
          } else {
            console.log('DEBUG: Creating new demo restaurant');
            const { data: created, error } = await supabase
              .from('restaurants')
              .insert([{ name: 'Demo Restaurant', slug: `demo-${Math.random().toString(36).substring(7)}`, total_tables: 10 }])
              .select()
              .single();

            if (created) {
              setRestaurantId(created.id);
              setTotalTables(created.total_tables || 10);
              localStorage.setItem('restaurant_id', created.id);
            } else if (error) {
              console.error('DEBUG: Error creating demo restaurant:', error);
            }
          }
        }
      } catch (err) {
        console.error('DB_INIT_LOG: initRestaurant failed catch:', err);
      }
    };
    initRestaurant();
  }, [restaurantId]);

  const refreshData = useCallback(async () => {
    if (!restaurantId) return;

    // Fetch Menu
    const { data: menuData } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (menuData && menuData.length > 0) {
      const mappedMenu = menuData.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        category: item.category as Category,
        type: item.type as MealType,
        availability: item.availability,
        imageUrl: item.image_url
      }));
      setMenuItems(mappedMenu);
    }

    // Fetch Orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (ordersData) {
      const mappedOrders = ordersData.map(o => ({
        order_id: o.id,
        table_number_or_online: o.table_number,
        items_ordered: o.items as CartItem[],
        status: o.status as OrderStatus,
        total_amount: Number(o.total_amount),
        timestamp: o.created_at
      }));
      setOrders(mappedOrders);
      setLastSyncTime(new Date());
    }

    // Fetch Service Alerts
    const { data: alertsData } = await supabase
      .from('service_alerts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (alertsData) {
      const mappedAlerts = alertsData.map(a => ({
        id: a.id,
        table: a.table_number,
        type: a.type as AlertType,
        message: a.message,
        timestamp: a.created_at,
        resolved: a.resolved
      }));
      setServiceAlerts(mappedAlerts);
    }

    console.log('DB_INIT_LOG: Data refresh completed successfully.');
    setIsLoading(false);
  }, [restaurantId]);

  // Fetch menu items and orders from Supabase
  useEffect(() => {
    if (!restaurantId) return;

    const init = async () => {
      await refreshData();
    };

    init();

    // Setup Realtime subscriptions

    const orderSubscription = supabase
      .channel(`orders-live-${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, (payload) => {
        const payloadNew = payload.new as any;
        const payloadOld = payload.old as any;
        const targetId = payloadNew?.restaurant_id || payloadOld?.restaurant_id;

        if (targetId === restaurantId) {
          refreshData();
        }
      })
      .subscribe((status, error) => {
        console.log(`REALTIME_DEBUG: Status for restaurant ${restaurantId}:`, status);
        if (error) {
          console.error('REALTIME_DEBUG: Subscription error details:', error);
          setSyncStatus('error');
        }

        if (status === 'SUBSCRIBED') {
          console.log('REALTIME_DEBUG: Successfully subscribed to realtime updates');
          setSyncStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('REALTIME_DEBUG: Subscription failed or closed:', status);
          setSyncStatus('error');
        } else {
          setSyncStatus('connecting');
        }
      });

    const menuSubscription = supabase
      .channel('menu-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        refreshData();
      })
      .subscribe();

    const restaurantSubscription = supabase
      .channel('restaurant-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurantId}` }, (payload) => {
        const payloadNew = payload.new as any;
        console.log('DEBUG: Restaurant update detected:', payloadNew);
        if (payloadNew && payloadNew.total_tables !== undefined) {
          setTotalTables(payloadNew.total_tables);
        }
      })
      .subscribe();

    const alertsSubscription = supabase
      .channel('alerts-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_alerts', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        refreshData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderSubscription);
      supabase.removeChannel(menuSubscription);
      supabase.removeChannel(restaurantSubscription);
      supabase.removeChannel(alertsSubscription);
    };
  }, [restaurantId, refreshData]);

  // Background Polling Fallback (Every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshData]);

  // Sync cart with active order for current table
  useEffect(() => {
    // Find any non-cancelled orders for this table
    const tableOrders = orders.filter(o =>
      o.table_number_or_online === tableNumber &&
      o.status === OrderStatus.IN_PROGRESS
    );

    // Pick the most recent one (highest timestamp)
    const activeOrder = tableOrders.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];

    if (activeOrder) {
      setCart(activeOrder.items_ordered);
    } else {
      setCart([]);
    }
  }, [orders, tableNumber]);

  useEffect(() => {
    setFilteredMenuItems(menuItems);
  }, [menuItems]);

  // Menu Item CRUD
  const addMenuItem = useCallback(async (item: Omit<MenuItem, 'id'>) => {
    if (!restaurantId) return;
    const { data, error } = await supabase
      .from('menu_items')
      .insert([{
        restaurant_id: restaurantId,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        type: item.type,
        availability: item.availability,
        image_url: item.imageUrl
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding menu item:', error);
      return;
    }

    if (data) {
      const newItem: MenuItem = {
        id: data.id,
        name: data.name,
        description: data.description,
        price: Number(data.price),
        category: data.category as Category,
        type: data.type as MealType,
        availability: data.availability,
        imageUrl: data.image_url
      };
      setMenuItems((prev) => [...prev, newItem]);
    }
  }, [restaurantId]);

  const updateMenuItem = useCallback(async (updatedItem: MenuItem) => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from('menu_items')
      .update({
        name: updatedItem.name,
        description: updatedItem.description,
        price: updatedItem.price,
        category: updatedItem.category,
        type: updatedItem.type,
        availability: updatedItem.availability,
        image_url: updatedItem.imageUrl
      })
      .eq('id', updatedItem.id);

    if (error) {
      console.error('Error updating menu item:', error);
      return;
    }

    setMenuItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  }, [restaurantId]);

  const deleteMenuItem = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting menu item:', error);
      return;
    }

    setMenuItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Tax Rate CRUD
  const addTaxRate = useCallback((tax: TaxRate) => {
    setTaxRates((prev) => [...prev, tax]);
  }, []);

  const updateTaxRate = useCallback((updatedTax: TaxRate) => {
    setTaxRates((prev) =>
      prev.map((tax) => (tax.name === updatedTax.name ? updatedTax : tax))
    );
  }, []);

  const deleteTaxRate = useCallback((name: string) => {
    setTaxRates((prev) => prev.filter((tax) => tax.name !== name));
  }, []);

  // Cart Management
  const addToCart = useCallback(async (item: MenuItem, quantity: number) => {
    const currentTable = tableNumberRef.current;
    console.log('DEBUG: addToCart called', { itemName: item.name, quantity, restaurantId, tableNumber: currentTable });
    if (!restaurantId) {
      console.warn('DEBUG: Cannot add to cart - restaurantId is missing');
      return;
    }

    // Ensure subtotal and taxes are calculated
    const subtotal = item.price * quantity;
    let totalWithTax = subtotal;
    taxRates.forEach((tax) => {
      totalWithTax += subtotal * tax.percentage;
    });

    // 1. Check for any active order for this table (excluding COMPLETED/CANCELLED)
    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', currentTable)
      .eq('status', OrderStatus.IN_PROGRESS)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('DEBUG: Error fetching existing order:', fetchError);
    }

    if (existingOrder) {
      console.log('DEBUG: Found existing PENDING order:', existingOrder.id);
      // Merge items
      const currentItems = (existingOrder.items as CartItem[]) || [];
      const newItems = [...currentItems];
      const existingItem = newItems.find(ni => ni.id === item.id && ni.status === ItemStatus.PENDING);

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        newItems.push({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity,
          status: ItemStatus.PENDING
        });
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          items: newItems,
          status: OrderStatus.IN_PROGRESS, // Keep in progress
          total_amount: Number(existingOrder.total_amount) + totalWithTax
        })
        .eq('id', existingOrder.id);

      if (updateError) {
        console.error('DEBUG: Error updating order in Supabase:', updateError);
        window.alert(`Database Error: ${updateError.message}`);
      } else {
        console.log('DEBUG: Order updated successfully in Supabase');
      }
    } else {
      // Create new IN_PROGRESS order
      const { error: insertError } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: restaurantId,
          table_number: currentTable,
          status: OrderStatus.IN_PROGRESS,
          total_amount: totalWithTax,
          items: [{
            id: item.id,
            name: item.name,
            price: item.price,
            quantity,
            status: ItemStatus.PENDING
          }]
        }]);

      if (insertError) {
        console.error('DEBUG: Error inserting new order in Supabase:', insertError);
        window.alert(`Database Error: ${insertError.message}`);
      } else {
        console.log('DEBUG: New order inserted successfully in Supabase');
      }
    }

    // Update local cart for immediate UI feedback (it will also be synced via subscription)
    setCart((prev) => {
      const exists = prev.find((ci) => ci.id === item.id);
      if (exists) {
        return prev.map((ci) => ci.id === item.id ? { ...ci, quantity: ci.quantity + quantity } : ci);
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity, status: ItemStatus.PENDING }];
    });
  }, [restaurantId, taxRates]);

  const removeFromCart = useCallback(async (itemId: string) => {
    if (!restaurantId) return;
    const currentTable = tableNumberRef.current;

    // 1. Fetch current pending order
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', currentTable)
      .eq('status', OrderStatus.IN_PROGRESS)
      .maybeSingle();

    if (!order) return;

    const items = order.items as CartItem[];
    const itemToRemove = items.find(i => i.id === itemId);

    if (!itemToRemove || itemToRemove.status !== ItemStatus.PENDING) {
      console.warn('Cannot remove item: not in pending status.');
      return;
    }

    const updatedItems = items.filter(i => i.id !== itemId);

    // Calculate new total
    const itemSubtotal = itemToRemove.price * itemToRemove.quantity;
    let itemTotalWithTax = itemSubtotal;
    taxRates.forEach(tax => { itemTotalWithTax += itemSubtotal * tax.percentage; });

    if (updatedItems.length === 0) {
      // If no items left, cancel the order or delete it? Let's delete it for simplicity in "cart" mode
      await supabase.from('orders').delete().eq('id', order.id);
      setCart([]);
    } else {
      await supabase
        .from('orders')
        .update({
          items: updatedItems,
          total_amount: Number(order.total_amount) - itemTotalWithTax
        })
        .eq('id', order.id);

      setCart(updatedItems);
    }
  }, [restaurantId, taxRates]);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const updateTotalTables = useCallback(async (count: number) => {
    if (!restaurantId) return;

    const { error } = await supabase
      .from('restaurants')
      .update({ total_tables: count })
      .eq('id', restaurantId);

    if (error) {
      console.error('Error updating total tables:', error);
      window.alert(`Database Error: ${error.message}`);
    } else {
      setTotalTables(count);
    }
  }, [restaurantId]);

  // Order Management
  const placeOrder = useCallback(
    async (tableNumberOrOnline: string): Promise<Order> => {
      if (cart.length === 0) throw new Error('Cannot place an empty order.');
      if (!restaurantId) throw new Error('Restaurant ID is missing.');

      let subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      let additionalAmount = subtotal;
      taxRates.forEach((tax) => {
        additionalAmount += subtotal * tax.percentage;
      });

      // Check for any active order for this table (excluding COMPLETED/CANCELLED)
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('table_number', tableNumberOrOnline)
        .eq('status', OrderStatus.IN_PROGRESS)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let finalOrderData;

      if (existingOrder) {
        // Merge items
        const currentItems = existingOrder.items as CartItem[];
        const newItems = [...currentItems];

        cart.forEach(cartItem => {
          const existingItem = newItems.find(ni => ni.id === cartItem.id && ni.status === ItemStatus.PENDING);
          if (existingItem) {
            existingItem.quantity += cartItem.quantity;
          } else {
            newItems.push(cartItem);
          }
        });

        const { data, error } = await supabase
          .from('orders')
          .update({
            items: newItems,
            status: OrderStatus.IN_PROGRESS, // Keep in progress
            total_amount: Number(existingOrder.total_amount) + additionalAmount
          })
          .eq('id', existingOrder.id)
          .select()
          .single();

        if (error) throw error;
        finalOrderData = data;
      } else {
        // Create new order
        const { data, error } = await supabase
          .from('orders')
          .insert([{
            restaurant_id: restaurantId,
            table_number: tableNumberOrOnline,
            status: OrderStatus.IN_PROGRESS,
            total_amount: additionalAmount,
            items: cart
          }])
          .select()
          .single();

        if (error) throw error;
        finalOrderData = data;
      }

      const resultOrder: Order = {
        order_id: finalOrderData.id,
        table_number_or_online: finalOrderData.table_number,
        items_ordered: finalOrderData.items as CartItem[],
        status: finalOrderData.status as OrderStatus,
        total_amount: Number(finalOrderData.total_amount),
        timestamp: finalOrderData.created_at,
      };

      clearCart();
      return resultOrder;
    },
    [cart, taxRates, clearCart, restaurantId]
  );

  const generateBill = useCallback(async (table: string, confirmCancelPending: boolean = false): Promise<Order> => {
    if (!restaurantId) throw new Error('Restaurant ID not found.');

    // 1. Fetch active orders for this table
    const { data: activeOrders, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', table)
      .eq('status', OrderStatus.IN_PROGRESS);

    if (fetchError) throw fetchError;
    if (!activeOrders || activeOrders.length === 0) throw new Error('No active orders found for this table.');

    // 2. Check for "Preparing" items (Always block billing if anything is being prepared)
    const hasPreparing = activeOrders.some(o => {
      const items = (o.items as CartItem[]) || [];
      return items.some(item => item.status === ItemStatus.PREPARING);
    });

    if (hasPreparing) {
      throw new Error('Bill cannot be generated as there are items currently being prepared.');
    }

    // 3. Check for "Pending" items (Require confirmation to cancel)
    const pendingItems: string[] = [];
    activeOrders.forEach(o => {
      (o.items as CartItem[]).forEach(item => {
        if (item.status === ItemStatus.PENDING) {
          pendingItems.push(item.name);
        }
      });
    });

    if (pendingItems.length > 0 && !confirmCancelPending) {
      throw new Error(`PENDING_ITEMS_DETECTED: ${pendingItems.join(', ')}`);
    }

    // 4. Collect and process items
    let billedItems: CartItem[] = [];
    let subtotal = 0;

    for (const order of activeOrders) {
      const items = (order.items as CartItem[]) || [];
      const servedItemsInThisOrder = items.filter(i => i.status === ItemStatus.SERVED);

      const updatedItems = items.map(i => {
        if (i.status === ItemStatus.SERVED) return { ...i, status: ItemStatus.SERVED }; // Keeping it as SERVED but order will be marked PAID
        if (i.status === ItemStatus.PENDING) return { ...i, status: ItemStatus.CANCELLED };
        return i;
      });

      // Aggregate served items for the bill
      billedItems = [...billedItems, ...servedItemsInThisOrder];
      servedItemsInThisOrder.forEach(item => {
        subtotal += item.price * item.quantity;
      });

      // Update the order in database as PAID
      await supabase.from('orders').update({
        items: updatedItems,
        status: OrderStatus.PAID
      }).eq('id', order.id);
    }

    if (billedItems.length === 0) {
      throw new Error('No served items found to generate a bill.');
    }

    // 4. Calculate final total with tax
    let totalWithTax = subtotal;
    taxRates.forEach((tax) => {
      totalWithTax += subtotal * tax.percentage;
    });

    // 5. Local cleanup
    clearCart();

    // 6. Return a "Virtual Bill Order" for the receipt display
    return {
      order_id: `BILL-${Date.now()}`,
      table_number_or_online: table,
      items_ordered: billedItems,
      status: OrderStatus.PAID,
      total_amount: totalWithTax,
      timestamp: new Date().toISOString()
    };
  }, [restaurantId, clearCart, taxRates]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    // Note: status here is OrderStatus (In Progress / Paid)
    // 1. Fetch current items to sync statuses if needed
    // However, for this simplification, we usually update item statuses individually (PREPARING, SERVED)
    // and let order level status be derived or manually set to In Progress/Paid.
    const { data: orderData } = await supabase.from('orders').select('items').eq('id', orderId).single();
    const currentItems = (orderData?.items as CartItem[]) || [];
    const updatedItems = currentItems.map(item => ({ ...item, status }));

    const { error } = await supabase
      .from('orders')
      .update({
        status,
        items: updatedItems
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order status:', error);
      return;
    }

    // Updating local state (subscription will also trigger, but this is immediate)
    setOrders((prev) =>
      prev.map((order) => (order.order_id === orderId ? { ...order, status, items_ordered: updatedItems } : order))
    );
  }, []);

  const updateItemStatus = useCallback(async (orderId: string, itemId: string, status: ItemStatus) => {
    console.log(`DEBUG: Updating item ${itemId} in order ${orderId} to status: ${status}`);
    // 1. Fetch current order
    const { data: order, error: fetchError } = await supabase.from('orders').select('items').eq('id', orderId).single();

    if (fetchError || !order) {
      console.error('Error fetching order for item update:', fetchError);
      return;
    }

    // 2. Update items list
    const items = (order.items as CartItem[]) || [];
    const updatedItems = items.map(item => item.id === itemId ? { ...item, status } : item);

    // 3. Save back
    const { error: updateError } = await supabase.from('orders').update({ items: updatedItems }).eq('id', orderId);

    if (updateError) {
      console.error('Error updating item status in database:', updateError);
      return;
    }

    console.log('DEBUG: Database update successful for item status.');

    // Updating local state (subscription will also trigger, but this is immediate)
    setOrders((prev) =>
      prev.map((o) => (o.order_id === orderId ? { ...o, items_ordered: updatedItems } : o))
    );
  }, []);

  // Service Alerts
  const sendServiceAlert = useCallback(async (alert: ServiceAlert) => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from('service_alerts')
      .insert([{
        restaurant_id: restaurantId,
        table_number: alert.table,
        type: alert.type,
        message: alert.message,
        resolved: false
      }]);

    if (error) {
      console.error('Error sending service alert:', error);
    }
  }, [restaurantId]);

  const resolveServiceAlert = useCallback(async (alertId: string) => {
    const { error } = await supabase
      .from('service_alerts')
      .update({ resolved: true })
      .eq('id', alertId);

    if (error) {
      console.error('Error resolving service alert:', error);
    }
  }, []);

  // Menu Filtering Logic
  const updateFilteredMenu = useCallback(
    (filters: { category?: Category; type?: MealType; name?: string }) => {
      let tempItems = [...menuItems];

      if (filters.category) {
        tempItems = tempItems.filter((item) => item.category === filters.category);
      }
      if (filters.type) {
        tempItems = tempItems.filter((item) => item.type === filters.type);
      }
      if (filters.name) {
        const searchTerm = filters.name.toLowerCase();
        tempItems = tempItems.filter((item) =>
          item.name.toLowerCase().includes(searchTerm) ||
          item.description.toLowerCase().includes(searchTerm)
        );
      }
      setFilteredMenuItems(tempItems);
    },
    [menuItems]
  );


  const value = {
    restaurantId,
    setRestaurantId,
    menuItems,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    taxRates,
    addTaxRate,
    updateTaxRate,
    deleteTaxRate,
    cart,
    addToCart,
    clearCart,
    orders,
    placeOrder,
    generateBill,
    updateOrderStatus,
    updateItemStatus,
    serviceAlerts,
    sendServiceAlert,
    resolveServiceAlert,
    filteredMenuItems,
    setFilteredMenuItems,
    updateFilteredMenu,
    tableNumber,
    lastSyncTime,
    syncStatus,
    refreshData,
    setTableNumber,
    totalTables,
    updateTotalTables,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};