import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import CustomerInterface from './components/CustomerInterface';
import AdminDashboard from './components/AdminDashboard';
import KitchenDashboard from './components/KitchenDashboard';
import LoginScreen from './components/LoginScreen';

const App: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col">
      <AppProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<CustomerInterface />} />
            <Route path="/admin-login" element={<LoginScreen role="admin" />} />
            <Route path="/kitchen-login" element={<LoginScreen role="kitchen" />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/kitchen" element={<KitchenDashboard />} />
          </Routes>
        </HashRouter>
      </AppProvider>
    </div>
  );
};

export default App;