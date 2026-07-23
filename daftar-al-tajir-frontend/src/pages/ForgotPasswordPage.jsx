import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { normalizePhone } from '../utils/helpers';
import { FiPhone, FiArrowLeft, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-gradient-to-b from-[#2B8A3E] to-[#1a6b2d] flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-[12px] p-6 w-full max-w-sm card-shadow-lg animate-fade-in">
        <h2 className="text-lg font-bold text-[#212529] mb-4">استعادة كلمة المرور</h2>

        {step === 1 && (
          <form onSubmit={handleRequest} className="space-y-4">
            <p className="text-sm text-[#6C757D]">
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
              className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none text-left"
              dir="ltr"
              required
            />
            <p className="text-xs text-[#6C757D] mt-1">10 أرقام تبدأ بصفر</p>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#2B8A3E] text-white rounded-[12px] font-bold hover:bg-[#237032] disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-[#6C757D]">
              أدخل الرمز الذي وصلك عبر الواتساب
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="رمز التحقق"
              className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none text-center text-2xl font-bold tracking-[1em]"
              dir="ltr"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#2B8A3E] text-white rounded-[12px] font-bold hover:bg-[#237032] disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري التحقق...' : 'تأكيد'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-[#6C757D]">أدخل كلمة المرور الجديدة</p>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="كلمة المرور الجديدة"
                className="w-full pl-10 pr-3 py-2.5 border border-[#DEE2E6] rounded-[12px] focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6C757D] hover:text-[#212529]"
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#2B8A3E] text-white rounded-[12px] font-bold hover:bg-[#237032] disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
            </button>
          </form>
        )}

        <button
          onClick={() => navigate('/login')}
          className="mt-4 text-sm text-[#6C757D] hover:text-[#212529] flex items-center gap-1"
        >
          <FiArrowLeft size={14} />
          رجوع لتسجيل الدخول
        </button>
      </div>
    </div>
  );
}
