import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Order, OrderStatus, ItemStatus } from '../types';
import Button from './Button';

const KitchenDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { orders, updateOrderStatus, updateItemStatus } = useAppContext();

  useEffect(() => {
    const loggedIn = localStorage.getItem('kitchenLoggedIn');
    if (!loggedIn) {
      navigate('/kitchen-login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('kitchenLoggedIn');
    navigate('/kitchen-login');
  };

  const getStatusColor = (status: OrderStatus | ItemStatus) => {
    switch (status) {
      case ItemStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case ItemStatus.PREPARING:
      case OrderStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case ItemStatus.SERVED:
      case OrderStatus.PAID:
        return 'bg-green-100 text-green-800';
      case ItemStatus.CANCELLED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const sortedOrders = orders
    .filter((order) => {
      // Hide paid or cancelled from active queue
      if (order.status === OrderStatus.PAID) return false;

      const orderDate = new Date(order.timestamp);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      return orderDate >= twoHoursAgo;
    })
    .sort((a, b) => {
      // Oldest first
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center sm:text-left">Kitchen Dashboard</h1>
        <Button onClick={handleLogout} variant="danger">
          Logout
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 flex-grow">
        <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">Order Queue</h2>
        {sortedOrders.length === 0 ? (
          <p className="text-center text-gray-600 text-lg py-8">No orders in the queue.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedOrders.map((order) => (
              <div key={order.order_id} className="bg-gray-50 rounded-lg shadow-md p-5 border border-gray-200 flex flex-col">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200 gap-2">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">Table: {order.table_number_or_online}</h3>
                  <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <ul className="mb-4 flex-grow space-y-2">
                  {order.items_ordered.map((item) => (
                    <li key={item.id} className="flex flex-col border-b border-gray-100 pb-2 last:border-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-gray-800">{item.name} <span className="text-gray-500 font-normal">x{item.quantity}</span></span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {item.status === ItemStatus.PENDING && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-[10px] px-2 py-1"
                            onClick={() => updateItemStatus(order.order_id, item.id, ItemStatus.PREPARING)}
                          >
                            Prepare
                          </Button>
                        )}
                        {item.status === ItemStatus.PREPARING && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-[10px] px-2 py-1"
                            onClick={() => updateItemStatus(order.order_id, item.id, ItemStatus.SERVED)}
                          >
                            Mark Served
                          </Button>
                        )}
                        {(item.status === ItemStatus.PENDING || item.status === ItemStatus.PREPARING) && (
                          <Button
                            variant="danger"
                            size="sm"
                            className="text-[10px] px-2 py-1"
                            onClick={() => updateItemStatus(order.order_id, item.id, ItemStatus.CANCELLED)}
                          >
                            Cancel
                          </Button>
                        )}
                        {item.status === ItemStatus.SERVED && (
                          <span className="text-[10px] text-green-600 font-medium">✓ Served</span>
                        )}
                        {item.status === ItemStatus.CANCELLED && (
                          <span className="text-[10px] text-red-600 font-medium">✕ Cancelled</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
                  {order.status === OrderStatus.IN_PROGRESS ? (
                    <span className="text-sm text-blue-600 font-medium">Order In Progress</span>
                  ) : (
                    <span className="text-sm text-green-600 font-medium italic">Order Paid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenDashboard;