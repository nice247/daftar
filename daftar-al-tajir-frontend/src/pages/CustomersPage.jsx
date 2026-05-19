import { useState, useEffect, useMemo } from 'react';
import { customerAPI, merchantDebtAPI } from '../services/api';
import { formatCurrency, normalizeArabicNumber } from '../utils/helpers';
import {
  FiUserPlus, FiSearch, FiX, FiEdit2, FiTrash2, FiGift, FiCheck,
  FiPlus, FiCreditCard, FiTruck, FiChevronDown, FiChevronUp, FiDollarSign
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function CustomersPage() {
  const { user } = useAuth();
  
  // Tab Switcher State ('customers' or 'suppliers')
  const [activeTab, setActiveTab] = useState('customers');

  // Loading & Data States
  const [customers, setCustomers] = useState([]);
  const [merchantDebts, setMerchantDebts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Collapsed suppliers state (tracks which supplier names are expanded)
  const [expandedSuppliers, setExpandedSuppliers] = useState({});

  // Modals visibility
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showWaiveModal, setShowWaiveModal] = useState(false);

  // Supplier Modals visibility
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showAddSupplierDebtModal, setShowAddSupplierDebtModal] = useState(false);
  const [showPaySupplierModal, setShowPaySupplierModal] = useState(false);

  // Customer Form States
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtType, setDebtType] = useState('DEBT');
  const [debtDesc, setDebtDesc] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [waiveAmount, setWaiveAmount] = useState('');
  const [waiveReason, setWaiveReason] = useState('');

  // Supplier Form States
  const [supplierName, setSupplierName] = useState('');
  const [supplierDebtAmount, setSupplierDebtAmount] = useState('');
  const [supplierDebtType, setSupplierDebtType] = useState('cash');
  const [supplierDebtDesc, setSupplierDebtDesc] = useState('');
  
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [selectedSupplierDebtId, setSelectedSupplierDebtId] = useState('');
  const [supplierPayAmount, setSupplierPayAmount] = useState('');
  const [supplierPayMethod, setSupplierPayMethod] = useState('cash');
  const [supplierPayDesc, setSupplierPayDesc] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custRes, debtsRes] = await Promise.all([
        customerAPI.list(),
        merchantDebtAPI.list()
      ]);
      setCustomers(custRes.data);
      setMerchantDebts(debtsRes.data || []);
    } catch (error) {
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // Group merchant debts by supplier
  const uniqueSuppliers = useMemo(() => {
    const map = {};
    merchantDebts.forEach(d => {
      const name = d.supplier_name || 'مورد غير محدد';
      if (!map[name]) {
        map[name] = {
          name,
          total_remaining: 0,
          debts: []
        };
      }
      map[name].debts.push(d);
      if (d.status !== 'paid') {
        map[name].total_remaining += parseFloat(d.remaining || 0);
      }
    });
    return Object.values(map);
  }, [merchantDebts]);

  // Filtered lists
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery))
    );
  }, [customers, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery) return uniqueSuppliers;
    return uniqueSuppliers.filter(s =>
      s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())
    );
  }, [uniqueSuppliers, supplierSearchQuery]);

  // Expand / Collapse supplier details
  const toggleSupplierExpand = (name) => {
    setExpandedSuppliers(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // List of active supplier debts for selected supplier name (for paying)
  const activeSupplierDebts = useMemo(() => {
    if (!selectedSupplierName) return [];
    return merchantDebts.filter(d => d.supplier_name === selectedSupplierName && d.status !== 'paid');
  }, [selectedSupplierName, merchantDebts]);

  // Automatically select debt ID when supplier name or active supplier debts change
  useEffect(() => {
    if (activeSupplierDebts.length > 0) {
      setSelectedSupplierDebtId(activeSupplierDebts[0].id);
    } else {
      setSelectedSupplierDebtId('');
    }
  }, [activeSupplierDebts]);

  // Customer handlers
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await customerAPI.create({ name: newName, phone: newPhone });
      toast.success('تم إضافة العميل بنجاح');
      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في إضافة العميل');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (customer) => {
    setSelectedCustomer(customer);
    setNewName(customer.name);
    setNewPhone(customer.phone || '');
    setShowEditModal(true);
  };

  const handleEditCustomer = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await customerAPI.update(selectedCustomer.id, { name: newName, phone: newPhone });
      toast.success('تم تعديل العميل بنجاح');
      setShowEditModal(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل التعديل');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCustomer = async (customer) => {
    if (customer.total_debt > 0) {
      toast.error('لا يمكن حذف عميل لديه ديون قائمة');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف العميل ${customer.name}؟`)) return;

    setActionLoading(true);
    try {
      await customerAPI.delete(customer.id);
      toast.success('تم حذف العميل بنجاح');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في الحذف');
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
      loadData();
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
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل السداد');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWaiveDebt = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await customerAPI.waiveDebt({
        customer_id: selectedCustomer.id,
        amount: parseFloat(waiveAmount),
        reason: waiveReason || null,
      });
      toast.success('تم تسجيل الإعفاء بنجاح');
      setShowWaiveModal(false);
      setWaiveAmount('');
      setWaiveReason('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل الإعفاء');
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

  // Supplier handlers
  const handleAddSupplier = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await merchantDebtAPI.create({
        supplier_name: supplierName,
        debt_type: supplierDebtType,
        total_amount: parseFloat(supplierDebtAmount),
        description: supplierDebtDesc || 'تسجيل مورد جديد بمديونية أصلية'
      });
      toast.success('تم إضافة المورد والدين بنجاح');
      setShowAddSupplierModal(false);
      setSupplierName('');
      setSupplierDebtAmount('');
      setSupplierDebtDesc('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في إضافة المورد');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddSupplierDebt = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await merchantDebtAPI.create({
        supplier_name: selectedSupplierName,
        debt_type: supplierDebtType,
        total_amount: parseFloat(supplierDebtAmount),
        description: supplierDebtDesc || 'تسجيل دين إضافي للمورد'
      });
      toast.success('تم تسجيل الدين الإضافي للمورد بنجاح');
      setShowAddSupplierDebtModal(false);
      setSelectedSupplierName('');
      setSupplierDebtAmount('');
      setSupplierDebtDesc('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل الدين');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaySupplierDebt = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await merchantDebtAPI.pay({
        merchant_debt_id: selectedSupplierDebtId,
        amount: parseFloat(supplierPayAmount),
        payment_method: supplierPayMethod,
        description: supplierPayDesc || null
      });
      toast.success('تم تسجيل سداد المورد كمصروف بنجاح');
      setShowPaySupplierModal(false);
      setSupplierPayAmount('');
      setSupplierPayDesc('');
      setSelectedSupplierName('');
      setSelectedSupplierDebtId('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل السداد');
    } finally {
      setActionLoading(false);
    }
  };

  const openPaySupplierModalDirectly = (debt) => {
    setSelectedSupplierName(debt.supplier_name);
    setSelectedSupplierDebtId(debt.id);
    setSupplierPayAmount(debt.remaining.toString());
    setShowPaySupplierModal(true);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Segmented Tab Control Switcher */}
      <div className="bg-white rounded-2xl p-2 card-shadow border border-gray-100 flex shadow-sm">
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex-1 py-3 text-center rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'customers'
              ? 'bg-primary-600 text-white shadow-md transform scale-[1.01]'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FiUserPlus size={18} />
          العملاء (ديون العملاء)
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex-1 py-3 text-center rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'suppliers'
              ? 'bg-blue-600 text-white shadow-md transform scale-[1.01]'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FiTruck size={18} />
          الموردون (ديون التاجر)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. Suppliers Tab Panel */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && (
        <div className="bg-white rounded-2xl p-5 card-shadow border border-gray-100 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <FiTruck className="text-blue-600" size={22} />
                الموردون (ديون التاجر للموردين)
              </h2>
              <p className="text-xs text-gray-500 mt-1">سجل التزاماتك المالية للموردين والجهات التجارية المختلفة</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSupplierName('');
                  setSupplierDebtAmount('');
                  setSupplierDebtDesc('');
                  setShowAddSupplierModal(true);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <FiUserPlus size={14} />
                مورد جديد
              </button>
              <button
                onClick={() => {
                  setSelectedSupplierName('');
                  setSupplierDebtAmount('');
                  setSupplierDebtDesc('');
                  setShowAddSupplierDebtModal(true);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all"
              >
                <FiPlus size={14} />
                دين لمورد
              </button>
              <button
                onClick={() => {
                  setSelectedSupplierName('');
                  setSupplierPayAmount('');
                  setSupplierPayDesc('');
                  setShowPaySupplierModal(true);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-xs font-bold transition-all"
              >
                <FiDollarSign size={14} />
                تسجيل سداد
              </button>
            </div>
          </div>

          {/* Supplier Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <FiSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={supplierSearchQuery}
              onChange={(e) => setSupplierSearchQuery(e.target.value)}
              placeholder="بحث عن مورد..."
              className="block w-full pl-3 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Suppliers List */}
          {loading ? (
            <p className="text-center text-gray-400 py-4 text-sm">جاري التحميل...</p>
          ) : uniqueSuppliers.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <FiTruck size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-xs font-bold">لا يوجد موردون مسجلون حالياً</p>
              <p className="text-[10px] text-gray-400 mt-1">اضغط على "مورد جديد" لبدء التسجيل</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <p className="text-center text-gray-400 py-2 text-xs">لا توجد نتائج مطابقة للبحث</p>
          ) : (
            <div className="space-y-2">
              {filteredSuppliers.map((supplier) => {
                const isExpanded = !!expandedSuppliers[supplier.name];
                return (
                  <div key={supplier.name} className="border border-gray-100 rounded-xl overflow-hidden shadow-xs hover:border-gray-200 transition-all">
                    {/* Supplier Header Row */}
                    <div
                      onClick={() => toggleSupplierExpand(supplier.name)}
                      className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 cursor-pointer transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                          {supplier.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 text-sm">{supplier.name}</h4>
                          <p className="text-[10px] text-gray-400 mt-0.5">{supplier.debts.length} فواتير/ديون مسجلة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="text-[10px] text-gray-400">الدين القائم للمورد</p>
                          <p className={`font-black text-sm ${supplier.total_remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(supplier.total_remaining)} ج.س
                          </p>
                        </div>
                        <span className="text-gray-400">
                          {isExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                        </span>
                      </div>
                    </div>

                    {/* Supplier Debt Records Detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-white p-3 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 px-1 border-b border-gray-50 pb-1.5">تفاصيل الديون والفواتير:</p>
                        {supplier.debts.map((debt) => (
                          <div key={debt.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 rounded-lg bg-gray-50/50 hover:bg-gray-50 border border-gray-100/50 gap-2 transition-all">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  debt.debt_type === 'cash' ? 'bg-emerald-50 text-emerald-700' :
                                  debt.debt_type === 'bank' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {debt.debt_type === 'cash' ? 'دين كاش' : debt.debt_type === 'bank' ? 'دين بنكك' : 'دين بضاعة'}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                  debt.status === 'paid' ? 'bg-green-100 text-green-800' :
                                  debt.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {debt.status === 'paid' ? 'مسدد بالكامل' : debt.status === 'partial' ? 'جزئي' : 'غير مسدد'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 font-medium">{debt.description || 'بلا وصف تفصيلي'}</p>
                              <p className="text-[9px] text-gray-400">التاريخ: {debt.created_at || 'غير متوفر'}</p>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                              <div className="text-left">
                                <p className="text-[9px] text-gray-400">المبلغ: {formatCurrency(debt.total_amount)}</p>
                                <p className="text-[10px] font-bold text-gray-700">المتبقي: {formatCurrency(debt.remaining)}</p>
                              </div>
                              {debt.status !== 'paid' && (
                                <button
                                  onClick={() => openPaySupplierModalDirectly(debt)}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                                >
                                  سداد
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Customers Tab Panel */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-2xl p-5 card-shadow border border-gray-100 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <FiUserPlus className="text-primary-600" size={22} />
                العملاء (ديون العملاء للتاجر)
              </h2>
              <p className="text-xs text-gray-500 mt-1">سجل ديون عملائك الأوفياء وقم بإرسال تذكيرات لهم عبر الواتساب مباشرة</p>
            </div>
            <button
              onClick={() => {
                setNewName('');
                setNewPhone('');
                setShowAddModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <FiUserPlus size={16} />
              إضافة عميل جديد
            </button>
          </div>

          {/* Customer Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <FiSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو رقم الهاتف..."
              className="block w-full pl-3 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Customer List */}
          {loading ? (
            <p className="text-center text-gray-400 py-4 text-sm">جاري التحميل...</p>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <FiUserPlus size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-xs font-bold">لا يوجد عملاء بعد</p>
              <p className="text-[10px] text-gray-400 mt-1">اضغط على "إضافة عميل جديد" للبدء</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-center text-gray-400 py-2 text-xs">لا توجد نتائج مطابقة للبحث</p>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 card-shadow transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-800 text-sm">{customer.name}</h4>
                        <button onClick={() => openEditModal(customer)} className="text-gray-400 hover:text-primary-600 p-1" title="تعديل"><FiEdit2 size={13} /></button>
                        {parseFloat(customer.total_debt || 0) === 0 && (
                          <button onClick={() => handleDeleteCustomer(customer)} className="text-gray-400 hover:text-red-600 p-1" title="حذف"><FiTrash2 size={13} /></button>
                        )}
                      </div>
                      {customer.phone && <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{customer.phone}</p>}
                    </div>
                    <div className="text-left bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                      <p className="text-[9px] text-gray-400">الدين القائم</p>
                      <p className={`font-black text-sm ${customer.total_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(customer.total_debt)} ج.س
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectedCustomer(customer); setDebtAmount(''); setDebtDesc(''); setShowDebtModal(true); }}
                        className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all"
                      >
                        + دين
                      </button>
                      <button
                        onClick={() => { setSelectedCustomer(customer); setPayAmount(''); setShowPayModal(true); }}
                        className="flex-1 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-xs font-bold transition-all"
                      >
                        سداد
                      </button>
                      <button
                        onClick={() => { setSelectedCustomer(customer); setWaiveAmount(''); setWaiveReason(''); setShowWaiveModal(true); }}
                        className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                      >
                        <FiGift size={12} /> إعفاء
                      </button>
                    </div>
                    {customer.total_debt > 0 && (
                      <button
                        onClick={() => handleWhatsAppReminder(customer)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Restructured Modals (Appear at top, clear Save & Cancel buttons) */}
      {/* ========================================================================= */}

      {/* A. Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-10 px-4 justify-center overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-lg">إضافة عميل جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-red-500"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">اسم العميل</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: محمد أحمد علي"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">رقم الهاتف</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="مثال: 0912345678"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  dir="ltr"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newName || !newPhone}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. Edit Customer Modal */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-10 px-4 justify-center overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-lg">تعديل بيانات العميل</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-red-500"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleEditCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">اسم العميل</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="اسم العميل"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">رقم الهاتف</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="رقم الهاتف"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  dir="ltr"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newName || !newPhone}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* C. Add Customer Debt Modal */}
      {showDebtModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-10 px-4 justify-center overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-lg">تسجيل دين للعميل: {selectedCustomer.name}</h3>
              <button onClick={() => setShowDebtModal(false)} className="text-gray-400 hover:text-red-500"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleAddDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">نوع الدين</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDebtType('DEBT')}
                    className={`flex-1 p-2.5 border rounded-xl text-xs font-bold transition-all ${debtType === 'DEBT' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    دين نقدي (كاش)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtType('CASH')}
                    className={`flex-1 p-2.5 border rounded-xl text-xs font-bold transition-all ${debtType === 'CASH' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    دين تحويل (بنكك)
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">المبلغ (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="المبلغ بالأرقام"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">وصف أو ملاحظة (اختياري)</label>
                <input
                  type="text"
                  value={debtDesc}
                  onChange={(e) => setDebtDesc(e.target.value)}
                  placeholder="مثال: شراء مواد تموينية"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDebtModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !debtAmount}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ الدين'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* D. Pay Customer Debt Modal */}
      {showPayModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-10 px-4 justify-center overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-lg">سداد دين للعميل: {selectedCustomer.name}</h3>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-red-500"><FiX size={20} /></button>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
              <p className="text-xs text-gray-400 mb-0.5">الدين القائم حالياً</p>
              <p className="font-black text-red-600 text-2xl">{formatCurrency(selectedCustomer.total_debt)} ج.س</p>
            </div>
            <form onSubmit={handlePayDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">المبلغ المسدد (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="المبلغ المسدد"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !payAmount}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ السداد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E. Waive Customer Debt Modal */}
      {showWaiveModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-10 px-4 justify-center overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-lg">إعفاء دين للعميل: {selectedCustomer.name}</h3>
              <button onClick={() => setShowWaiveModal(false)} className="text-gray-400 hover:text-red-500"><FiX size={20} /></button>
            </div>
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 text-center space-y-1">
              <p className="text-xs text-amber-800 font-bold">إجمالي دين العميل القائم:</p>
              <p className="font-black text-red-600 text-xl">{formatCurrency(selectedCustomer.total_debt)} ج.س</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">ملاحظة: سيتم احتساب قيمة الإعفاء كمصروف إعفاء ديون (DEBT_WAIVER) وسيخصم مباشرة من حساب العميل.</p>
            </div>
            <form onSubmit={handleWaiveDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">مبلغ الإعفاء (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={waiveAmount}
                  onChange={(e) => setWaiveAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="مبلغ الإعفاء"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-700 text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">سبب الإعفاء (اختياري)</label>
                <input
                  type="text"
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  placeholder="مثال: خصم إضافي أو مساعدة"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-700 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWaiveModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !waiveAmount}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ تأكيد الإعفاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* F. Add New Supplier Modal (تسجيل مورد جديد مع دين) */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-10 px-4 justify-center overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-lg">تسجيل مورد جديد مع دين</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-gray-400 hover:text-red-500"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">اسم المورد / الشركة التجارية</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="مثال: شركة الروابي للمواد الغذائية"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">قيمة الدين الأولي (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={supplierDebtAmount}
                  onChange={(e) => setSupplierDebtAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="قيمة المديونية الأولى"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">نوع الدين</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSupplierDebtType('cash')}
                    className={`p-2.5 border rounded-xl text-xs font-bold transition-all text-center ${supplierDebtType === 'cash' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    كاش
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierDebtType('bank')}
                    className={`p-2.5 border rounded-xl text-xs font-bold transition-all text-center ${supplierDebtType === 'bank' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    بنكك
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierDebtType('goods')}
                    className={`p-2.5 border rounded-xl text-xs font-bold transition-all text-center ${supplierDebtType === 'goods' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    بضاعة آجلة
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">وصف / تفاصيل الفاتورة (اختياري)</label>
                <input
                  type="text"
                  value={supplierDebtDesc}
                  onChange={(e) => setSupplierDebtDesc(e.target.value)}
                  placeholder="مثال: بضاعة البسكويت والشوكولاتة"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !supplierName || !supplierDebtAmount}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* G. Add Supplier Debt Modal (تسجيل دين لمورد موجود) */}
      {showAddSupplierDebtModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-10 px-4 justify-center overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-lg">تسجيل دين إضافي لمورد موجود</h3>
              <button onClick={() => setShowAddSupplierDebtModal(false)} className="text-gray-400 hover:text-red-500"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleAddSupplierDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">اختر المورد</label>
                <select
                  value={selectedSupplierName}
                  onChange={(e) => setSelectedSupplierName(e.target.value)}
                  className="w-full px-3 py-3 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                  required
                >
                  <option value="">اختر مورد من القائمة...</option>
                  {uniqueSuppliers.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">قيمة الدين الجديد (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={supplierDebtAmount}
                  onChange={(e) => setSupplierDebtAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="المبلغ"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">نوع الدين</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSupplierDebtType('cash')}
                    className={`p-2.5 border rounded-xl text-xs font-bold transition-all text-center ${supplierDebtType === 'cash' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    كاش
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierDebtType('bank')}
                    className={`p-2.5 border rounded-xl text-xs font-bold transition-all text-center ${supplierDebtType === 'bank' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    بنكك
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierDebtType('goods')}
                    className={`p-2.5 border rounded-xl text-xs font-bold transition-all text-center ${supplierDebtType === 'goods' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    بضاعة
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">وصف أو رقم الفاتورة (اختياري)</label>
                <input
                  type="text"
                  value={supplierDebtDesc}
                  onChange={(e) => setSupplierDebtDesc(e.target.value)}
                  placeholder="تفاصيل حول الدين الجديد"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierDebtModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedSupplierName || !supplierDebtAmount}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ الدين'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* H. Pay Supplier Debt Modal (تسجيل سداد لمورد) */}
      {showPaySupplierModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-10 px-4 justify-center overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-lg">سداد دين للمورد (مصروف دورة)</h3>
              <button onClick={() => setShowPaySupplierModal(false)} className="text-gray-400 hover:text-red-500"><FiX size={20} /></button>
            </div>
            <form onSubmit={handlePaySupplierDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">اختر المورد</label>
                <select
                  value={selectedSupplierName}
                  onChange={(e) => {
                    setSelectedSupplierName(e.target.value);
                  }}
                  className="w-full px-3 py-3 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold"
                  required
                >
                  <option value="">اختر المورد...</option>
                  {uniqueSuppliers.filter(s => s.total_remaining > 0).map(s => (
                    <option key={s.name} value={s.name}>{s.name} (الدين القائم: {formatCurrency(s.total_remaining)} ج.س)</option>
                  ))}
                </select>
              </div>

              {selectedSupplierName && activeSupplierDebts.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">اختر الفاتورة/الدين المراد سداده</label>
                  <select
                    value={selectedSupplierDebtId}
                    onChange={(e) => {
                      setSelectedSupplierDebtId(e.target.value);
                      // Auto-populate the remaining amount
                      const debt = activeSupplierDebts.find(d => d.id === e.target.value);
                      if (debt) {
                        setSupplierPayAmount(debt.remaining.toString());
                      }
                    }}
                    className="w-full px-3 py-3 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-xs font-medium"
                    required
                  >
                    {activeSupplierDebts.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.description || 'بلا وصف'} ({
                          d.debt_type === 'cash' ? 'كاش' : d.debt_type === 'bank' ? 'بنكك' : 'بضاعة'
                        }) - المتبقي: {formatCurrency(d.remaining)} ج.س
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">طريقة الدفع</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSupplierPayMethod('cash')}
                    className={`flex-1 p-2.5 border rounded-xl text-xs font-bold transition-all text-center ${supplierPayMethod === 'cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    كاش
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierPayMethod('bank')}
                    className={`flex-1 p-2.5 border rounded-xl text-xs font-bold transition-all text-center ${supplierPayMethod === 'bank' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    تحويل بنكك
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">المبلغ المسدد (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={supplierPayAmount}
                  onChange={(e) => setSupplierPayAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="المبلغ"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">ملاحظة السداد (اختياري)</label>
                <input
                  type="text"
                  value={supplierPayDesc}
                  onChange={(e) => setSupplierPayDesc(e.target.value)}
                  placeholder="ملاحظات حول عملية الدفع"
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaySupplierModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedSupplierDebtId || !supplierPayAmount}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ السداد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}