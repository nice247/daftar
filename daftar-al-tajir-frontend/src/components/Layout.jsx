import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiUsers, FiBarChart2, FiSettings, FiShield, FiCreditCard } from 'react-icons/fi';

const merchantNavItems = [
  { path: '/eod', label: 'المعاملات', icon: FiHome },
  { path: '/customers', label: 'العملاء', icon: FiUsers },
  { path: '/reports', label: 'التقارير', icon: FiBarChart2 },
  { path: '/subscription', label: 'الاشتراك', icon: FiCreditCard },
  { path: '/settings', label: 'الإعدادات', icon: FiSettings },
];

const adminNavItems = [
  { path: '/admin', label: 'لوحة التحكم', icon: FiShield },
  { path: '/settings', label: 'الإعدادات', icon: FiSettings },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);
  
  // Choose navigation based on role
  const navItems = isAdmin ? adminNavItems : merchantNavItems;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#DEE2E6] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#2B8A3E] rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">دفتر</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#212529]">دفتر التاجر</h1>
            <p className="text-xs text-[#6C757D]">{user?.store_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DEE2E6] pb-safe z-50">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                isActive(path)
                  ? 'text-[#2B8A3E]'
                  : 'text-[#6C757D] hover:text-[#212529]'
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