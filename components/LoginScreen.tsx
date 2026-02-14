import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_PASSWORD, ADMIN_USERNAME, KITCHEN_PASSWORD, KITCHEN_USERNAME } from '../constants';
import Input from './Input';
import Button from './Button';

interface LoginScreenProps {
  role: 'admin' | 'kitchen';
}

const LoginScreen: React.FC<LoginScreenProps> = ({ role }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let correctUsername;
    let correctPassword;
    let redirectPath;

    if (role === 'admin') {
      correctUsername = ADMIN_USERNAME;
      correctPassword = ADMIN_PASSWORD;
      redirectPath = '/admin';
    } else {
      correctUsername = KITCHEN_USERNAME;
      correctPassword = KITCHEN_PASSWORD;
      redirectPath = '/kitchen';
    }

    if (username === correctUsername && password === correctPassword) {
      // In a real app, you'd set a token here
      localStorage.setItem(`${role}LoggedIn`, 'true');
      navigate(redirectPath);
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200 p-4">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          {role === 'admin' ? 'Admin Login' : 'Kitchen Login'}
        </h2>
        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            label="Username"
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="focus:ring-blue-500 focus:border-blue-500"
          />
          <Input
            label="Password"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="focus:ring-blue-500 focus:border-blue-500"
          />
          {error && (
            <p className="text-red-600 text-sm text-center font-medium">{error}</p>
          )}
          <Button type="submit" className="w-full py-3 text-lg">
            Login
          </Button>
        </form>
        <div className="mt-6 text-center">
          <a href="/" className="text-blue-600 hover:underline">
            Back to Customer Interface
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;