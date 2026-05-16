import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { FiUsers, FiUserCheck, FiUserX, FiClock, FiAlertTriangle, FiRefreshCw, FiShield } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.listUsers({}),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-primary-600 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <FiShield className="text-primary-600" size={24} />
        <h2 className="text-lg font-bold text-gray-800">لوحة تحكم الأدمن</h2>
      </div>

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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <FiAlertTriangle className="text-amber-600" size={18} />
          <span className="text-sm text-amber-800">{stats.expiring_soon} اشتراك ينتهي خلال 3 أيام</span>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="tel"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم الهاتف"
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
        {users.map((u) => (
          <div key={u.id} className="bg-white rounded-xl p-4 card-shadow">
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
              <p className="text-xs text-gray-500 mb-2">
                انتهاء الاشتراك: {formatDate(u.subscription_end_date)}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleExtend(u.id)}
                className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
              >
                تمديد
              </button>
              {u.status === 'ACTIVE' ? (
                <button
                  onClick={() => handleToggleUser(u.id, 'freeze')}
                  disabled={actionLoading[u.id]}
                  className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"
                >
                  تجميد
                </button>
              ) : (
                <button
                  onClick={() => handleToggleUser(u.id, 'activate')}
                  disabled={actionLoading[u.id]}
                  className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100"
                >
                  تنشيط
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
