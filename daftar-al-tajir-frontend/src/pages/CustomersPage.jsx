import { useState, useEffect, useMemo } from 'react';
import { customerAPI, merchantDebtAPI } from '../services/api';
import { formatCurrency, normalizeArabicNumber, phoneToWhatsApp } from '../utils/helpers';
import {
  FiUserPlus, FiSearch, FiX, FiEdit2, FiTrash2, FiGift, FiCheck,
  FiPlus, FiCreditCard, FiTruck, FiChevronDown, FiChevronUp, FiDollarSign, FiMoreVertical
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
  const [openMenuId, setOpenMenuId] = useState(null);

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
  const [supplierDebtType, setSupplierDebtType] = useState('goods');
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
        debt_type: 'DEBT',
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

    const phone = phoneToWhatsApp(customer.phone);

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
      <div className="bg-white rounded-[12px] p-2 card-shadow border border-[#DEE2E6] flex shadow-sm">
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex-1 py-3 text-center rounded-[12px] text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'customers'
              ? 'bg-[#2B8A3E] text-white shadow-md'
              : 'text-[#6C757D] hover:text-[#212529] hover:bg-[#F8F9FA]'
          }`}
        >
          <FiUserPlus size={18} />
          العملاء (ديون العملاء)
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex-1 py-3 text-center rounded-[12px] text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'suppliers'
              ? 'bg-[#1C7ED6] text-white shadow-md'
              : 'text-[#6C757D] hover:text-[#212529] hover:bg-[#F8F9FA]'
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
        <div className="bg-white rounded-[12px] p-5 card-shadow border border-[#DEE2E6] space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#DEE2E6] pb-4">
            <div>
              <h2 className="text-lg font-black text-[#212529] flex items-center gap-2">
                <FiTruck className="text-[#1C7ED6]" size={22} />
                الموردون (ديون التاجر للموردين)
              </h2>
              <p className="text-xs text-[#6C757D] mt-1">سجل التزاماتك المالية للموردين والجهات التجارية المختلفة</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSupplierName('');
                  setSupplierDebtAmount('');
                  setSupplierDebtDesc('');
                  setShowAddSupplierModal(true);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1C7ED6] hover:bg-[#1864AB] text-white rounded-[12px] text-xs font-bold transition-all shadow-sm"
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
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#1C7ED6] text-[#1C7ED6] hover:bg-[#F8F9FA] rounded-[12px] text-xs font-bold transition-all"
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
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#1C7ED6] text-[#1C7ED6] hover:bg-[#F8F9FA] rounded-[12px] text-xs font-bold transition-all"
              >
                <FiDollarSign size={14} />
                تسجيل سداد
              </button>
            </div>
          </div>

          {/* Supplier Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <FiSearch className="h-4 w-4 text-[#6C757D]" />
            </div>
            <input
              type="text"
              value={supplierSearchQuery}
              onChange={(e) => setSupplierSearchQuery(e.target.value)}
              placeholder="بحث عن مورد..."
              className="block w-full pl-3 pr-9 py-2.5 bg-white border border-[#DEE2E6] rounded-[12px] text-xs focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] outline-none"
            />
          </div>

          {/* Suppliers List */}
          {loading ? (
            <p className="text-center text-[#6C757D] py-4 text-sm">جاري التحميل...</p>
          ) : uniqueSuppliers.length === 0 ? (
            <div className="text-center py-6 bg-[#F8F9FA] rounded-[12px] border border-dashed border-[#DEE2E6]">
              <FiTruck size={36} className="mx-auto text-[#6C757D] mb-2" />
              <p className="text-[#212529] text-xs font-bold">لا يوجد موردون مسجلون حالياً</p>
              <p className="text-[10px] text-[#6C757D] mt-1">اضغط على "مورد جديد" لبدء التسجيل</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <p className="text-center text-[#6C757D] py-2 text-xs">لا توجد نتائج مطابقة للبحث</p>
          ) : (
            <div className="space-y-2">
              {filteredSuppliers.map((supplier) => {
                const isExpanded = !!expandedSuppliers[supplier.name];
                return (
                  <div key={supplier.name} className="border border-[#DEE2E6] rounded-[12px] overflow-hidden shadow-xs hover:border-[#DEE2E6] transition-all">
                    {/* Supplier Header Row */}
                    <div
                      onClick={() => toggleSupplierExpand(supplier.name)}
                      className="flex items-center justify-between p-4 bg-[#F8F9FA] hover:bg-[#F1F3F5] cursor-pointer transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg border border-[#DEE2E6] bg-white flex items-center justify-center text-[#1C7ED6] font-bold">
                          {supplier.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-[#212529] text-sm">{supplier.name}</h4>
                          <p className="text-[10px] text-[#6C757D] mt-0.5">{supplier.debts.length} فواتير/ديون مسجلة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="text-[10px] text-[#6C757D]">الدين القائم للمورد</p>
                          <p className={`font-black text-sm ${supplier.total_remaining > 0 ? 'text-red-600' : 'text-[#2B8A3E]'}`}>
                            {formatCurrency(supplier.total_remaining)} ج.س
                          </p>
                        </div>
                        <span className="text-[#6C757D]">
                          {isExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                        </span>
                      </div>
                    </div>

                    {/* Supplier Debt Records Detail */}
                    {isExpanded && (
                      <div className="border-t border-[#DEE2E6] bg-white p-3 space-y-2">
                        <p className="text-[10px] font-bold text-[#6C757D] px-1 border-b border-[#DEE2E6] pb-1.5">تفاصيل الديون والفواتير:</p>
                        {supplier.debts.map((debt) => (
                          <div key={debt.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 rounded-[12px] bg-[#F8F9FA] hover:bg-[#F1F3F5] border border-[#DEE2E6] gap-2 transition-all">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  debt.debt_type === 'cash' ? 'text-[#2B8A3E] border-[#2B8A3E]/30' :
                                  debt.debt_type === 'bank' ? 'text-[#1C7ED6] border-[#1C7ED6]/30' : 'text-amber-600 border-amber-600/30'
                                } bg-transparent`}>
                                  {debt.debt_type === 'cash' ? 'دين كاش' : debt.debt_type === 'bank' ? 'دين بنكك' : 'دين بضاعة'}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                                  debt.status === 'paid' ? 'text-[#2B8A3E] border-[#2B8A3E]/30' :
                                  debt.status === 'partial' ? 'text-amber-600 border-amber-600/30' : 'text-red-600 border-red-600/30'
                                } bg-transparent`}>
                                  {debt.status === 'paid' ? 'مسدد بالكامل' : debt.status === 'partial' ? 'جزئي' : 'غير مسدد'}
                                </span>
                              </div>
                              <p className="text-xs text-[#212529] font-medium">{debt.description || 'بلا وصف تفصيلي'}</p>
                              <p className="text-[9px] text-[#6C757D]">التاريخ: {debt.created_at || 'غير متوفر'}</p>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#DEE2E6]">
                              <div className="text-left">
                                <p className="text-[9px] text-[#6C757D]">المبلغ: {formatCurrency(debt.total_amount)}</p>
                                <p className="text-[10px] font-bold text-[#212529]">المتبقي: {formatCurrency(debt.remaining)}</p>
                              </div>
                              {debt.status !== 'paid' && (
                                <button
                                  onClick={() => openPaySupplierModalDirectly(debt)}
                                  className="px-3 py-1.5 bg-[#1C7ED6] hover:bg-[#1864AB] text-white rounded-[12px] text-xs font-bold transition-all shadow-xs"
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
        <div className="bg-white rounded-[12px] p-5 card-shadow border border-[#DEE2E6] space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#DEE2E6] pb-4">
            <div>
              <h2 className="text-lg font-black text-[#212529] flex items-center gap-2">
                <FiUserPlus className="text-[#2B8A3E]" size={22} />
                العملاء (ديون العملاء للتاجر)
              </h2>
              <p className="text-xs text-[#6C757D] mt-1">سجل ديون عملائك الأوفياء وقم بإرسال تذكيرات لهم عبر الواتساب مباشرة</p>
            </div>
            <button
              onClick={() => {
                setNewName('');
                setNewPhone('');
                setShowAddModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] text-xs font-bold transition-all shadow-sm"
            >
              <FiUserPlus size={16} />
              إضافة عميل جديد
            </button>
          </div>

          {/* Customer Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <FiSearch className="h-4 w-4 text-[#6C757D]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو رقم الهاتف..."
              className="block w-full pl-3 pr-9 py-2.5 bg-white border border-[#DEE2E6] rounded-[12px] text-xs focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] outline-none"
            />
          </div>

          {/* Customer List */}
          {loading ? (
            <p className="text-center text-[#6C757D] py-4 text-sm">جاري التحميل...</p>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 bg-[#F8F9FA] rounded-[12px] border border-dashed border-[#DEE2E6]">
              <FiUserPlus size={36} className="mx-auto text-[#6C757D] mb-2" />
              <p className="text-[#212529] text-xs font-bold">لا يوجد عملاء بعد</p>
              <p className="text-[10px] text-[#6C757D] mt-1">اضغط على "إضافة عميل جديد" للبدء</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-center text-[#6C757D] py-2 text-xs">لا توجد نتائج مطابقة للبحث</p>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="bg-white rounded-[12px] p-4 border border-[#DEE2E6] hover:border-[#DEE2E6] card-shadow transition-all">
                  <div className="flex items-center justify-between mb-3 relative">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-[#212529] text-sm">{customer.name}</h4>
                        <div className="relative">
                          <button onClick={() => setOpenMenuId(openMenuId === customer.id ? null : customer.id)} className="p-1.5 rounded-lg hover:bg-[#F1F3F5] text-[#6C757D]">
                            <FiMoreVertical size={16} />
                          </button>
                          {openMenuId === customer.id && (
                            <div className="absolute right-0 top-8 bg-white rounded-[12px] border border-[#DEE2E6] shadow-lg z-10 py-1 min-w-[140px]">
                              <button onClick={() => { setOpenMenuId(null); openEditModal(customer); }} className="w-full text-right px-3 py-2 text-xs hover:bg-[#F1F3F5] flex items-center gap-2 text-[#212529]"><FiEdit2 size={13} /> تعديل</button>
                              <button onClick={() => { setOpenMenuId(null); setSelectedCustomer(customer); setWaiveAmount(''); setWaiveReason(''); setShowWaiveModal(true); }} className="w-full text-right px-3 py-2 text-xs hover:bg-[#F1F3F5] flex items-center gap-2 text-[#212529]"><FiGift size={13} /> إعفاء</button>
                              {parseFloat(customer.total_debt || 0) === 0 && (
                                <button onClick={() => { setOpenMenuId(null); handleDeleteCustomer(customer); }} className="w-full text-right px-3 py-2 text-xs text-red-600 hover:bg-[#F1F3F5] flex items-center gap-2"><FiTrash2 size={13} /> حذف</button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {customer.phone && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-[#6C757D]" dir="ltr">{customer.phone}</p>
                          {customer.total_debt > 0 && (
                            <button onClick={() => handleWhatsAppReminder(customer)}
                              className="w-7 h-7 rounded-full bg-[#25D366] hover:bg-[#128C7E] flex items-center justify-center transition-colors shadow-sm"
                              title="تذكير واتساب">
                              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.126.554 4.195 1.602 6.014L.132 24l6.115-1.602c1.761.986 3.757 1.507 5.784 1.507 6.646 0 12.031-5.385 12.031-12.031C24 5.385 18.677 0 12.031 0zm0 21.91c-1.8 0-3.565-.483-5.118-1.402l-.367-.218-3.804.997 1.018-3.71-.24-.383C2.535 15.655 2.019 13.864 2.019 12.031c0-5.526 4.496-10.022 10.012-10.022 5.526 0 10.022 4.496 10.022 10.022 0 5.526-4.496 10.022-10.022 10.022zm5.498-7.508c-.302-.15-1.789-.882-2.066-.983-.277-.101-.48-.15-.682.15-.202.302-.782.983-.959 1.184-.177.202-.354.227-.656.076-1.428-.713-2.583-1.849-3.235-3.238-.151-.302.076-.465.226-.615.136-.136.302-.354.453-.531.151-.177.202-.302.302-.505.101-.202.05-.38-.025-.531-.076-.15-1.789-4.318-2.45-5.918-.636-1.537-1.282-1.328-1.765-1.353-.453-.024-.959-.024-1.465-.024-.505 0-1.314.19-2 .935C1.868 4.295.959 5.861.959 8.21c0 2.348 1.969 4.621 2.246 4.992.277.371 3.407 5.201 8.254 7.29 1.153.497 2.05.795 2.75 1.018 1.158.368 2.21.316 3.038.192 1.008-.15 3.104-1.267 3.543-2.492.439-1.225.439-2.273.308-2.492-.126-.219-.48-.344-.782-.494z"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-left bg-[#F8F9FA] px-3 py-1.5 rounded-[12px] border border-[#DEE2E6]">
                      <p className="text-[9px] text-[#6C757D]">الدين القائم</p>
                      <p className={`font-black text-sm ${customer.total_debt > 0 ? 'text-red-600' : 'text-[#2B8A3E]'}`}>
                        {formatCurrency(customer.total_debt)} ج.س
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectedCustomer(customer); setPayAmount(''); setShowPayModal(true); }}
                        className="flex-1 py-2 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] text-xs font-bold transition-all shadow-sm"
                      >
                        سداد
                      </button>
                      <button
                        onClick={() => { setSelectedCustomer(customer); setDebtAmount(''); setDebtDesc(''); setShowDebtModal(true); }}
                        className="flex-1 py-2 bg-white border border-[#DEE2E6] hover:bg-[#F8F9FA] text-[#212529] rounded-[12px] text-xs font-bold transition-all"
                      >
                        + دين
                      </button>
                    </div>
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
          <div className="bg-white rounded-[12px] p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEE2E6] pb-3">
              <h3 className="font-bold text-[#212529] text-lg">إضافة عميل جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#6C757D] hover:text-[#212529]"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">اسم العميل</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: محمد أحمد علي"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">رقم الهاتف</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="مثال: 0912345678"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm"
                  dir="ltr"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#212529] rounded-[12px] text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newName || !newPhone}
                  className="flex-1 py-3 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
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
          <div className="bg-white rounded-[12px] p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEE2E6] pb-3">
              <h3 className="font-bold text-[#212529] text-lg">تعديل بيانات العميل</h3>
              <button onClick={() => setShowEditModal(false)} className="text-[#6C757D] hover:text-[#212529]"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleEditCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">اسم العميل</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="اسم العميل"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">رقم الهاتف</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="رقم الهاتف"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm"
                  dir="ltr"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#212529] rounded-[12px] text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newName || !newPhone}
                  className="flex-1 py-3 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
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
          <div className="bg-white rounded-[12px] p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEE2E6] pb-3">
              <h3 className="font-bold text-[#212529] text-lg">تسجيل دين للعميل: {selectedCustomer.name}</h3>
              <button onClick={() => setShowDebtModal(false)} className="text-[#6C757D] hover:text-[#212529]"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleAddDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">المبلغ (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="المبلغ بالأرقام"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">وصف أو ملاحظة (اختياري)</label>
                <input
                  type="text"
                  value={debtDesc}
                  onChange={(e) => setDebtDesc(e.target.value)}
                  placeholder="مثال: شراء مواد تموينية"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDebtModal(false)}
                  className="flex-1 py-3 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#212529] rounded-[12px] text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !debtAmount}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
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
          <div className="bg-white rounded-[12px] p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEE2E6] pb-3">
              <h3 className="font-bold text-[#212529] text-lg">سداد دين للعميل: {selectedCustomer.name}</h3>
              <button onClick={() => setShowPayModal(false)} className="text-[#6C757D] hover:text-[#212529]"><FiX size={20} /></button>
            </div>
            <div className="bg-[#F8F9FA] p-4 rounded-[12px] border border-[#DEE2E6] text-center">
              <p className="text-xs text-[#6C757D] mb-0.5">الدين القائم حالياً</p>
              <p className="font-black text-red-600 text-2xl">{formatCurrency(selectedCustomer.total_debt)} ج.س</p>
            </div>
            <form onSubmit={handlePayDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">المبلغ المسدد (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="المبلغ المسدد"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 py-3 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#212529] rounded-[12px] text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !payAmount}
                  className="flex-1 py-3 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
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
          <div className="bg-white rounded-[12px] p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEE2E6] pb-3">
              <h3 className="font-bold text-[#212529] text-lg">إعفاء دين للعميل: {selectedCustomer.name}</h3>
              <button onClick={() => setShowWaiveModal(false)} className="text-[#6C757D] hover:text-[#212529]"><FiX size={20} /></button>
            </div>
            <div className="bg-[#F8F9FA] p-4 rounded-[12px] border border-[#DEE2E6] text-center space-y-1">
              <p className="text-xs text-[#212529] font-bold">إجمالي دين العميل القائم:</p>
              <p className="font-black text-red-600 text-xl">{formatCurrency(selectedCustomer.total_debt)} ج.س</p>
              <p className="text-[10px] text-[#6C757D] leading-relaxed">ملاحظة: سيتم احتساب قيمة الإعفاء كمصروف إعفاء ديون (DEBT_WAIVER) وسيخصم مباشرة من حساب العميل.</p>
            </div>
            <form onSubmit={handleWaiveDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">مبلغ الإعفاء (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={waiveAmount}
                  onChange={(e) => setWaiveAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="مبلغ الإعفاء"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">سبب الإعفاء (اختياري)</label>
                <input
                  type="text"
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  placeholder="مثال: خصم إضافي أو مساعدة"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#2B8A3E] focus:border-[#2B8A3E] text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWaiveModal(false)}
                  className="flex-1 py-3 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#212529] rounded-[12px] text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !waiveAmount}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
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
          <div className="bg-white rounded-[12px] p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEE2E6] pb-3">
              <h3 className="font-bold text-[#212529] text-lg">تسجيل مورد جديد مع دين</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-[#6C757D] hover:text-[#212529]"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">اسم المورد / الشركة التجارية</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="مثال: شركة الروابي للمواد الغذائية"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">قيمة الدين الأولي (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={supplierDebtAmount}
                  onChange={(e) => setSupplierDebtAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="قيمة المديونية الأولى"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">وصف / تفاصيل الفاتورة (اختياري)</label>
                <input
                  type="text"
                  value={supplierDebtDesc}
                  onChange={(e) => setSupplierDebtDesc(e.target.value)}
                  placeholder="مثال: بضاعة البسكويت والشوكولاتة"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="flex-1 py-3 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#212529] rounded-[12px] text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !supplierName || !supplierDebtAmount}
                  className="flex-1 py-3 bg-[#1C7ED6] hover:bg-[#1864AB] text-white rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
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
          <div className="bg-white rounded-[12px] p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEE2E6] pb-3">
              <h3 className="font-bold text-[#212529] text-lg">تسجيل دين إضافي لمورد موجود</h3>
              <button onClick={() => setShowAddSupplierDebtModal(false)} className="text-[#6C757D] hover:text-[#212529]"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleAddSupplierDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">اختر المورد</label>
                <select
                  value={selectedSupplierName}
                  onChange={(e) => setSelectedSupplierName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-sm font-bold"
                  required
                >
                  <option value="">اختر مورد من القائمة...</option>
                  {uniqueSuppliers.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">قيمة الدين الجديد (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={supplierDebtAmount}
                  onChange={(e) => setSupplierDebtAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="المبلغ"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">وصف أو رقم الفاتورة (اختياري)</label>
                <input
                  type="text"
                  value={supplierDebtDesc}
                  onChange={(e) => setSupplierDebtDesc(e.target.value)}
                  placeholder="تفاصيل حول الدين الجديد"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierDebtModal(false)}
                  className="flex-1 py-3 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#212529] rounded-[12px] text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedSupplierName || !supplierDebtAmount}
                  className="flex-1 py-3 bg-[#1C7ED6] hover:bg-[#1864AB] text-white rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
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
          <div className="bg-white rounded-[12px] p-6 w-full max-w-lg animate-slide-up my-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEE2E6] pb-3">
              <h3 className="font-bold text-[#212529] text-lg">سداد دين للمورد (مصروف دورة)</h3>
              <button onClick={() => setShowPaySupplierModal(false)} className="text-[#6C757D] hover:text-[#212529]"><FiX size={20} /></button>
            </div>
            <form onSubmit={handlePaySupplierDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">اختر المورد</label>
                <select
                  value={selectedSupplierName}
                  onChange={(e) => {
                    setSelectedSupplierName(e.target.value);
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-sm font-bold"
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
                  <label className="text-xs font-bold text-[#6C757D]">اختر الفاتورة/الدين المراد سداده</label>
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
                    className="w-full px-3 py-2.5 bg-white border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-xs font-medium"
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
                <label className="text-xs font-bold text-[#6C757D]">طريقة الدفع</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSupplierPayMethod('cash')}
                    className={`flex-1 py-2.5 border rounded-[12px] text-xs font-bold transition-all text-center bg-white ${
                      supplierPayMethod === 'cash'
                        ? 'border-[#2B8A3E] text-[#2B8A3E]'
                        : 'border-[#DEE2E6] text-[#6C757D]'
                    }`}
                  >
                    كاش
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierPayMethod('bank')}
                    className={`flex-1 py-2.5 border rounded-[12px] text-xs font-bold transition-all text-center bg-white ${
                      supplierPayMethod === 'bank'
                        ? 'border-[#2B8A3E] text-[#2B8A3E]'
                        : 'border-[#DEE2E6] text-[#6C757D]'
                    }`}
                  >
                    تحويل بنكك
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">المبلغ المسدد (ج.س)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={supplierPayAmount}
                  onChange={(e) => setSupplierPayAmount(normalizeArabicNumber(e.target.value))}
                  placeholder="المبلغ"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-left text-lg font-bold"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6C757D]">ملاحظة السداد (اختياري)</label>
                <input
                  type="text"
                  value={supplierPayDesc}
                  onChange={(e) => setSupplierPayDesc(e.target.value)}
                  placeholder="ملاحظات حول عملية الدفع"
                  className="w-full px-3 py-2.5 border border-[#DEE2E6] rounded-[12px] outline-none focus:ring-2 focus:ring-[#1C7ED6] focus:border-[#1C7ED6] text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaySupplierModal(false)}
                  className="flex-1 py-3 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#212529] rounded-[12px] text-sm font-bold transition-colors"
                >
                  ✖ إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedSupplierDebtId || !supplierPayAmount}
                  className="flex-1 py-3 bg-[#1C7ED6] hover:bg-[#1864AB] text-white rounded-[12px] text-sm font-bold disabled:opacity-50 transition-colors"
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
