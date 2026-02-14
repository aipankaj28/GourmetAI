import React from 'react';
import { CartItem, ItemStatus } from '../types';
import Button from './Button';

interface CartDisplayProps {
  cartItems: CartItem[];
  onClearCart: () => void;
  onPlaceOrder: () => void;
  onRemoveItem: (itemId: string) => void;
  lastSyncTime: Date;
  syncStatus: 'connected' | 'connecting' | 'error';
  onRefresh: () => void;
}

const CartDisplay: React.FC<CartDisplayProps> = ({ cartItems, onClearCart, onPlaceOrder, onRemoveItem, lastSyncTime, syncStatus, onRefresh }) => {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Your Live Order</h2>
          <span className="text-xs md:text-sm font-normal text-gray-500 italic">Chef is working on your food live</span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)] ${syncStatus === 'connected' ? 'bg-green-500' :
              syncStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-gray-400 leading-none mb-0.5">
                {syncStatus === 'connected' ? 'Live Sync' : syncStatus === 'error' ? 'Sync Error' : 'Connecting...'}
              </span>
              <span className="text-[11px] text-gray-600 font-medium leading-none whitespace-nowrap">
                Updated: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider flex items-center gap-1 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Now
          </button>
        </div>
      </div>

      {cartItems.length === 0 ? (
        <p className="text-center text-gray-600 text-lg py-8">No items in your current order.</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-200">
            {cartItems.map((item) => (
              <li key={item.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base md:text-lg font-semibold text-gray-800">{item.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${item.status === ItemStatus.PENDING ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      item.status === ItemStatus.PREPARING ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                        item.status === ItemStatus.SERVED ? 'bg-green-50 text-green-700 border-green-200' :
                          'bg-red-50 text-red-700 border-red-200'
                      }`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    ₹{item.price.toFixed(2)} x {item.quantity}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <p className="text-lg font-bold text-gray-900 min-w-[80px] text-right">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </p>
                  {item.status === ItemStatus.PENDING && (
                    <Button
                      variant="danger"
                      size="sm"
                      className="px-2 py-1 text-xs"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center text-xl font-bold text-gray-900">
            <span>Total:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row justify-end gap-4">
            <Button variant="secondary" onClick={onClearCart} className="w-full sm:w-auto">
              Clear All
            </Button>
            <Button variant="primary" onClick={onPlaceOrder} className="w-full sm:w-auto">
              Checkout / View Bill
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default CartDisplay;