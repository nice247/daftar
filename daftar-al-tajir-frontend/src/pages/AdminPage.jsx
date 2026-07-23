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
        <div className="w-8 h-8 border-[3px] border-[#DEE2E6] border-t-[#2B8A3E] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiShield className="text-[#2B8A3E]" size={24} />
          <h2 className="text-lg font-bold text-[#212529]">لوحة تحكم الأدمن</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 bg-[#2B8A3E] text-white px-3 py-2 rounded-[12px] text-sm font-bold hover:bg-[#237032] transition-colors"
        >
          <FiUserPlus size={16} />
          إضافة مستخدم
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#DEE2E6]">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${
            activeTab === 'users' ? 'border-[#2B8A3E] text-[#2B8A3E]' : 'border-transparent text-[#6C757D] hover:text-[#212529]'
          }`}
        >
          المستخدمين
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors relative ${
            activeTab === 'subscriptions' ? 'border-[#2B8A3E] text-[#2B8A3E]' : 'border-transparent text-[#6C757D] hover:text-[#212529]'
          }`}
        >
          طلبات الاشتراك
          {pendingSubscriptions.length > 0 && (
            <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
              {pendingSubscriptions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${
            activeTab === 'settings' ? 'border-[#2B8A3E] text-[#2B8A3E]' : 'border-transparent text-[#6C757D] hover:text-[#212529]'
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
              <div className="bg-white border border-[#DEE2E6] rounded-[12px] p-3 card-shadow text-center">
                <FiUsers className="mx-auto text-[#1C7ED6] mb-1" size={20} />
                <p className="text-xl font-bold text-[#212529]">{stats.total_users}</p>
                <p className="text-xs text-[#6C757D]">إجمالي التجار</p>
              </div>
              <div className="bg-white border border-[#DEE2E6] rounded-[12px] p-3 card-shadow text-center">
                <FiUserCheck className="mx-auto text-[#2B8A3E] mb-1" size={20} />
                <p className="text-xl font-bold text-[#212529]">{stats.active_users}</p>
                <p className="text-xs text-[#6C757D]">تاجر نشط</p>
              </div>
              <div className="bg-white border border-[#DEE2E6] rounded-[12px] p-3 card-shadow text-center">
                <FiUserX className="mx-auto text-red-600 mb-1" size={20} />
                <p className="text-xl font-bold text-[#212529]">{stats.frozen_users}</p>
                <p className="text-xs text-[#6C757D]">تاجر مجمد</p>
              </div>
              <div className="bg-white border border-[#DEE2E6] rounded-[12px] p-3 card-shadow text-center">
                <FiClock className="mx-auto text-amber-600 mb-1" size={20} />
                <p className="text-xl font-bold text-[#212529]">{stats.pending_verification}</p>
                <p className="text-xs text-[#6C757D]">معلق</p>
              </div>
            </div>
          )}

          {/* Expiring Soon Alert */}
          {stats?.expiring_soon > 0 && (
            <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-[12px] p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <FiAlertTriangle className="text-amber-600" size={18} />
                <span className="text-sm font-bold text-[#212529]">{stats.expiring_soon} اشتراكات تقترب من الانتهاء</span>
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
              className="flex-1 px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm"
              dir="ltr"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] text-sm font-medium transition-colors"
            >
              بحث
            </button>
          </div>

          {/* Users List */}
          <div className="space-y-2">
            {users.map((u) => {
              const isExpiring = u.role === 'merchant' && u.subscription_end_date && new Date(u.subscription_end_date) < new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
              return (
                <div key={u.id} className={`bg-white rounded-[12px] p-4 border border-[#DEE2E6] card-shadow ${isExpiring ? 'border-2 border-amber-500' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-[#212529]">
                        {u.store_name}
                        {u.role === 'admin' && <span className="ml-2 text-[10px] border border-purple-300 text-purple-700 px-2 py-0.5 rounded-full">أدمن</span>}
                      </h4>
                      <p className="text-xs text-[#6C757D]" dir="ltr">{u.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold border ${
                      u.status === 'ACTIVE' ? 'text-[#2B8A3E] border-[#2B8A3E]/30' :
                      u.status === 'FROZEN' ? 'text-red-600 border-red-600/30' :
                      'text-amber-600 border border-amber-600/30'
                    } bg-transparent`}>
                      {u.status === 'ACTIVE' ? 'نشط' : u.status === 'FROZEN' ? 'مجمد' : 'معلق'}
                    </span>
                  </div>
                  {u.role === 'merchant' && u.subscription_end_date && (
                    <p className={`text-xs mb-3 ${isExpiring ? 'text-amber-600 font-bold' : 'text-[#6C757D]'}`}>
                      انتهاء الاشتراك: {formatDate(u.subscription_end_date)}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {u.role === 'merchant' && (
                      <button
                        onClick={() => handleExtend(u.id)}
                        className="flex-1 min-w-[70px] py-2 bg-[#F8F9FA] hover:bg-[#F1F3F5] text-[#1C7ED6] border border-[#DEE2E6] rounded-[12px] font-bold transition-colors text-xs"
                      >
                        تمديد
                      </button>
                    )}
                    {u.status === 'ACTIVE' ? (
                      <button
                        onClick={() => handleToggleUser(u.id, 'freeze')}
                        disabled={actionLoading[u.id]}
                        className="flex-1 min-w-[70px] py-2 bg-[#F8F9FA] hover:bg-[#F1F3F5] text-red-600 border border-[#DEE2E6] rounded-[12px] font-bold transition-colors text-xs"
                      >
                        تجميد
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleUser(u.id, 'activate')}
                        disabled={actionLoading[u.id]}
                        className="flex-1 min-w-[70px] py-2 bg-[#F8F9FA] hover:bg-[#F1F3F5] text-[#2B8A3E] border border-[#DEE2E6] rounded-[12px] font-bold transition-colors text-xs"
                      >
                        تنشيط
                      </button>
                    )}
                    {isExpiring && (
                      <button
                        onClick={() => sendRenewalReminder(u)}
                        className="w-full mt-1 py-2 bg-[#25D366] text-white rounded-[12px] text-xs font-medium hover:bg-[#128C7E] flex items-center justify-center gap-1 transition-colors"
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
            <div className="text-center py-10 text-[#6C757D]">
              <FiFileText size={40} className="mx-auto text-[#DEE2E6] mb-2" />
              لا توجد طلبات اشتراك معلقة
            </div>
          ) : (
            pendingSubscriptions.map((sub) => (
              <div key={sub.id} className="bg-white border border-[#DEE2E6] rounded-[12px] p-4 card-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-[#212529]">طلب اشتراك جديد</h4>
                    <p className="text-xs text-[#6C757D]">تاريخ الطلب: {formatDate(sub.created_at)}</p>
                  </div>
                  <span className="text-amber-600 border border-amber-600/30 bg-transparent text-xs px-2 py-1 rounded-full font-bold">
                    قيد المراجعة
                  </span>
                </div>
                
                <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-[12px] p-3 mb-3 text-sm space-y-1 text-[#212529]">
                  <p><strong>المبلغ المستخرج:</strong> {sub.ocr_data?.amount ? `${formatCurrency(sub.ocr_data.amount)} ج.س` : 'غير متوفر'}</p>
                  <p><strong>رقم العملية:</strong> {sub.ocr_data?.reference_number || 'غير متوفر'}</p>
                  <p><strong>التاريخ المكتوب:</strong> {sub.ocr_data?.date || 'غير متوفر'}</p>
                </div>

                {sub.receipt_image && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-[#212529] mb-1">صورة الإشعار:</p>
                    <a href={sub.receipt_image} target="_blank" rel="noreferrer">
                       <img src={sub.receipt_image} alt="Receipt" className="w-full h-32 object-cover rounded-[12px] border border-[#DEE2E6] cursor-pointer hover:opacity-90" />
                    </a>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleReviewSubscription(sub.id, 'approve')}
                    disabled={actionLoading[sub.id]}
                    className="flex-1 py-2.5 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
                  >
                    قبول وتفعيل
                  </button>
                  <button
                    onClick={() => handleReviewSubscription(sub.id, 'reject')}
                    disabled={actionLoading[sub.id]}
                    className="flex-1 py-2.5 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-red-600 border border-[#DEE2E6] rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
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
        <div className="bg-white border border-[#DEE2E6] rounded-[12px] p-5 card-shadow space-y-4">
          <div className="flex items-center gap-2 mb-2 border-b border-[#DEE2E6] pb-3">
            <FiShield className="text-[#2B8A3E]" size={20} />
            <h3 className="font-bold text-[#212529] text-base">إعدادات أسعار الاشتراكات</h3>
          </div>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#6C757D]">سعر الاشتراك الشهري (ج.س)</label>
              <input
                type="text"
                inputMode="decimal"
                value={settings.monthly_price}
                onChange={(e) => setSettings(prev => ({ ...prev, monthly_price: normalizeArabicNumber(e.target.value) }))}
                placeholder="مثال: 10000"
                className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-left font-bold font-mono text-lg text-[#2B8A3E] bg-white"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#6C757D]">سعر الاشتراك الربع سنوي - 3 أشهر (ج.س)</label>
              <input
                type="text"
                inputMode="decimal"
                value={settings.quarterly_price}
                onChange={(e) => setSettings(prev => ({ ...prev, quarterly_price: normalizeArabicNumber(e.target.value) }))}
                placeholder="مثال: 27000"
                className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-left font-bold font-mono text-lg text-[#2B8A3E] bg-white"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#6C757D]">سعر الاشتراك النصف سنوي - 6 أشهر (ج.س)</label>
              <input
                type="text"
                inputMode="decimal"
                value={settings.semi_annual_price}
                onChange={(e) => setSettings(prev => ({ ...prev, semi_annual_price: normalizeArabicNumber(e.target.value) }))}
                placeholder="مثال: 50000"
                className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-left font-bold font-mono text-lg text-[#2B8A3E] bg-white"
                dir="ltr"
                required
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3.5 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] font-bold text-sm disabled:opacity-50 transition-colors"
            >
              {savingSettings ? 'جاري الحفظ...' : '✔ حفظ الأسعار الجديدة'}
            </button>
          </form>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-10 px-4 justify-center overflow-y-auto">
          <div className="bg-white rounded-[12px] p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEE2E6] pb-3">
              <h3 className="font-bold text-[#212529] text-lg">إضافة مستخدم جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#6C757D] hover:text-[#212529]">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs text-[#6C757D] mb-1">نوع المستخدم</label>
                <div className="flex gap-2">
                  <label className={`flex-1 p-2 border rounded-[12px] cursor-pointer text-center text-sm ${newRole === 'merchant' ? 'border-[#2B8A3E] text-[#2B8A3E] font-bold bg-white' : 'border-[#DEE2E6] text-[#6C757D] bg-white'}`}>
                    <input type="radio" name="role" value="merchant" checked={newRole === 'merchant'} onChange={(e) => setNewRole(e.target.value)} className="hidden" />
                    تاجر
                  </label>
                  <label className={`flex-1 p-2 border rounded-[12px] cursor-pointer text-center text-sm ${newRole === 'admin' ? 'border-purple-500 text-purple-700 font-bold bg-white' : 'border-[#DEE2E6] text-[#6C757D] bg-white'}`}>
                    <input type="radio" name="role" value="admin" checked={newRole === 'admin'} onChange={(e) => setNewRole(e.target.value)} className="hidden" />
                    أدمن
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#6C757D] mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0xxxxxxxxx"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6C757D] mb-1">الاسم / المتجر</label>
                <input
                  type="text"
                  required
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder={newRole === 'admin' ? "اسم الأدمن" : "اسم المتجر"}
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6C757D] mb-1">كلمة المرور</label>
                <input
                  type="text"
                  required
                  minLength="6"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور المؤقتة"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E]"
                  dir="ltr"
                />
              </div>
              
              {newRole === 'merchant' && (
                <div>
                  <label className="block text-xs text-[#6C757D] mb-1">صلاحية الاشتراك (بالأيام)</label>
                  <input
                    type="number"
                    value={newSubDays}
                    onChange={(e) => setNewSubDays(e.target.value)}
                    placeholder="30"
                    className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E]"
                    dir="ltr"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={addingUser}
                className="w-full py-3 bg-[#2B8A3E] text-white rounded-[12px] font-bold hover:bg-[#237032] disabled:opacity-50 mt-2 transition-colors"
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