import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, adminAPI } from '../services/api';
import { formatCurrency, formatDate, getDaysRemaining, phoneToWhatsApp } from '../utils/helpers';
import { FiUser, FiCalendar, FiRefreshCw, FiPackage, FiPhoneCall, FiDollarSign } from 'react-icons/fi';
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
      <h2 className="text-lg font-bold text-gray-800">الإعدادات والدعم</h2>

      {/* Support Section */}
      {user?.support_phone && (
        <div className="bg-white rounded-xl p-4 card-shadow border-2 border-green-200">
          <div className="flex items-center gap-3">
            <FiPhoneCall className="text-green-600" size={24} />
            <div>
              <h3 className="font-bold text-gray-800">الدعم الفني</h3>
              <p className="text-sm text-gray-500">لأي استفسار أو مساعدة، تواصل معنا عبر واتساب</p>
              <a 
                href={`https://wa.me/${phoneToWhatsApp(user.support_phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 font-bold mt-1 inline-block"
              >
                اضغط هنا للتواصل
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Status - Only for Merchants */}
      {user?.role !== 'admin' && (
        <div className={`rounded-xl p-4 ${daysRemaining > 3 ? 'bg-primary-50 border border-primary-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <FiCalendar className={daysRemaining > 3 ? 'text-primary-600' : 'text-red-600'} size={20} />
            <h3 className="font-bold">حالة الاشتراك</h3>
          </div>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-gray-600">تاريخ الانتهاء: </span>
              <span className="font-bold">{formatDate(user?.subscription_end_date)}</span>
            </p>
            <p className="text-sm">
              <span className="text-gray-600">الأيام المتبقية: </span>
              <span className={`font-bold ${daysRemaining > 3 ? 'text-primary-700' : 'text-red-700'}`}>{daysRemaining} يوم</span>
            </p>
          </div>
        </div>
      )}

      {/* Profile Settings */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <FiUser className="text-gray-600" size={20} />
          <h3 className="font-bold text-gray-800">بيانات الحساب</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">رقم الواتساب (حسابك)</label>
            <input
              type="tel"
              value={user?.phone || ''}
              disabled
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500"
              dir="ltr"
            />
          </div>
          {user?.support_phone && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">رقم خدمة العملاء (للتواصل)</label>
              <input
                type="tel"
                value={user.support_phone}
                disabled
                className="w-full px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-bold"
                dir="ltr"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-600 mb-1">{user?.role === 'admin' ? 'اسم الأدمن' : 'اسم المتجر'}</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="اختياري"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Restock Cycle - Only for Merchants */}
      {user?.role !== 'admin' && (
        <div className="bg-white rounded-xl p-4 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <FiPackage className="text-amber-600" size={20} />
            <h3 className="font-bold text-gray-800">دورة الشراء (المدة بين إعادة التخزين)</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">حدد المدة التي عادة تشتري فيها بضاعة جديدة، ستُستخدم لحساب أرباحك في هذه الفترة.</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 7, label: 'أسبوع' },
                  { value: 14, label: 'أسبوعين' },
                  { value: 30, label: 'شهر' },
                  { value: 'custom', label: 'تحديد فترة' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`p-3 border rounded-xl cursor-pointer text-center text-sm ${
                      restockCycle == option.value ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold' : 'border-gray-200 text-gray-700'
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
                   <label className="block text-xs text-gray-600 mb-1">أدخل عدد الأيام</label>
                   <input
                     type="number"
                     min="1"
                     value={customCycle}
                     onChange={(e) => setCustomCycle(e.target.value)}
                     className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm text-left"
                     dir="ltr"
                     placeholder="مثال: 10"
                   />
                 </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-700 mb-1">تعديل تاريخ بداية الدورة الحالية</label>
              <p className="text-[10px] text-gray-500 mb-2">
                إذا كنت في منتصف الدورة بالفعل، يمكنك إدخال تاريخ بدايتها الفعلي لضبط حساباتك. (اتركه فارغاً لبقاء الدورة كما هي).
              </p>
              <input
                type="date"
                value={cycleStartDate}
                onChange={(e) => setCycleStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Admin Settings Section */}
      {user?.role === 'admin' && adminSettings && (
        <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
          <div className="flex items-center gap-3 text-primary-600 font-bold mb-4">
            <FiDollarSign />
            <h3>إعدادات الأسعار (خاص بالمدير)</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">سعر الاشتراك (تجديد 30 يوم)</label>
              <input
                type="number"
                value={adminSettings.monthly_price}
                onChange={(e) => setAdminSettings({...adminSettings, monthly_price: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm font-mono"
              />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
      </button>
    </div>
  );
}