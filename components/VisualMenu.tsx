import React from 'react';
import { MenuItem } from '../types';
import Button from './Button';

interface VisualMenuProps {
  menuItems: MenuItem[];
  onAddToCart: (item: MenuItem, quantity: number) => void;
}

const VisualMenu: React.FC<VisualMenuProps> = ({ menuItems, onAddToCart }) => {
  if (menuItems.length === 0) {
    return (
      <div className="text-center p-8 text-gray-600">
        <p className="text-lg">No menu items found for your selection.</p>
        <p className="text-sm mt-2">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 p-2 md:p-4">
      {menuItems.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col"
        >
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-32 md:h-48 object-contain object-center bg-gray-50"
          />
          <div className="p-3 md:p-4 flex-grow flex flex-col justify-between">
            <div>
              <h3 className="text-sm md:text-xl font-bold text-gray-900 mb-0.5 line-clamp-1">{item.name}</h3>
              <p className="text-[10px] md:text-sm text-gray-600 line-clamp-1 md:line-clamp-2 mb-1 md:mb-2">{item.description}</p>
              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <span>{item.category}</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${item.type === 'Veg' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                >
                  {item.type}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto pt-2 md:pt-3 border-t border-gray-100">
              <span className="text-sm md:text-2xl font-bold text-blue-600">₹{item.price.toFixed(0)}</span>
              <Button
                onClick={() => onAddToCart(item, 1)}
                disabled={!item.availability}
                size="sm"
                className="ml-2 text-[10px] md:text-sm px-2 py-1 md:px-4 md:py-2"
              >
                {item.availability ? 'Add' : 'Off'}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default VisualMenu;