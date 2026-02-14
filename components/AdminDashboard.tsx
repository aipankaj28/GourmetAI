import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { MenuItem, Category, MealType, TaxRate } from '../types';
import Button from './Button';
import Input from './Input';
import Modal from './Modal';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    menuItems,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    taxRates,
    updateTaxRate,
    addTaxRate,
    deleteTaxRate,
    serviceAlerts,
    resolveServiceAlert,
    totalTables,
    updateTotalTables,
  } = useAppContext();

  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [currentMenuItem, setCurrentMenuItem] = useState<MenuItem | null>(null);
  const [newMenuItem, setNewMenuItem] = useState<Omit<MenuItem, 'id'>>({
    name: '',
    description: '',
    category: Category.STARTER,
    type: MealType.VEG,
    price: 0,
    availability: true,
    imageUrl: 'https://picsum.photos/400/300',
  });
  const [currentTaxRate, setCurrentTaxRate] = useState<TaxRate | null>(null);
  const [newTaxRate, setNewTaxRate] = useState<TaxRate>({ name: '', percentage: 0 });
  const [editingTotalTables, setEditingTotalTables] = useState<number>(totalTables);

  useEffect(() => {
    setEditingTotalTables(totalTables);
  }, [totalTables]);

  useEffect(() => {
    const loggedIn = localStorage.getItem('adminLoggedIn');
    if (!loggedIn) {
      navigate('/admin-login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminLoggedIn');
    navigate('/admin-login');
  };

  const openAddMenuModal = () => {
    setCurrentMenuItem(null);
    setNewMenuItem({
      name: '',
      description: '',
      category: Category.STARTER,
      type: MealType.VEG,
      price: 0,
      availability: true,
      imageUrl: 'https://picsum.photos/400/300',
    });
    setIsMenuModalOpen(true);
  };

  const openEditMenuModal = (item: MenuItem) => {
    setCurrentMenuItem(item);
    setNewMenuItem({ ...item }); // Pre-fill form with existing item data
    setIsMenuModalOpen(true);
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentMenuItem) {
      await updateMenuItem({ ...newMenuItem, id: currentMenuItem.id } as MenuItem);
    } else {
      await addMenuItem(newMenuItem);
    }
    setIsMenuModalOpen(false);
  };

  const openAddTaxModal = () => {
    setCurrentTaxRate(null);
    setNewTaxRate({ name: '', percentage: 0 });
    setIsTaxModalOpen(true);
  };

  const openEditTaxModal = (tax: TaxRate) => {
    setCurrentTaxRate(tax);
    setNewTaxRate({ ...tax });
    setIsTaxModalOpen(true);
  };

  const handleSaveTaxRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentTaxRate) {
      updateTaxRate(newTaxRate);
    } else {
      addTaxRate(newTaxRate);
    }
    setIsTaxModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Admin Dashboard</h1>
        <Button onClick={handleLogout} variant="danger">
          Logout
        </Button>
      </div>

      {/* Restaurant Settings */}
      <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 mb-8">
        <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">Restaurant Settings</h2>
        <div className="max-w-xs space-y-4">
          <Input
            label="Total Number of Tables"
            type="number"
            min="1"
            max="100"
            value={editingTotalTables}
            onChange={(e) => setEditingTotalTables(parseInt(e.target.value) || 1)}
          />
          <Button onClick={() => updateTotalTables(editingTotalTables)}>
            Update Table Count
          </Button>
        </div>
      </div>

      {/* Menu Management */}
      <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 gap-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-800">Menu Items</h2>
          <Button onClick={openAddMenuModal}>Add New Item</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {menuItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{item.price.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.availability ? <span className="text-green-600">Yes</span> : <span className="text-red-600">No</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button variant="secondary" size="sm" onClick={() => openEditMenuModal(item)} className="mr-2">Edit</Button>
                    <Button variant="danger" size="sm" onClick={async () => await deleteMenuItem(item.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Engine */}
      <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 gap-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-800">Tax Rates</h2>
          <Button onClick={openAddTaxModal}>Add New Tax</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {taxRates.map((tax, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tax.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(tax.percentage * 100).toFixed(2)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button variant="secondary" size="sm" onClick={() => openEditTaxModal(tax)} className="mr-2">Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => deleteTaxRate(tax.name)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service Alerts */}
      <div className="bg-white rounded-lg shadow-xl p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">Service Alerts</h2>
        {serviceAlerts.length === 0 ? (
          <p className="text-center text-gray-600">No active service alerts.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {serviceAlerts.filter(alert => !alert.resolved).map(alert => (
              <li key={alert.id} className="py-4 flex justify-between items-center">
                <div>
                  <p className="text-lg font-semibold text-gray-800">Table {alert.table}: {alert.message || `Request for ${alert.type}`}</p>
                  <p className="text-sm text-gray-500">{new Date(alert.timestamp).toLocaleString()}</p>
                </div>
                <Button variant="primary" size="sm" onClick={async () => await resolveServiceAlert(alert.id)}>Resolve</Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Menu Item Modal */}
      <Modal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
        title={currentMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}
        footer={
          <Button type="submit" onClick={handleSaveMenuItem}>
            Save
          </Button>
        }
      >
        <form className="space-y-4">
          <Input
            label="Name"
            value={newMenuItem.name}
            onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
            required
          />
          <Input
            label="Description"
            value={newMenuItem.description}
            onChange={(e) => setNewMenuItem({ ...newMenuItem, description: e.target.value })}
            required
          />
          <label className="block text-sm font-medium text-gray-700">Category</label>
          <select
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            value={newMenuItem.category}
            onChange={(e) => setNewMenuItem({ ...newMenuItem, category: e.target.value as Category })}
          >
            {Object.values(Category).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <label className="block text-sm font-medium text-gray-700">Type</label>
          <select
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            value={newMenuItem.type}
            onChange={(e) => setNewMenuItem({ ...newMenuItem, type: e.target.value as MealType })}
          >
            {Object.values(MealType).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <Input
            label="Price"
            type="number"
            value={newMenuItem.price}
            onChange={(e) => setNewMenuItem({ ...newMenuItem, price: parseFloat(e.target.value) || 0 })}
            step="0.01"
            required
          />
          <Input
            label="Image URL"
            value={newMenuItem.imageUrl}
            onChange={(e) => setNewMenuItem({ ...newMenuItem, imageUrl: e.target.value })}
            required
          />
          <div className="flex items-center">
            <input
              id="availability"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={newMenuItem.availability}
              onChange={(e) => setNewMenuItem({ ...newMenuItem, availability: e.target.checked })}
            />
            <label htmlFor="availability" className="ml-2 block text-sm text-gray-900">
              Available
            </label>
          </div>
        </form>
      </Modal>

      {/* Tax Rate Modal */}
      <Modal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        title={currentTaxRate ? 'Edit Tax Rate' : 'Add New Tax Rate'}
        footer={
          <Button type="submit" onClick={handleSaveTaxRate}>
            Save
          </Button>
        }
      >
        <form className="space-y-4">
          <Input
            label="Tax Name"
            value={newTaxRate.name}
            onChange={(e) => setNewTaxRate({ ...newTaxRate, name: e.target.value })}
            required
          />
          <Input
            label="Percentage (e.g., 0.08 for 8%)"
            type="number"
            value={newTaxRate.percentage}
            onChange={(e) => setNewTaxRate({ ...newTaxRate, percentage: parseFloat(e.target.value) || 0 })}
            step="0.01"
            required
          />
        </form>
      </Modal>
    </div>
  );
};

export default AdminDashboard;