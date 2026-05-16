import { useState, useEffect } from 'react';
import { customerAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { FiUserPlus, FiDollarSign, FiX, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtType, setDebtType] = useState('DEBT');
  const [debtDesc, setDebtDesc] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await customerAPI.list();
      setCustomers(response.data);
    } catch (error) {
      toast.error('فشل في تحميل العملاء');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    setActionLoading(true);
    try {
      await customerAPI.create({ name: newName, phone: newPhone || null });
      toast.success('تم إضافة العميل بنجاح');
      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      loadCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في إضافة العميل');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddDebt = async () => {
    setActionLoading(true);
    try {
      await customerAPI.addDebt({
        customer_id: selectedCustomer.id,
        amount: parseFloat(debtAmount),
        debt_type: debtType,
        description: debtDesc || null,
      });
      toast.success('تم تسجيل الدين بنجاح');
      setShowDebtModal(false);
      setDebtAmount('');
      setDebtDesc('');
      loadCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل الدين');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayDebt = async () => {
    setActionLoading(true);
    try {
      await customerAPI.payDebt({
        customer_id: selectedCustomer.id,
        amount: parseFloat(payAmount),
      });
      toast.success('تم تسجيل السداد بنجاح');
      setShowPayModal(false);
      setPayAmount('');
      loadCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل السداد');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">العملاء والديون</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700"
        >
          <FiUserPlus size={16} />
          عميل جديد
        </button>
      </div>

      {/* Customer List */}
      {loading ? (
        <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
      ) : customers.length === 0 ? (
        <div className="text-center py-12">
          <FiUserPlus size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">لا يوجد عملاء بعد</p>
          <p className="text-sm text-gray-400">أضف عميلك الأول</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((customer) => (
            <div key={customer.id} className="bg-white rounded-xl p-4 card-shadow">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold text-gray-800">{customer.name}</h4>
                  {customer.phone && <p className="text-xs text-gray-500" dir="ltr">{customer.phone}</p>}
                </div>
                <div className="text-left">
                  <p className="text-xs text-gray-500">الدين القائم</p>
                  <p className={`font-bold ${customer.total_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(customer.total_debt)} ج.س
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedCustomer(customer); setShowDebtModal(true); }}
                  className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"
                >
                  + دين
                </button>
                <button
                  onClick={() => { setSelectedCustomer(customer); setShowPayModal(true); }}
                  className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100"
                >
                  سداد
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">إضافة عميل جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400">
                <FiX size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="اسم العميل"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="رقم الهاتف (اختياري)"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleAddCustomer}
                disabled={actionLoading || !newName}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50"
              >
                {actionLoading ? 'جاري الإضافة...' : 'إضافة العميل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Debt Modal */}
      {showDebtModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">تسجيل دين - {selectedCustomer.name}</h3>
              <button onClick={() => setShowDebtModal(false)} className="text-gray-400">
                <FiX size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <label className={`flex-1 p-3 border rounded-xl cursor-pointer text-center text-sm ${debtType === 'DEBT' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                  <input type="radio" name="debtType" value="DEBT" checked={debtType === 'DEBT'} onChange={() => setDebtType('DEBT')} className="hidden" />
                  دين كاش
                </label>
                <label className={`flex-1 p-3 border rounded-xl cursor-pointer text-center text-sm ${debtType === 'CASH' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                  <input type="radio" name="debtType" value="CASH" checked={debtType === 'CASH'} onChange={() => setDebtType('CASH')} className="hidden" />
                  دين بنكك
                </label>
              </div>
              <input
                type="number"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                placeholder="المبلغ"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-left"
                dir="ltr"
              />
              <input
                type="text"
                value={debtDesc}
                onChange={(e) => setDebtDesc(e.target.value)}
                placeholder="وصف (اختياري)"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleAddDebt}
                disabled={actionLoading || !debtAmount}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'جاري التسجيل...' : 'تسجيل الدين'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Debt Modal */}
      {showPayModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">سداد دين - {selectedCustomer.name}</h3>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400">
                <FiX size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              الدين القائم: <span className="font-bold text-red-600">{formatCurrency(selectedCustomer.total_debt)} ج.س</span>
            </p>
            <div className="space-y-3">
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="مبلغ السداد"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-left"
                dir="ltr"
              />
              <button
                onClick={handlePayDebt}
                disabled={actionLoading || !payAmount}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'جاري التسجيل...' : 'تسجيل السداد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
