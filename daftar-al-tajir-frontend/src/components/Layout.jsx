import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiUsers, FiBarChart2, FiSettings, FiShield, FiCreditCard } from 'react-icons/fi';

const merchantNavItems = [
  { path: '/eod', label: 'إغلاق اليوم', icon: FiHome },
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

  // Swipe navigation logic
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const currentIndex = navItems.findIndex((item) => isActive(item.path));
      if (currentIndex === -1) return;

      if (isRightSwipe && currentIndex < navItems.length - 1) {
        // Swiped right (drag from left to right) -> Reveal what's on the left
        // In RTL, items with higher indexes are on the left
        navigate(navItems[currentIndex + 1].path);
      } else if (isLeftSwipe && currentIndex > 0) {
        // Swiped left (drag from right to left) -> Reveal what's on the right
        // In RTL, items with lower indexes are on the right
        navigate(navItems[currentIndex - 1].path);
      }
    }
  };

  return (
    <div 
      className="min-h-screen bg-gray-50 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEndHandler}
    >
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