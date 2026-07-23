import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, adminAPI } from '../services/api';
import { formatCurrency, formatDate, getDaysRemaining, phoneToWhatsApp } from '../utils/helpers';
import { FiUser, FiCalendar, FiRefreshCw, FiPackage, FiPhoneCall, FiDollarSign, FiInfo, FiShare2, FiFacebook } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [storeName, setStoreName] = useState(user?.store_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [restockCycle, setRestockCycle] = useState(user?.restock_cycle_days || 7);
  const [customCycle, setCustomCycle] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [adminSettings, setAdminSettings] = useState(null);

  useEffect(() => {
    if (user?.restock_cycle_days && ![7, 14, 30].includes(user.restock_cycle_days)) {
      setRestockCycle('custom');
      setCustomCycle(user.restock_cycle_days.toString());
    }
    
    if (user?.role === 'admin') {
      adminAPI.getSettings().then(res => setAdminSettings(res.data)).catch(console.error);
    }
  }, [user]);

  const daysRemaining = getDaysRemaining(user?.subscription_end_date);

  const handleSave = async () => {
    setSaving(true);
    let cycleDays = parseInt(restockCycle);
    if (restockCycle === 'custom') {
      cycleDays = parseInt(customCycle);
      if (!cycleDays || cycleDays <= 0) {
        toast.error('الرجاء إدخال عدد أيام صحيح لدورة الشراء');
        setSaving(false);
        return;
      }
    }

    try {
      await userAPI.updateProfile({
        store_name: storeName,
        email: email || null,
        restock_cycle_days: cycleDays,
        ...(cycleStartDate && { cycle_start_date: cycleStartDate }),
      });
      await refreshUser();
      
      if (user?.role === 'admin' && adminSettings) {
        await adminAPI.updateSettings({
          monthly_price: parseFloat(adminSettings.monthly_price),
          quarterly_price: parseFloat(adminSettings.quarterly_price || adminSettings.monthly_price),
          semi_annual_price: parseFloat(adminSettings.semi_annual_price || adminSettings.monthly_price),
        });
      }
      
      toast.success('تم تحديث البيانات بنجاح');
      setCycleStartDate(''); // Reset after successful save
    } catch (error) {
      toast.error('فشل في تحديث البيانات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      <h2 className="text-lg font-bold text-[#212529]">الإعدادات والدعم</h2>


      {/* Subscription Status - Only for Merchants */}
      {user?.role !== 'admin' && (
        <div className={`rounded-[12px] p-4 border ${daysRemaining > 3 ? 'bg-[#F8F9FA] border-[#DEE2E6]' : 'border-red-600/30 bg-[#F8F9FA]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <FiCalendar className={daysRemaining > 3 ? 'text-[#2B8A3E]' : 'text-red-600'} size={20} />
            <h3 className="font-bold text-[#212529]">حالة الاشتراك</h3>
          </div>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-[#6C757D]">تاريخ الانتهاء: </span>
              <span className="font-bold text-[#212529]">{formatDate(user?.subscription_end_date)}</span>
            </p>
            <p className="text-sm">
              <span className="text-[#6C757D]">الأيام المتبقية: </span>
              <span className={`font-bold ${daysRemaining > 3 ? 'text-[#2B8A3E]' : 'text-red-600'}`}>{daysRemaining} يوم</span>
            </p>
          </div>
        </div>
      )}

      {/* Profile Settings */}
      <div className="bg-white rounded-[12px] p-4 border border-[#DEE2E6] card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <FiUser className="text-[#6C757D]" size={20} />
          <h3 className="font-bold text-[#212529]">بيانات الحساب</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#6C757D] mb-1">رقم الواتساب (حسابك)</label>
            <input
              type="tel"
              value={user?.phone || ''}
              disabled
              className="w-full px-3 py-2.5 bg-[#F8F9FA] border border-[#DEE2E6] rounded-[12px] text-sm text-[#6C757D]"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6C757D] mb-1">{user?.role === 'admin' ? 'اسم الأدمن' : 'اسم المتجر'}</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm text-[#212529] bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6C757D] mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="اختياري"
              className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm text-[#212529] bg-white"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Restock Cycle - Only for Merchants */}
      {user?.role !== 'admin' && (
        <div className="bg-white rounded-[12px] p-4 border border-[#DEE2E6] card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <FiPackage className="text-amber-600" size={20} />
            <h3 className="font-bold text-[#212529]">دورة الشراء (المدة بين إعادة التخزين)</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#6C757D] mb-2">حدد المدة التي عادة تشتري فيها بضاعة جديدة، ستُستخدم لحساب أرباحك في هذه الفترة.</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 7, label: 'أسبوع' },
                  { value: 14, label: 'أسبوعين' },
                  { value: 30, label: 'شهر' },
                  { value: 'custom', label: 'تحديد فترة' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`p-3 border rounded-[12px] cursor-pointer text-center text-sm transition-all ${
                      restockCycle == option.value ? 'border-[#2B8A3E] text-[#2B8A3E] font-bold bg-white' : 'border-[#DEE2E6] text-[#6C757D] bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="restockCycle"
                      value={option.value}
                      checked={restockCycle == option.value}
                      onChange={(e) => setRestockCycle(e.target.value)}
                      className="hidden"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {restockCycle === 'custom' && (
                 <div className="mt-3">
                   <label className="block text-xs text-[#6C757D] mb-1">أدخل عدد الأيام</label>
                   <input
                     type="number"
                     min="1"
                     value={customCycle}
                     onChange={(e) => setCustomCycle(e.target.value)}
                     className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm text-left text-[#212529] bg-white"
                     dir="ltr"
                     placeholder="مثال: 10"
                   />
                 </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#DEE2E6]">
              <label className="block text-xs font-bold text-[#212529] mb-1">تعديل تاريخ بداية الدورة الحالية</label>
              <p className="text-[10px] text-[#6C757D] mb-2">
                إذا كنت في منتصف الدورة بالفعل، يمكنك إدخال تاريخ بدايتها الفعلي لضبط حساباتك. (اتركه فارغاً لبقاء الدورة كما هي).
              </p>
              <input
                type="date"
                value={cycleStartDate}
                onChange={(e) => setCycleStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm font-mono text-[#212529] bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Admin Settings Section */}
      {user?.role === 'admin' && adminSettings && (
        <div className="bg-white rounded-[12px] p-4 card-shadow border border-[#DEE2E6]">
          <div className="flex items-center gap-3 text-[#2B8A3E] font-bold mb-4">
            <FiDollarSign />
            <h3 className="text-[#212529]">إعدادات الأسعار (خاص بالمدير)</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#6C757D] mb-1">سعر الاشتراك (تجديد 30 يوم)</label>
              <input
                type="number"
                value={adminSettings.monthly_price}
                onChange={(e) => setAdminSettings({...adminSettings, monthly_price: e.target.value})}
                className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm font-mono text-[#212529] bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* About Section */}
      <div className="bg-white rounded-[12px] p-4 border border-[#DEE2E6] card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <FiInfo className="text-[#2B8A3E]" size={20} />
          <h3 className="font-bold text-[#212529]">حول التطبيق</h3>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <h4 className="font-black text-lg text-[#2B8A3E]">دفتر التاجر</h4>
            <p className="text-xs text-[#6C757D] mt-1 px-4 leading-relaxed">
              نظام إدارة المبيعات والمصروفات والديون للتجار في السودان
            </p>
          </div>
          <div className="border-t border-[#DEE2E6] pt-3 space-y-2 px-2">
             <div className="flex justify-between items-center text-sm">
                <span className="text-[#6C757D]">الإصدار</span>
                <span className="font-bold text-[#212529] font-mono">1.0.0</span>
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-[#6C757D]">المطور</span>
                <span className="font-bold text-[#212529]">بهاء الدين عثمان</span>
             </div>
          </div>
          
          <div className="pt-3 flex flex-col gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'دفتر التاجر',
                    text: 'نظام إدارة المبيعات والمصروفات والديون للتجار في السودان',
                    url: window.location.origin
                  }).catch(console.error);
                } else {
                  navigator.clipboard.writeText(window.location.origin);
                  toast.success('تم نسخ رابط التطبيق!');
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#F8F9FA] hover:bg-[#F1F3F5] text-[#212529] border border-[#DEE2E6] rounded-[12px] text-sm font-bold transition-colors"
            >
              <FiShare2 size={18} className="text-[#6C757D]" />
              <span>نشر ومشاركة التطبيق</span>
            </button>
            
            <a
              href="https://www.facebook.com/profile.php?id=61590357776476"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#F8F9FA] hover:bg-[#F1F3F5] text-[#1877F2] border border-[#DEE2E6] rounded-[12px] text-sm font-bold transition-colors"
            >
              <FiFacebook size={18} />
              <span>صفحتنا على فيسبوك</span>
            </a>
            
            {/* Customer Support Button using env variable or fallback */}
            <a
              href={`https://wa.me/${phoneToWhatsApp(import.meta.env.VITE_SUPPORT_PHONE || '201280920179')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#F8F9FA] hover:bg-[#F1F3F5] text-[#25D366] border border-[#DEE2E6] rounded-[12px] text-sm font-bold transition-colors"
            >
              <FiPhoneCall size={18} />
              <span>خدمة العملاء والدعم الفني</span>
            </a>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] font-bold text-sm disabled:opacity-50 transition-colors"
      >
        {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
      </button>
    </div>
  );
}