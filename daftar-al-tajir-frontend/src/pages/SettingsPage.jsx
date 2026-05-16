import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { formatCurrency, formatDate, getDaysRemaining, PLAN_NAMES } from '../utils/helpers';
import { FiUser, FiCalendar, FiRefreshCw, FiPackage } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [storeName, setStoreName] = useState(user?.store_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [restockCycle, setRestockCycle] = useState(user?.restock_cycle_days || 7);
  const [saving, setSaving] = useState(false);

  const daysRemaining = getDaysRemaining(user?.subscription_end_date);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userAPI.updateProfile({
        store_name: storeName,
        email: email || null,
        restock_cycle_days: parseInt(restockCycle),
      });
      await refreshUser();
      toast.success('تم تحديث البيانات بنجاح');
    } catch (error) {
      toast.error('فشل في تحديث البيانات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold text-gray-800">الإعدادات</h2>

      {/* Subscription Status */}
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

      {/* Profile Settings */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <FiUser className="text-gray-600" size={20} />
          <h3 className="font-bold text-gray-800">بيانات الحساب</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">رقم الواتساب</label>
            <input
              type="tel"
              value={user?.phone || ''}
              disabled
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">اسم المتجر</label>
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

      {/* Restock Cycle */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <FiPackage className="text-amber-600" size={20} />
          <h3 className="font-bold text-gray-800">دورة التجديد</h3>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-gray-500">المدة بين عمليات تجديد المخزون</p>
          <div className="flex gap-2">
            {[7, 14, 30].map((days) => (
              <label
                key={days}
                className={`flex-1 p-3 border rounded-xl cursor-pointer text-center text-sm ${
                  parseInt(restockCycle) === days ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="restockCycle"
                  value={days}
                  checked={parseInt(restockCycle) === days}
                  onChange={(e) => setRestockCycle(e.target.value)}
                  className="hidden"
                />
                {days === 7 ? 'أسبوع' : days === 14 ? 'أسبوعين' : 'شهر'}
              </label>
            ))}
          </div>
        </div>
      </div>

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
