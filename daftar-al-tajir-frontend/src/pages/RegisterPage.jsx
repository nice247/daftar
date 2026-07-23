import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Phone, Store, Lock, CheckCircle2, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { authAPI } from '../services/api';
import { normalizePhone } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const STEPS = {
  PHONE: 0,
  VERIFY: 1,
  REGISTER: 2
};

function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [step, setStep] = useState(STEPS.PHONE);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1: Request phone verification
  const handleVerifyPhone = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const localPhone = normalizePhone(phone);
      await authAPI.verifyPhone(localPhone);
      setPhone(localPhone);
      toast.success('تم إرسال رمز التحقق عبر الواتساب');
      setStep(STEPS.VERIFY);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm code
  const handleConfirmCode = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.confirmPhone(phone, code);
      toast.success('تم التحقق بنجاح');
      setStep(STEPS.REGISTER);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'الرمز غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete registration
  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);

    try {
      const response = await authAPI.register({
        phone,
        store_name: storeName,
        email: email || null,
        password,
        verification_code: code,
      });

      const userData = response.data;
      localStorage.setItem('access_token', userData.access_token);
      localStorage.setItem('user', JSON.stringify(userData.user));

      // Update auth context state to trigger re-render of protected routes cleanly
      setUser(userData.user);

      toast.success('تم إنشاء الحساب بنجاح! الشهر الأول مجاني');
      navigate('/eod');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'حدث خطأ في التسجيل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2B8A3E] to-[#1a6b2d] flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center animate-fade-in">
        <div className="bg-white p-4 rounded-full inline-block mb-4 shadow-lg">
          <Store className="w-12 h-12 text-[#2B8A3E]" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">تسجيل متجر جديد</h1>
        <p className="text-white/80">ابدأ في إدارة مبيعاتك وحساباتك</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-[12px] card-shadow-lg overflow-hidden animate-fade-in">
        {/* Progress Bar */}
        <div className="bg-[#F8F9FA] px-8 py-4 border-b border-[#DEE2E6]">
          <div className="flex items-center justify-between">
            {[
              { label: 'الهاتف', step: STEPS.PHONE },
              { label: 'التحقق', step: STEPS.VERIFY },
              { label: 'البيانات', step: STEPS.REGISTER }
            ].map((s, index) => (
              <div key={s.step} className="flex items-center">
                <div className={`flex flex-col items-center ${step >= s.step ? 'text-[#2B8A3E]' : 'text-[#6C757D]'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 font-bold text-sm
                    ${step > s.step ? 'bg-[#2B8A3E] text-white' : 
                      step === s.step ? 'bg-white border-2 border-[#2B8A3E] text-[#2B8A3E]' : 'bg-[#DEE2E6] text-[#6C757D]'}
                  `}>
                    {step > s.step ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                  </div>
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                {index < 2 && (
                  <div className={`w-12 h-1 mx-2 rounded ${step > s.step ? 'bg-[#2B8A3E]' : 'bg-[#DEE2E6]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8">
          {step === STEPS.PHONE && (
            <form onSubmit={handleVerifyPhone} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  رقم الهاتف (واتساب)
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
                <p className="mt-2 text-sm text-[#6C757D] text-right">
                  سنقوم بإرسال رمز التحقق إليك عبر الواتساب
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || !phone}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-[12px] text-sm font-bold text-white bg-[#2B8A3E] hover:bg-[#237032] focus:outline-none disabled:opacity-50 transition-colors"
              >
                {loading ? 'جاري الإرسال...' : 'إرسال الرمز'}
              </button>
            </form>
          )}

          {step === STEPS.VERIFY && (
            <form onSubmit={handleConfirmCode} className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-[#6C757D]">
                  تم إرسال رمز مكون من 4 أرقام إلى رقم الواتساب:
                </p>
                <p className="font-bold text-[#212529] mt-1" dir="ltr">{phone}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  رمز التحقق
                </label>
                <input
                  type="text"
                  required
                  maxLength="4"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="block w-full text-center tracking-widest text-2xl py-2.5 border border-[#DEE2E6] rounded-[12px] focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none"
                  placeholder="----"
                  dir="ltr"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(STEPS.PHONE)}
                  className="w-1/3 py-2.5 px-4 border border-[#DEE2E6] rounded-[12px] text-[#212529] bg-[#F8F9FA] hover:bg-[#F1F3F5] focus:outline-none transition-colors"
                >
                  رجوع
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length !== 4}
                  className="w-2/3 flex justify-center py-2.5 px-4 border border-transparent rounded-[12px] text-sm font-bold text-white bg-[#2B8A3E] hover:bg-[#237032] focus:outline-none disabled:opacity-50 transition-colors"
                >
                  {loading ? 'جاري التحقق...' : 'تأكيد الرمز'}
                </button>
              </div>
            </form>
          )}

          {step === STEPS.REGISTER && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  اسم المتجر
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="block w-full px-4 py-2.5 border border-[#DEE2E6] rounded-[12px] focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none"
                  placeholder="مثال: بقالة البركة"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  required
                  minLength="6"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-4 py-2.5 border border-[#DEE2E6] rounded-[12px] focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#212529] mb-2">
                  تأكيد كلمة المرور
                </label>
                <input
                  type="password"
                  required
                  minLength="6"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full px-4 py-2.5 border border-[#DEE2E6] rounded-[12px] focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>

              <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-[12px] p-4 text-center mt-4">
                <p className="text-[#2B8A3E] font-bold mb-1">🎁 عرض الترحيب</p>
                <p className="text-sm text-[#212529]">الشهر الأول مجاني تماماً لتجربة النظام!</p>
                <p className="text-xs text-[#6C757D] mt-2">رسوم الاشتراك بعد الفترة المجانية هي 10,000 ج.س للشهر.</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-[12px] text-lg font-bold text-white bg-[#2B8A3E] hover:bg-[#237032] focus:outline-none disabled:opacity-50 transition-colors"
                >
                  {loading ? 'جاري الإنشاء...' : 'إنشاء حساب المتجر'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="px-8 py-6 bg-[#F8F9FA] border-t border-[#DEE2E6] text-center">
          <p className="text-sm text-[#6C757D]">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="font-bold text-[#2B8A3E] hover:text-[#237032]">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;