import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { authAPI } from '../services/api';
import { normalizePhone } from '../utils/formatters';

function LoginPage() {
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
      localStorage.setItem('user', JSON.stringify(userData.user));

      toast.success('تم تسجيل الدخول بنجاح');

      if (userData.user.role === 'admin') {
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
        <div className="bg-white p-4 rounded-full inline-block mb-4 shadow-lg">
          <BookOpen className="w-12 h-12 text-primary-600" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">دفتر التاجر</h1>
        <p className="text-primary-100">إدارة مبيعاتك وحساباتك بسهولة</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">تسجيل الدخول</h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم الهاتف
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full pl-3 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-primary-500 focus:border-primary-500"
                  placeholder="0xxxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-primary-500 focus:border-primary-500"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link 
                to="/forgot-password" 
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'جاري التحميل...' : 'دخول'}
            </button>
          </form>
        </div>

        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-600">
            ليس لديك حساب؟{' '}
            <Link to="/register" className="font-bold text-primary-600 hover:text-primary-500">
              سجل متجرك الآن
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;