import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { normalizePhone, PLAN_NAMES, PLAN_PRICES } from '../utils/helpers';
import { FiPhone, FiShoppingBag, FiLock, FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';

const STEPS = {
  PHONE: 0,
  VERIFY: 1,
  REGISTER: 2,
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS.PHONE);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [plan, setPlan] = useState('monthly');
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

  // Step 2: Confirm phone verification
  const handleConfirmPhone = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.confirmPhone(phone, code);
      toast.success('تم التحقق من الرقم بنجاح');
      setStep(STEPS.REGISTER);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'رمز التحقق غير صحيح');
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
        plan,
        verification_code: code,
      });

      const userData = response.data;
      localStorage.setItem('access_token', userData.access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      toast.success('تم إنشاء الحساب بنجاح! الشهر الأول مجاني');
      navigate('/eod');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'حدث خطأ في التسجيل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-600 to-primary-800 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-primary-700 text-xl font-bold">دفتر</span>
        </div>
        <h1 className="text-xl font-bold text-white">إنشاء حساب جديد</h1>
      </div>

      <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow-lg animate-fade-in">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[STEPS.PHONE, STEPS.VERIFY, STEPS.REGISTER].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                s < step
                  ? 'bg-primary-600 text-white'
                  : s === step
                  ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s < step ? <FiCheck size={14} /> : s + 1}
            </div>
          ))}
        </div>

        {/* Step 1: Phone */}
        {step === STEPS.PHONE && (
          <form onSubmit={handleVerifyPhone} className="space-y-4 animate-fade-in">
            <div className="text-center mb-4">
              <h3 className="font-bold text-gray-800">الخطوة 1: تأكيد رقم الواتساب</h3>
              <p className="text-xs text-gray-500 mt-1">
                سيتم إرسال رمز تحقق إلى واتسابك عبر المدير
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                رقم الواتساب (السودان)
              </label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiPhone size={18} />
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d]/g, '');
                    if (val.length <= 10) setPhone(val);
                  }}
                  placeholder="0XXXXXXXXX"
                  className="w-full pr-10 pl-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-left"
                  dir="ltr"
                  required
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">10 أرقام تبدأ بصفر (مثال: 0902642768)</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
            </button>
          </form>
        )}

        {/* Step 2: Verify Code */}
        {step === STEPS.VERIFY && (
          <form onSubmit={handleConfirmPhone} className="space-y-4 animate-fade-in">
            <div className="text-center mb-4">
              <h3 className="font-bold text-gray-800">الخطوة 2: أدخل رمز التحقق</h3>
              <p className="text-xs text-gray-500 mt-1">
                تم إرسال رمز 4 أرقام إلى واتسابك
              </p>
              <p className="text-sm font-medium text-primary-600 mt-2" dir="ltr">{phone}</p>
            </div>

            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="أدخل الرمز هنا"
                className="w-full px-3 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-center text-2xl font-bold tracking-[1em]"
                dir="ltr"
                maxLength={4}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 4}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري التحقق...' : 'تأكيد الرمز'}
            </button>

            <button
              type="button"
              onClick={() => setStep(STEPS.PHONE)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← رجوع
            </button>
          </form>
        )}

        {/* Step 3: Complete Registration */}
        {step === STEPS.REGISTER && (
          <form onSubmit={handleRegister} className="space-y-3 animate-fade-in">
            <div className="text-center mb-3">
              <h3 className="font-bold text-gray-800">الخطوة 3: بيانات الحساب</h3>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">اسم المتجر</label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiShoppingBag size={16} />
                </span>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="اسم متجرك"
                  className="w-full pr-10 pl-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">كلمة المرور</label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiLock size={16} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 خانات على الأقل (حروف وأرقام)"
                  className="w-full pr-10 pl-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">تأكيد كلمة المرور</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            {/* Plan Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">الباقة</label>
              <div className="space-y-2">
                {Object.entries(PLAN_NAMES).map(([key, name]) => (
                  <label
                    key={key}
                    className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${
                      plan === key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="plan"
                        value={key}
                        checked={plan === key}
                        onChange={(e) => setPlan(e.target.value)}
                        className="text-primary-600"
                      />
                      <span className="text-sm font-medium">{name}</span>
                    </div>
                    <span className="text-sm text-gray-600">{PLAN_PRICES[key]} ج.س</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-primary-600 mt-2">الشهر الأول مجاني!</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
            </button>

            <button
              type="button"
              onClick={() => setStep(STEPS.VERIFY)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← رجوع
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            لديك حساب؟ سجل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}
