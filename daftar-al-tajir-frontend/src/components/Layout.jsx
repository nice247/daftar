import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiDollarSign, FiUsers, FiBarChart2, FiSettings, FiShield } from 'react-icons/fi';

const navItems = [
  { path: '/eod', label: 'إغلاق اليوم', icon: FiHome },
  { path: '/customers', label: 'العملاء', icon: FiUsers },
  { path: '/reports', label: 'التقارير', icon: FiBarChart2 },
  { path: '/settings', label: 'الإعدادات', icon: FiSettings },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">دفتر</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-800">دفتر التاجر</h1>
            <p className="text-xs text-gray-500">{user?.store_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="p-2 text-gray-500 hover:text-primary-600 rounded-lg hover:bg-gray-100"
              title="لوحة التحكم"
            >
              <FiShield size={20} />
            </button>
          )}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
          >
            خروج
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 px-4 py-4 max-w-lg mx-auto w-full">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                isActive(path)
                  ? 'text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
