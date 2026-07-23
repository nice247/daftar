import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { normalizePhone } from '../utils/helpers';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const localPhone = normalizePhone(phone);
      const userData = await login(localPhone, password);

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
    <div className="min-h-screen bg-gradient-to-b from-[#2B8A3E] to-[#1a6b2d] flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center animate-fade-in">
        <div className="bg-white p-4 rounded-full inline-block mb-4 shadow-lg">
          <BookOpen className="w-12 h-12 text-[#2B8A3E]" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">دفتر التاجر</h1>
        <p className="text-white/80">إدارة مبيعاتك وحساباتك بسهولة</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-[12px] card-shadow-lg overflow-hidden animate-fade-in">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-[#212529] mb-6 text-center">تسجيل الدخول</h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#212529] mb-2">
                رقم الهاتف
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-[#6C757D]" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2.5 border border-[#DEE2E6] rounded-[12px] focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none"
                  placeholder="0xxxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#212529] mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[#6C757D]" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-[#DEE2E6] rounded-[12px] focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#6C757D] hover:text-[#212529]"
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
                className="text-sm font-medium text-[#2B8A3E] hover:text-[#237032]"
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-[12px] text-sm font-bold text-white bg-[#2B8A3E] hover:bg-[#237032] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'جاري التحميل...' : 'دخول'}
            </button>
          </form>
        </div>

        <div className="px-8 py-6 bg-[#F8F9FA] border-t border-[#DEE2E6] text-center">
          <p className="text-sm text-[#6C757D]">
            ليس لديك حساب؟{' '}
            <Link to="/register" className="text-base font-black text-[#2B8A3E] underline underline-offset-2 hover:text-[#237032]">
              سجل متجرك الآن
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;