import { useState, useEffect } from 'react';
import { adminAPI, subscriptionAPI } from '../services/api';
import { formatCurrency, formatDate, normalizeArabicNumber } from '../utils/helpers';
import { FiUsers, FiUserCheck, FiUserX, FiClock, FiAlertTriangle, FiRefreshCw, FiShield, FiFileText, FiUserPlus, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [pendingSubscriptions, setPendingSubscriptions] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'subscriptions' | 'settings'

  // Settings State
  const [settings, setSettings] = useState({
    monthly_price: 10000,
    quarterly_price: 30000,
    semi_annual_price: 60000
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('merchant');
  const [newSubDays, setNewSubDays] = useState('30');
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, usersRes, pendingSubsRes, settingsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.listUsers({}),
        subscriptionAPI.getPending(),
        adminAPI.getSettings().catch(() => ({ data: { monthly_price: 10000, quarterly_price: 30000, semi_annual_price: 60000 } })),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setPendingSubscriptions(pendingSubsRes.data);
      if (settingsRes && settingsRes.data) {
        setSettings(settingsRes.data);
      }
    } catch (error) {
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await adminAPI.updateSettings({
        monthly_price: parseFloat(settings.monthly_price),
        quarterly_price: parseFloat(settings.quarterly_price),
        semi_annual_price: parseFloat(settings.semi_annual_price)
      });
      toast.success('تم حفظ إعدادات الأسعار بنجاح');
      loadData();
    } catch (error) {
      toast.error('فشل في حفظ إعدادات الأسعار');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSearch = async () => {
    if (!search) { loadData(); return; }
    try {
      const response = await adminAPI.listUsers({ search });
      setUsers(response.data);
    } catch {}
  };

  const handleToggleUser = async (userId, action) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      await adminAPI.toggleUser({ user_id: userId, action });
      toast.success(action === 'activate' ? 'تم تنشيط الحساب' : 'تم تجميد الحساب');
      loadData();
    } catch (error) {
      toast.error('فشل في تنفيذ الإجراء');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleExtend = async (userId) => {
    const days = prompt('عدد الأيام للتمديد:', '30');
    if (!days) return;
    try {
      await adminAPI.extendSubscription({ user_id: userId, days: parseInt(days) });
      toast.success(`تم التمديد ${days} يوم`);
      loadData();
    } catch {
      toast.error('فشل في التمديد');
    }
  };

  const handleReviewSubscription = async (subId, action) => {
    let reason = null;
    if (action === 'reject') {
      reason = prompt('سبب الرفض (اختياري):');
      // If the user clicks "Cancel" on the prompt, reason is null, so we abort.
      // If they click "OK" without typing anything, reason is "", which is perfectly fine.
      if (reason === null) return;
    }
    
    setActionLoading(prev => ({ ...prev, [subId]: true }));
    try {
      await subscriptionAPI.review({
        subscription_id: subId,
        action: action,
        rejection_reason: reason
      });
      toast.success(action === 'approve' ? 'تم قبول الاشتراك' : 'تم رفض الاشتراك');
      loadData();
    } catch (error) {
      toast.error('فشل في مراجعة الاشتراك');
    } finally {
      setActionLoading(prev => ({ ...prev, [subId]: false }));
    }
  };

  const sendRenewalReminder = (user) => {
    const phone = user.phone.replace(/^0/, '249');
    const message = `مرحباً بك في دفتر التاجر يا ${user.store_name}، نود تذكيرك بأن اشتراكك قارب على الانتهاء. يرجى التجديد لضمان استمرار الخدمة.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      await adminAPI.addUser({
        phone: newPhone,
        store_name: newStoreName,
        password: newPassword,
        role: newRole,
        subscription_days: parseInt(newSubDays) || 30
      });
      toast.success('تم إضافة المستخدم بنجاح');
      setShowAddModal(false);
      setNewPhone('');
      setNewStoreName('');
      setNewPassword('');
      setNewRole('merchant');
      setNewSubDays('30');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في إضافة المستخدم');
    } finally {
      setAddingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-primary-600 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiShield className="text-primary-600" size={24} />
          <h2 className="text-lg font-bold text-gray-800">لوحة تحكم الأدمن</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 bg-primary-600 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-primary-700"
        >
          <FiUserPlus size={16} />
          إضافة مستخدم
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${
            activeTab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          المستخدمين
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors relative ${
            activeTab === 'subscriptions' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          طلبات الاشتراك
          {pendingSubscriptions.length > 0 && (
            <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
              {pendingSubscriptions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${
            activeTab === 'settings' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          إعدادات الأسعار
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-xl p-3 card-shadow text-center">
                <FiUsers className="mx-auto text-blue-500 mb-1" size={20} />
                <p className="text-xl font-bold">{stats.total_users}</p>
                <p className="text-xs text-gray-500">إجمالي التجار</p>
              </div>
              <div className="bg-white rounded-xl p-3 card-shadow text-center">
                <FiUserCheck className="mx-auto text-green-500 mb-1" size={20} />
                <p className="text-xl font-bold">{stats.active_users}</p>
                <p className="text-xs text-gray-500">تاجر نشط</p>
              </div>
              <div className="bg-white rounded-xl p-3 card-shadow text-center">
                <FiUserX className="mx-auto text-red-500 mb-1" size={20} />
                <p className="text-xl font-bold">{stats.frozen_users}</p>
                <p className="text-xs text-gray-500">تاجر مجمد</p>
              </div>
              <div className="bg-white rounded-xl p-3 card-shadow text-center">
                <FiClock className="mx-auto text-amber-500 mb-1" size={20} />
                <p className="text-xl font-bold">{stats.pending_verification}</p>
                <p className="text-xs text-gray-500">معلق</p>
              </div>
            </div>
          )}

          {/* Expiring Soon Alert */}
          {stats?.expiring_soon > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <FiAlertTriangle className="text-amber-600" size={18} />
                <span className="text-sm font-bold text-amber-800">{stats.expiring_soon} اشتراكات تقترب من الانتهاء</span>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-2">
            <input
              type="tel"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الهاتف أو الاسم"
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              dir="ltr"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium"
            >
              بحث
            </button>
          </div>

          {/* Users List */}
          <div className="space-y-2">
            {users.map((u) => {
              const isExpiring = u.role === 'merchant' && u.subscription_end_date && new Date(u.subscription_end_date) < new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
              return (
                <div key={u.id} className={`bg-white rounded-xl p-4 card-shadow ${isExpiring ? 'border-2 border-amber-300' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-gray-800">
                        {u.store_name}
                        {u.role === 'admin' && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">أدمن</span>}
                      </h4>
                      <p className="text-xs text-gray-500" dir="ltr">{u.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      u.status === 'FROZEN' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {u.status === 'ACTIVE' ? 'نشط' : u.status === 'FROZEN' ? 'مجمد' : 'معلق'}
                    </span>
                  </div>
                  {u.role === 'merchant' && u.subscription_end_date && (
                    <p className={`text-xs mb-3 ${isExpiring ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
                      انتهاء الاشتراك: {formatDate(u.subscription_end_date)}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {u.role === 'merchant' && (
                      <button
                        onClick={() => handleExtend(u.id)}
                        className="flex-1 min-w-[70px] py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
                      >
                        تمديد
                      </button>
                    )}
                    {u.status === 'ACTIVE' ? (
                      <button
                        onClick={() => handleToggleUser(u.id, 'freeze')}
                        disabled={actionLoading[u.id]}
                        className="flex-1 min-w-[70px] py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"
                      >
                        تجميد
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleUser(u.id, 'activate')}
                        disabled={actionLoading[u.id]}
                        className="flex-1 min-w-[70px] py-2 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100"
                      >
                        تنشيط
                      </button>
                    )}
                    {isExpiring && (
                      <button
                        onClick={() => sendRenewalReminder(u)}
                        className="w-full mt-1 py-2 bg-[#25D366] text-white rounded-lg text-xs font-medium hover:bg-[#128C7E] flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.126.554 4.195 1.602 6.014L.132 24l6.115-1.602c1.761.986 3.757 1.507 5.784 1.507 6.646 0 12.031-5.385 12.031-12.031C24 5.385 18.677 0 12.031 0zm0 21.91c-1.8 0-3.565-.483-5.118-1.402l-.367-.218-3.804.997 1.018-3.71-.24-.383C2.535 15.655 2.019 13.864 2.019 12.031c0-5.526 4.496-10.022 10.012-10.022 5.526 0 10.022 4.496 10.022 10.022 0 5.526-4.496 10.022-10.022 10.022zm5.498-7.508c-.302-.15-1.789-.882-2.066-.983-.277-.101-.48-.15-.682.15-.202.302-.782.983-.959 1.184-.177.202-.354.227-.656.076-1.428-.713-2.583-1.849-3.235-3.238-.151-.302.076-.465.226-.615.136-.136.302-.354.453-.531.151-.177.202-.302.302-.505.101-.202.05-.38-.025-.531-.076-.15-1.789-4.318-2.45-5.918-.636-1.537-1.282-1.328-1.765-1.353-.453-.024-.959-.024-1.465-.024-.505 0-1.314.19-2 .935C1.868 4.295.959 5.861.959 8.21c0 2.348 1.969 4.621 2.246 4.992.277.371 3.407 5.201 8.254 7.29 1.153.497 2.05.795 2.75 1.018 1.158.368 2.21.316 3.038.192 1.008-.15 3.104-1.267 3.543-2.492.439-1.225.439-2.273.308-2.492-.126-.219-.48-.344-.782-.494z"/>
                        </svg>
                        إرسال تذكير تجديد
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="space-y-3">
          {pendingSubscriptions.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <FiFileText size={40} className="mx-auto text-gray-300 mb-2" />
              لا توجد طلبات اشتراك معلقة
            </div>
          ) : (
            pendingSubscriptions.map((sub) => (
              <div key={sub.id} className="bg-white rounded-xl p-4 card-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-gray-800">طلب اشتراك جديد</h4>
                    <p className="text-xs text-gray-500">تاريخ الطلب: {formatDate(sub.created_at)}</p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold">
                    قيد المراجعة
                  </span>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm space-y-1">
                  <p><strong>المبلغ المستخرج:</strong> {sub.ocr_data?.amount ? `${formatCurrency(sub.ocr_data.amount)} ج.س` : 'غير متوفر'}</p>
                  <p><strong>رقم العملية:</strong> {sub.ocr_data?.reference_number || 'غير متوفر'}</p>
                  <p><strong>التاريخ المكتوب:</strong> {sub.ocr_data?.date || 'غير متوفر'}</p>
                </div>

                {sub.receipt_image && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-gray-700 mb-1">صورة الإشعار:</p>
                    <a href={sub.receipt_image} target="_blank" rel="noreferrer">
                       <img src={sub.receipt_image} alt="Receipt" className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90" />
                    </a>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleReviewSubscription(sub.id, 'approve')}
                    disabled={actionLoading[sub.id]}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                  >
                    قبول وتفعيل
                  </button>
                  <button
                    onClick={() => handleReviewSubscription(sub.id, 'reject')}
                    disabled={actionLoading[sub.id]}
                    className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 disabled:opacity-50"
                  >
                    رفض
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl p-5 card-shadow space-y-4">
          <div className="flex items-center gap-2 mb-2 border-b border-gray-100 pb-3">
            <FiShield className="text-primary-600" size={20} />
            <h3 className="font-bold text-gray-800 text-base">إعدادات أسعار الاشتراكات</h3>
          </div>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">سعر الاشتراك الشهري (ج.س)</label>
              <input
                type="text"
                inputMode="decimal"
                value={settings.monthly_price}
                onChange={(e) => setSettings(prev => ({ ...prev, monthly_price: normalizeArabicNumber(e.target.value) }))}
                placeholder="مثال: 10000"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-left font-bold font-mono text-lg text-primary-700 bg-primary-50/10"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">سعر الاشتراك الربع سنوي - 3 أشهر (ج.س)</label>
              <input
                type="text"
                inputMode="decimal"
                value={settings.quarterly_price}
                onChange={(e) => setSettings(prev => ({ ...prev, quarterly_price: normalizeArabicNumber(e.target.value) }))}
                placeholder="مثال: 27000"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-left font-bold font-mono text-lg text-primary-700 bg-primary-50/10"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">سعر الاشتراك النصف سنوي - 6 أشهر (ج.س)</label>
              <input
                type="text"
                inputMode="decimal"
                value={settings.semi_annual_price}
                onChange={(e) => setSettings(prev => ({ ...prev, semi_annual_price: normalizeArabicNumber(e.target.value) }))}
                placeholder="مثال: 50000"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-left font-bold font-mono text-lg text-primary-700 bg-primary-50/10"
                dir="ltr"
                required
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors shadow-lg shadow-primary-500/20"
            >
              {savingSettings ? 'جاري الحفظ...' : '✔ حفظ الأسعار الجديدة'}
            </button>
          </form>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">إضافة مستخدم جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">نوع المستخدم</label>
                <div className="flex gap-2">
                  <label className={`flex-1 p-2 border rounded-xl cursor-pointer text-center text-sm ${newRole === 'merchant' ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold' : 'border-gray-200 text-gray-700'}`}>
                    <input type="radio" name="role" value="merchant" checked={newRole === 'merchant'} onChange={(e) => setNewRole(e.target.value)} className="hidden" />
                    تاجر
                  </label>
                  <label className={`flex-1 p-2 border rounded-xl cursor-pointer text-center text-sm ${newRole === 'admin' ? 'border-purple-500 bg-purple-50 text-purple-700 font-bold' : 'border-gray-200 text-gray-700'}`}>
                    <input type="radio" name="role" value="admin" checked={newRole === 'admin'} onChange={(e) => setNewRole(e.target.value)} className="hidden" />
                    أدمن
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0xxxxxxxxx"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">الاسم / المتجر</label>
                <input
                  type="text"
                  required
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder={newRole === 'admin' ? "اسم الأدمن" : "اسم المتجر"}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">كلمة المرور</label>
                <input
                  type="text"
                  required
                  minLength="6"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور المؤقتة"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                  dir="ltr"
                />
              </div>
              
              {newRole === 'merchant' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">صلاحية الاشتراك (بالأيام)</label>
                  <input
                    type="number"
                    value={newSubDays}
                    onChange={(e) => setNewSubDays(e.target.value)}
                    placeholder="30"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                    dir="ltr"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={addingUser}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 mt-2"
              >
                {addingUser ? 'جاري الإضافة...' : 'حفظ وإضافة'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}