import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { normalizePhone } from '../utils/helpers';
import { FiPhone, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const localPhone = normalizePhone(phone);
      const response = await authAPI.login(localPhone, password);
      const userData = response.data;

      localStorage.setItem('access_token', userData.access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      toast.success('تم تسجيل الدخول بنجاح');

      if (userData.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/eod');
      }
    } catch (error) {
      const detail = error.response?.data?.detail || 'بيانات الدخول غير صحيحة';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-600 to-primary-800 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-primary-700 text-2xl font-bold">دفتر</span>
        </div>
        <h1 className="text-2xl font-bold text-white">دفتر التاجر</h1>
        <p className="text-primary-200 text-sm mt-1">إدارة مبيعاتك ومصروفاتك وديونك</p>
      </div>

      {/* Login Form */}
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow-lg">
        <h2 className="text-lg font-bold text-gray-800 mb-5">تسجيل الدخول</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              رقم الهاتف
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <FiPhone size={18} />
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  // Only allow digits
                  const val = e.target.value.replace(/[^\d]/g, '');
                  if (val.length <= 10) setPhone(val);
                }}
                placeholder="0XXXXXXXXX"
                className="w-full pr-10 pl-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-left"
                dir="ltr"
                required
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">10 أرقام تبدأ بصفر</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => navigate('/forgot-password')}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            نسيت كلمة المرور؟
          </button>
          <button
            onClick={() => navigate('/register')}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            إنشاء حساب جديد ←
          </button>
        </div>
      </div>
    </div>
  );
}
