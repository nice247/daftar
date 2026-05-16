import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { normalizePhone } from '../utils/helpers';
import { FiPhone, FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1); // 1=request, 2=verify, 3=reset
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const localPhone = normalizePhone(phone);
      await authAPI.forgotPassword(localPhone);
      setPhone(localPhone);
      toast.success('سيتم إرسال رمز التحقق عبر الواتساب');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.verifyOTP(phone, code);
      toast.success('تم التحقق بنجاح');
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'رمز غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.resetPassword(phone, code, newPassword);
      toast.success('تم تغيير كلمة المرور بنجاح');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent-500 to-accent-700 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow-lg animate-fade-in">
        <h2 className="text-lg font-bold text-gray-800 mb-4">استعادة كلمة المرور</h2>

        {step === 1 && (
          <form onSubmit={handleRequest} className="space-y-4">
            <p className="text-sm text-gray-500">
              أدخل رقم الواتساب المسجل. سيتم إرسال رمز تحقق عبر الواتساب.
            </p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d]/g, '');
                if (val.length <= 10) setPhone(val);
              }}
              placeholder="0XXXXXXXXX"
              className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none text-left"
              dir="ltr"
              required
            />
            <p className="text-xs text-gray-400 mt-1">10 أرقام تبدأ بصفر</p>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent-600 text-white rounded-xl font-bold hover:bg-accent-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-gray-500">
              أدخل الرمز الذي وصلك عبر الواتساب
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="رمز التحقق"
              className="w-full px-3 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 outline-none text-center text-2xl font-bold tracking-[1em]"
              dir="ltr"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent-600 text-white rounded-xl font-bold hover:bg-accent-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري التحقق...' : 'تأكيد'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-gray-500">أدخل كلمة المرور الجديدة</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="كلمة المرور الجديدة"
              className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 outline-none"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent-600 text-white rounded-xl font-bold hover:bg-accent-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
            </button>
          </form>
        )}

        <button
          onClick={() => navigate('/login')}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <FiArrowLeft size={14} />
          رجوع لتسجيل الدخول
        </button>
      </div>
    </div>
  );
}
