import { useState, useEffect } from 'react';
import { adminAPI, subscriptionAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { FiUsers, FiUserCheck, FiUserX, FiClock, FiAlertTriangle, FiRefreshCw, FiShield, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [pendingSubscriptions, setPendingSubscriptions] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'subscriptions'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, usersRes, pendingSubsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.listUsers({}),
        subscriptionAPI.getPending(),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setPendingSubscriptions(pendingSubsRes.data);
    } catch (error) {
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
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
      reason = prompt('سبب الرفض:');
      if (!reason) return;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-primary-600 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      <div className="flex items-center gap-2">
        <FiShield className="text-primary-600" size={24} />
        <h2 className="text-lg font-bold text-gray-800">لوحة تحكم الأدمن</h2>
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
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-4">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-xl p-3 card-shadow text-center">
                <FiUsers className="mx-auto text-blue-500 mb-1" size={20} />
                <p className="text-xl font-bold">{stats.total_users}</p>
                <p className="text-xs text-gray-500">إجمالي</p>
              </div>
              <div className="bg-white rounded-xl p-3 card-shadow text-center">
                <FiUserCheck className="mx-auto text-green-500 mb-1" size={20} />
                <p className="text-xl font-bold">{stats.active_users}</p>
                <p className="text-xs text-gray-500">نشط</p>
              </div>
              <div className="bg-white rounded-xl p-3 card-shadow text-center">
                <FiUserX className="mx-auto text-red-500 mb-1" size={20} />
                <p className="text-xl font-bold">{stats.frozen_users}</p>
                <p className="text-xs text-gray-500">مجمد</p>
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
              const isExpiring = u.subscription_end_date && new Date(u.subscription_end_date) < new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
              return (
                <div key={u.id} className={`bg-white rounded-xl p-4 card-shadow ${isExpiring ? 'border-2 border-amber-300' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-gray-800">{u.store_name}</h4>
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
                  {u.subscription_end_date && (
                    <p className={`text-xs mb-3 ${isExpiring ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
                      انتهاء الاشتراك: {formatDate(u.subscription_end_date)}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleExtend(u.id)}
                      className="flex-1 min-w-[70px] py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
                    >
                      تمديد
                    </button>
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
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.126.554 4.195 1.602 6.014L.132 24l6.115-1.602c1.761.986 3.757 1.507 5.784 1.507 6.646 0 12.031-5.385 12.031-12.031C24 5.385 18.677 0 12.031 0zm0 21.91c-1.8 0-3.565-.483-5.118-1.402l-.367-.218-3.804.997 1.018-3.71-.24-.383C2.535 15.655 2.019 13.864 2.019 12.031c0-5.526 4.496-10.022 10.012-10.022 5.526 0 10.022 4.496 10.022 10.022 0 5.526-4.496 10.022-10.022 10.022zm5.498-7.508c-.302-.15-1.789-.882-2.066-.983-.277-.101-.48-.15-.682.15-.202.302-.782.983-.959 1.184-.177.202-.354.227-.656.076-1.428-.713-2.583-1.849-3.235-3.238-.151-.302.076-.465.226-.615.136-.136.302-.354.453-.531.151-.177.202-.302.302-.505.101-.202.05-.38-.025-.531-.076-.15-1.789-4.318-2.45-5.918-.636-1.537-1.282-1.328-1.765-1.353-.453-.024-.959-.024-1.465-.024-.505 0-1.314.19-2 .935C1.868 4.295.959 5.861.959 8.21c0 2.348 1.969 4.621 2.246 4.992.277.371 3.407 5.201 8.254 7.29 1.153.497 2.05.795 2.75 1.018 1.158.368 2.21.316 3.038.192 1.008-.15 3.104-1.267 3.543-2.492.439-1.225.439-2.273.308-2.492-.126-.219-.48-.344-.782-.494z"/></svg>
                        إرسال تذكير تجديد
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
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
                
                <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
                  <p><strong>المبلغ المرفق بالطلب:</strong> {sub.amount ? `${formatCurrency(sub.amount)} ج.س` : 'غير محدد'}</p>
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
    </div>
  );
}