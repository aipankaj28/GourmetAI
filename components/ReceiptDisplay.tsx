import React from 'react';
import { Order, OrderStatus, ItemStatus, TaxRate } from '../types';

interface ReceiptDisplayProps {
  order: Order;
  taxRates: TaxRate[];
}

const ReceiptDisplay: React.FC<ReceiptDisplayProps> = ({ order, taxRates }) => {
  const subtotal = order.items_ordered.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto font-mono">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-gray-900 mb-2">GourmetAI Restaurant</h2>
        <p className="text-sm text-gray-600">Your Receipt</p>
        <p className="text-xs text-gray-500 mt-2">Order ID: {order.order_id}</p>
        <p className="text-xs text-gray-500">Table: {order.table_number_or_online}</p>
        <p className="text-xs text-gray-500">{new Date(order.timestamp).toLocaleString()}</p>
      </div>

      <div className="border-b border-gray-300 pb-4 mb-4">
        <div className="flex justify-between font-semibold text-gray-800">
          <span>Item</span>
          <span>Qty</span>
          <span>Price</span>
          <span>Total</span>
        </div>
        <ul className="divide-y divide-gray-200 mt-2">
          {order.items_ordered.map((item) => (
            <li key={item.id} className="flex flex-col py-2">
              <div className="flex justify-between text-sm">
                <span className="w-1/2 font-medium">{item.name}</span>
                <span className="w-1/6 text-center">{item.quantity}</span>
                <span className="w-1/6 text-right">₹{item.price.toFixed(2)}</span>
                <span className="w-1/6 text-right">₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-md text-gray-700 mb-2">
          <span>Subtotal:</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        {taxRates.map((tax) => {
          const taxAmount = subtotal * tax.percentage;
          return (
            <div key={tax.name} className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{tax.name} ({tax.percentage * 100}%):</span>
              <span>₹{taxAmount.toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-400 pt-4 mt-4">
        <div className="flex justify-between text-2xl font-bold text-gray-900">
          <span>Total Amount:</span>
          <span>₹{order.total_amount.toFixed(2)}</span>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500 mt-8">Thank you for dining with us!</p>
    </div>
  );
};

export default ReceiptDisplay;