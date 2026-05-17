import { useState, useEffect, useMemo } from 'react';
import { customerAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { FiUserPlus, FiDollarSign, FiX, FiCheck, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.phone && c.phone.includes(searchQuery))
    );
  }, [customers, searchQuery]);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
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

  const handleAddDebt = async (e) => {
    e.preventDefault();
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

  const handlePayDebt = async (e) => {
    e.preventDefault();
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

  const handleWhatsAppReminder = (customer) => {
    if (!customer.phone) {
      toast.error('لا يوجد رقم هاتف مسجل لهذا العميل');
      return;
    }
    
    const shopName = user?.store_name || 'البقالة';
    const message = `السلام عليكم ${customer.name}، حبيت أذكرك بالمديونية لمحل ${shopName}، بمبلغ: ${customer.total_debt} جنيه.`;
    
    let phone = customer.phone.replace(/[\s+]/g, '');
    if (phone.startsWith('0')) {
       phone = '249' + phone.substring(1);
    }
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">العملاء والديون</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 shadow-sm"
        >
          <FiUserPlus size={16} />
          إضافة عميل
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <FiSearch className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث بالاسم أو رقم الهاتف..."
          className="block w-full pl-3 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 text-sm"
        />
      </div>

      {/* Customer List */}
      {loading ? (
        <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <FiUserPlus size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">لا يوجد عملاء بعد</p>
          <p className="text-sm text-gray-400 mt-1">اضغط على "إضافة عميل" للبدء</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">لا توجد نتائج مطابقة للبحث</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-white rounded-xl p-4 card-shadow">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-bold text-gray-800 text-lg">{customer.name}</h4>
                  {customer.phone && <p className="text-sm text-gray-500" dir="ltr">{customer.phone}</p>}
                </div>
                <div className="text-left bg-gray-50 px-3 py-2 rounded-lg">
                  <p className="text-xs text-gray-500">الدين القائم</p>
                  <p className={`font-bold text-lg ${customer.total_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(customer.total_debt)} ج.س
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedCustomer(customer); setShowDebtModal(true); }}
                    className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors"
                  >
                    + إضافة دين
                  </button>
                  <button
                    onClick={() => { setSelectedCustomer(customer); setShowPayModal(true); }}
                    className="flex-1 py-2.5 bg-green-50 text-green-600 rounded-lg text-sm font-bold hover:bg-green-100 transition-colors"
                  >
                    تسجيل سداد
                  </button>
                </div>
                {customer.total_debt > 0 && (
                  <button
                    onClick={() => handleWhatsAppReminder(customer)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366] text-white rounded-lg text-sm font-bold hover:bg-[#128C7E] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.126.554 4.195 1.602 6.014L.132 24l6.115-1.602c1.761.986 3.757 1.507 5.784 1.507 6.646 0 12.031-5.385 12.031-12.031C24 5.385 18.677 0 12.031 0zm0 21.91c-1.8 0-3.565-.483-5.118-1.402l-.367-.218-3.804.997 1.018-3.71-.24-.383C2.535 15.655 2.019 13.864 2.019 12.031c0-5.526 4.496-10.022 10.012-10.022 5.526 0 10.022 4.496 10.022 10.022 0 5.526-4.496 10.022-10.022 10.022zm5.498-7.508c-.302-.15-1.789-.882-2.066-.983-.277-.101-.48-.15-.682.15-.202.302-.782.983-.959 1.184-.177.202-.354.227-.656.076-1.428-.713-2.583-1.849-3.235-3.238-.151-.302.076-.465.226-.615.136-.136.302-.354.453-.531.151-.177.202-.302.302-.505.101-.202.05-.38-.025-.531-.076-.15-1.789-4.318-2.45-5.918-.636-1.537-1.282-1.328-1.765-1.353-.453-.024-.959-.024-1.465-.024-.505 0-1.314.19-2 .935C1.868 4.295.959 5.861.959 8.21c0 2.348 1.969 4.621 2.246 4.992.277.371 3.407 5.201 8.254 7.29 1.153.497 2.05.795 2.75 1.018 1.158.368 2.21.316 3.038.192 1.008-.15 3.104-1.267 3.543-2.492.439-1.225.439-2.273.308-2.492-.126-.219-.48-.344-.782-.494z"/>
                    </svg>
                    إرسال تذكير عبر واتساب
                  </button>
                )}
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
            <form onSubmit={handleAddCustomer} className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="اسم العميل"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="رقم الهاتف (اختياري)"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                dir="ltr"
              />
              <button
                type="submit"
                disabled={actionLoading || !newName}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50"
              >
                {actionLoading ? 'جاري الحفظ...' : 'حفظ العميل'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Debt Modal */}
      {showDebtModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">تسجيل دين على: {selectedCustomer.name}</h3>
              <button onClick={() => setShowDebtModal(false)} className="text-gray-400">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleAddDebt} className="space-y-3">
              <div className="flex gap-2">
                <label className={`flex-1 p-3 border rounded-xl cursor-pointer text-center text-sm font-bold ${debtType === 'DEBT' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
                  <input type="radio" name="debtType" value="DEBT" checked={debtType === 'DEBT'} onChange={() => setDebtType('DEBT')} className="hidden" />
                  دين نقدي (كاش)
                </label>
                <label className={`flex-1 p-3 border rounded-xl cursor-pointer text-center text-sm font-bold ${debtType === 'CASH' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
                  <input type="radio" name="debtType" value="CASH" checked={debtType === 'CASH'} onChange={() => setDebtType('CASH')} className="hidden" />
                  دين تحويل (بنكك)
                </label>
              </div>
              <input
                type="number"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                placeholder="المبلغ"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-left text-lg font-bold"
                dir="ltr"
                required
              />
              <input
                type="text"
                value={debtDesc}
                onChange={(e) => setDebtDesc(e.target.value)}
                placeholder="وصف أو ملاحظة (اختياري)"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                disabled={actionLoading || !debtAmount}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'جاري الحفظ...' : 'حفظ الدين'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Pay Debt Modal */}
      {showPayModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">تسجيل سداد من: {selectedCustomer.name}</h3>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400">
                <FiX size={20} />
              </button>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3 text-center">
              <p className="text-sm text-gray-500 mb-1">إجمالي الدين المتبقي:</p>
              <p className="font-bold text-red-600 text-xl">{formatCurrency(selectedCustomer.total_debt)} ج.س</p>
            </div>
            <form onSubmit={handlePayDebt} className="space-y-3">
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="المبلغ المسدد"
                className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-left text-lg font-bold"
                dir="ltr"
                required
              />
              <button
                type="submit"
                disabled={actionLoading || !payAmount}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'جاري الحفظ...' : 'حفظ السداد'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}