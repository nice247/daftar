import { useState, useEffect, useMemo } from 'react';
import { customerAPI, merchantDebtAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { FiUserPlus, FiSearch, FiX, FiEdit2, FiTrash2, FiGift, FiPlus, FiCreditCard, FiTruck, FiCornerDownLeft, FiChevronLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function CustomersPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' or 'suppliers'
  
  // Data State
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierDebts, setSupplierDebts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Customer Modals & Form State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [showAddCustomerDebtModal, setShowAddCustomerDebtModal] = useState(false);
  const [showPayCustomerDebtModal, setShowPayCustomerDebtModal] = useState(false);
  const [showWaiveCustomerDebtModal, setShowWaiveCustomerDebtModal] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerDebtAmount, setCustomerDebtAmount] = useState('');
  const [customerDebtType, setCustomerDebtType] = useState('DEBT');
  const [customerDebtDesc, setCustomerDebtDesc] = useState('');
  const [customerPayAmount, setCustomerPayAmount] = useState('');
  const [customerWaiveAmount, setCustomerWaiveAmount] = useState('');
  const [customerWaiveReason, setCustomerWaiveReason] = useState('');

  // Supplier Modals & Form State
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [showAddSupplierDebtModal, setShowAddSupplierDebtModal] = useState(false);
  const [showPaySupplierDebtModal, setShowPaySupplierDebtModal] = useState(false);
  
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierDebtAmount, setSupplierDebtAmount] = useState('');
  const [supplierDebtType, setSupplierDebtType] = useState('goods'); // 'goods', 'cash', 'bank'
  const [supplierDebtDesc, setSupplierDebtDesc] = useState('');
  const [selectedDebtId, setSelectedDebtId] = useState('');
  const [supplierPayAmount, setSupplierPayAmount] = useState('');
  const [supplierPayMethod, setSupplierPayMethod] = useState('cash'); // 'cash', 'bank'
  const [supplierPayDesc, setSupplierPayDesc] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'customers') {
        const response = await customerAPI.list();
        setCustomers(response.data);
      } else {
        const [supRes, debtRes] = await Promise.all([
          merchantDebtAPI.listSuppliers(),
          merchantDebtAPI.list()
        ]);
        setSuppliers(supRes.data);
        setSupplierDebts(debtRes.data);
      }
    } catch (error) {
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // ============ Customer Logic ============

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await customerAPI.create({ name: customerName, phone: customerPhone });
      toast.success('تم إضافة العميل بنجاح');
      setShowAddCustomerModal(false);
      setCustomerName('');
      setCustomerPhone('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في إضافة العميل');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditCustomerModal = (customer) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setShowEditCustomerModal(true);
  };

  const handleEditCustomer = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await customerAPI.update(selectedCustomer.id, { name: customerName, phone: customerPhone });
      toast.success('تم تعديل العميل بنجاح');
      setShowEditCustomerModal(false);
      fetchData();
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
      fetchData();
    } catch(error) {
      toast.error(error.response?.data?.detail || 'فشل في الحذف');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCustomerDebt = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await customerAPI.addDebt({
        customer_id: selectedCustomer.id,
        amount: parseFloat(customerDebtAmount),
        debt_type: customerDebtType,
        description: customerDebtDesc || null,
      });
      toast.success('تم تسجيل الدين بنجاح');
      setShowAddCustomerDebtModal(false);
      setCustomerDebtAmount('');
      setCustomerDebtDesc('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل الدين');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayCustomerDebt = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await customerAPI.payDebt({
        customer_id: selectedCustomer.id,
        amount: parseFloat(customerPayAmount),
      });
      toast.success('تم تسجيل السداد بنجاح');
      setShowPayCustomerDebtModal(false);
      setCustomerPayAmount('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل السداد');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWaiveCustomerDebt = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await customerAPI.waiveDebt({
        customer_id: selectedCustomer.id,
        amount: parseFloat(customerWaiveAmount),
        reason: customerWaiveReason || null,
      });
      toast.success('تم تسجيل الإعفاء بنجاح');
      setShowWaiveCustomerDebtModal(false);
      setCustomerWaiveAmount('');
      setCustomerWaiveReason('');
      fetchData();
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
    const shopName = user?.store_name || 'المتجر';
    const message = `السلام عليكم ${customer.name}، نود تذكيرك بالمديونية المستحقة لمحل ${shopName}، بقيمة: ${formatCurrency(customer.total_debt)} ج.س. نسعد بتعاملك معنا.`;
    
    let phone = customer.phone.replace(/[\s+]/g, '');
    if (phone.startsWith('0')) {
       phone = '249' + phone.substring(1);
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // ============ Supplier Logic ============

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await merchantDebtAPI.createSupplier({ name: supplierName, phone: supplierPhone || null });
      toast.success('تم إضافة المورد بنجاح');
      setShowAddSupplierModal(false);
      setSupplierName('');
      setSupplierPhone('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في إضافة المورد');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditSupplierModal = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierName(supplier.name);
    setSupplierPhone(supplier.phone || '');
    setShowEditSupplierModal(true);
  };

  const handleEditSupplier = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await merchantDebtAPI.updateSupplier(selectedSupplier.id, { name: supplierName, phone: supplierPhone });
      toast.success('تم تعديل بيانات المورد بنجاح');
      setShowEditSupplierModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في التعديل');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    if (supplier.total_debt > 0) {
      toast.error('لا يمكن حذف مورد لديه ديون قائمة');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف المورد ${supplier.name}؟`)) return;
    
    setActionLoading(true);
    try {
      await merchantDebtAPI.deleteSupplier(supplier.id);
      toast.success('تم حذف المورد بنجاح');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'لا يمكن الحذف لارتباطه بعمليات مسبقة');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddSupplierDebt = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await merchantDebtAPI.create({
        supplier_id: selectedSupplier.id,
        debt_type: supplierDebtType,
        total_amount: parseFloat(supplierDebtAmount),
        description: supplierDebtDesc || null,
      });
      toast.success('تم تسجيل الدين بنجاح');
      setShowAddSupplierDebtModal(false);
      setSupplierDebtAmount('');
      setSupplierDebtDesc('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل الدين');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaySupplierDebt = async (e) => {
    e.preventDefault();
    if (!selectedDebtId) {
      toast.error('الرجاء اختيار الفاتورة/الدين المراد سداده');
      return;
    }
    setActionLoading(true);
    try {
      await merchantDebtAPI.pay({
        merchant_debt_id: selectedDebtId,
        amount: parseFloat(supplierPayAmount),
        payment_method: supplierPayMethod,
        description: supplierPayDesc || null
      });
      toast.success('تم تسجيل السداد بنجاح وخصمه كمصروف');
      setShowPaySupplierDebtModal(false);
      setSupplierPayAmount('');
      setSupplierPayDesc('');
      setSelectedDebtId('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في تسجيل السداد');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered lists
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.phone && c.phone.includes(searchQuery))
    );
  }, [customers, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers;
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.phone && s.phone.includes(searchQuery))
    );
  }, [suppliers, searchQuery]);

  const selectedSupplierOutstandingDebts = useMemo(() => {
    if (!selectedSupplier) return [];
    return supplierDebts.filter(d => d.supplier_id === selectedSupplier.id && d.status !== 'paid');
  }, [selectedSupplier, supplierDebts]);

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-800">الحسابات والديون</h2>
        {activeTab === 'customers' ? (
          <button
            onClick={() => {
              setCustomerName('');
              setCustomerPhone('');
              setShowAddCustomerModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition-all"
          >
            <FiUserPlus size={16} />
            إضافة عميل
          </button>
        ) : (
          <button
            onClick={() => {
              setSupplierName('');
              setSupplierPhone('');
              setShowAddSupplierModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-all"
          >
            <FiTruck size={16} />
            إضافة مورد
          </button>
        )}
      </div>

      {/* Tabs SWITCHER */}
      <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
        <button
          onClick={() => { setActiveTab('customers'); setSearchQuery(''); }}
          className={`flex-1 py-3 text-center text-sm font-bold rounded-lg transition-all ${
            activeTab === 'customers' 
              ? 'bg-white text-emerald-700 shadow-sm' 
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          العملاء ({customers.length})
        </button>
        <button
          onClick={() => { setActiveTab('suppliers'); setSearchQuery(''); }}
          className={`flex-1 py-3 text-center text-sm font-bold rounded-lg transition-all ${
            activeTab === 'suppliers' 
              ? 'bg-white text-blue-700 shadow-sm' 
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          ديون الموردين ({suppliers.length})
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
          <FiSearch className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={activeTab === 'customers' ? "بحث عن عميل بالاسم أو الهاتف..." : "بحث عن مورد بالاسم..."}
          className={`block w-full pl-3 pr-11 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 text-sm ${
            activeTab === 'customers' ? 'focus:ring-emerald-500 focus:border-emerald-500' : 'focus:ring-blue-500 focus:border-blue-500'
          }`}
        />
      </div>

      {/* CUSTOMERS TAB VIEW */}
      {activeTab === 'customers' && (
        <>
          {loading ? (
            <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
              <FiUserPlus size={48} className="mx-auto text-emerald-300 mb-3" />
              <p className="text-gray-600 font-bold text-lg">لا يوجد عملاء بعد</p>
              <p className="text-sm text-gray-400 mt-1">اضغط على "إضافة عميل" للبدء في التسجيل</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">لا توجد نتائج مطابقة للبحث</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="bg-white rounded-2xl p-4 card-shadow border border-gray-50 hover:border-emerald-100 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-gray-800 text-lg">{customer.name}</h4>
                        <button onClick={() => openEditCustomerModal(customer)} className="text-gray-400 hover:text-emerald-600 p-1 transition-colors" title="تعديل"><FiEdit2 size={15} /></button>
                        {customer.total_debt === 0 && (
                          <button onClick={() => handleDeleteCustomer(customer)} className="text-gray-400 hover:text-red-600 p-1 transition-colors" title="حذف"><FiTrash2 size={15} /></button>
                        )}
                      </div>
                      {customer.phone && <p className="text-xs text-gray-500 mt-0.5" dir="ltr">{customer.phone}</p>}
                    </div>
                    <div className="text-left bg-emerald-50/50 px-3 py-2 rounded-xl border border-emerald-50">
                      <p className="text-[10px] font-bold text-gray-500">الدين القائم</p>
                      <p className={`font-extrabold text-lg ${customer.total_debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(customer.total_debt)} ج.س
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectedCustomer(customer); setCustomerDebtAmount(''); setCustomerDebtDesc(''); setCustomerDebtType('DEBT'); setShowAddCustomerDebtModal(true); }}
                        className="flex-1 py-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-extrabold hover:bg-red-100 transition-all border border-red-100/50"
                      >
                        + دين للعميل
                      </button>
                      <button
                        onClick={() => { setSelectedCustomer(customer); setCustomerPayAmount(''); setShowPayCustomerDebtModal(true); }}
                        className="flex-1 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-extrabold hover:bg-emerald-100 transition-all border border-emerald-100/50"
                      >
                        سداد
                      </button>
                      <button
                        onClick={() => { setSelectedCustomer(customer); setCustomerWaiveAmount(''); setCustomerWaiveReason(''); setShowWaiveCustomerDebtModal(true); }}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-extrabold hover:bg-gray-200 transition-all border border-gray-200/50 flex items-center justify-center gap-1"
                      >
                        <FiGift size={13} /> إعفاء
                      </button>
                    </div>
                    {customer.total_debt > 0 && (
                      <button
                        onClick={() => handleWhatsAppReminder(customer)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#128C7E] transition-all shadow-sm"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.126.554 4.195 1.602 6.014L.132 24l6.115-1.602c1.761.986 3.757 1.507 5.784 1.507 6.646 0 12.031-5.385 12.031-12.031C24 5.385 18.677 0 12.031 0zm0 21.91c-1.8 0-3.565-.483-5.118-1.402l-.367-.218-3.804.997 1.018-3.71-.24-.383C2.535 15.655 2.019 13.864 2.019 12.031c0-5.526 4.496-10.022 10.012-10.022 5.526 0 10.022 4.496 10.022 10.022 0 5.526-4.496 10.022-10.022 10.022zm5.498-7.508c-.302-.15-1.789-.882-2.066-.983-.277-.101-.48-.15-.682.15-.202.302-.782.983-.959 1.184-.177.202-.354.227-.656.076-1.428-.713-2.583-1.849-3.235-3.238-.151-.302.076-.465.226-.615.136-.136.302-.354.453-.531.151-.177.202-.302.302-.505.101-.202.05-.38-.025-.531-.076-.15-1.789-4.318-2.45-5.918-.636-1.537-1.282-1.328-1.765-1.353-.453-.024-.959-.024-1.465-.024-.505 0-1.314.19-2 .935C1.868 4.295.959 5.861.959 8.21c0 2.348 1.969 4.621 2.246 4.992.277.371 3.407 5.201 8.254 7.29 1.153.497 2.05.795 2.75 1.018 1.158.368 2.21.316 3.038.192 1.008-.15 3.104-1.267 3.543-2.492.439-1.225.439-2.273.308-2.492-.126-.219-.48-.344-.782-.494z"/>
                        </svg>
                        إرسال تذكير بالدين
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* SUPPLIERS TAB VIEW */}
      {activeTab === 'suppliers' && (
        <>
          {loading ? (
            <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
              <FiTruck size={48} className="mx-auto text-blue-300 mb-3" />
              <p className="text-gray-600 font-bold text-lg">لا يوجد موردين بعد</p>
              <p className="text-sm text-gray-400 mt-1">اضغط على "إضافة مورد" للبدء في إضافتهم</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">لا توجد نتائج مطابقة للبحث</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSuppliers.map((supplier) => (
                <div key={supplier.id} className="bg-white rounded-2xl p-4 card-shadow border border-gray-50 hover:border-blue-100 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-gray-800 text-lg">{supplier.name}</h4>
                        <button onClick={() => openEditSupplierModal(supplier)} className="text-gray-400 hover:text-blue-600 p-1 transition-colors" title="تعديل"><FiEdit2 size={15} /></button>
                        {supplier.total_debt === 0 && (
                          <button onClick={() => handleDeleteSupplier(supplier)} className="text-gray-400 hover:text-red-600 p-1 transition-colors" title="حذف"><FiTrash2 size={15} /></button>
                        )}
                      </div>
                      {supplier.phone && <p className="text-xs text-gray-500 mt-0.5" dir="ltr">{supplier.phone}</p>}
                    </div>
                    <div className="text-left bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-50">
                      <p className="text-[10px] font-bold text-gray-500">مستحقات المورد</p>
                      <p className={`font-extrabold text-lg ${supplier.total_debt > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {formatCurrency(supplier.total_debt)} ج.س
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedSupplier(supplier); setSupplierDebtAmount(''); setSupplierDebtDesc(''); setSupplierDebtType('goods'); setShowAddSupplierDebtModal(true); }}
                      className="flex-1 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-extrabold hover:bg-blue-100 transition-all border border-blue-100/50"
                    >
                      + مديونية جديدة
                    </button>
                    {supplier.total_debt > 0 && (
                      <button
                        onClick={() => { 
                          setSelectedSupplier(supplier); 
                          setSupplierPayAmount(''); 
                          setSupplierPayDesc('');
                          // Set default selected debt as first outstanding debt
                          const outstanding = supplierDebts.filter(d => d.supplier_id === supplier.id && d.status !== 'paid');
                          setSelectedDebtId(outstanding[0]?.id || '');
                          setShowPaySupplierDebtModal(true); 
                        }}
                        className="flex-1 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-extrabold hover:bg-emerald-100 transition-all border border-emerald-100/50"
                      >
                        سداد للمورد
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ==================================== MODAL DIALOGS ==================================== */}

      {/* 1. Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-12 md:pt-24 justify-center px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-gray-800 text-lg">إضافة عميل جديد</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم العميل</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم الهاتف (واتساب)</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="مثال: 0902642768"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  dir="ltr"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !customerName || !customerPhone}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all text-sm"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Customer Modal */}
      {showEditCustomerModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-12 md:pt-24 justify-center px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-gray-800 text-lg">تعديل بيانات العميل</h3>
              <button onClick={() => setShowEditCustomerModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleEditCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم العميل</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم العميل"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="رقم الهاتف"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  dir="ltr"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditCustomerModal(false)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !customerName || !customerPhone}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all text-sm"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Customer Debt Modal */}
      {showAddCustomerDebtModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-12 md:pt-24 justify-center px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-gray-800 text-lg">تسجيل دين على: {selectedCustomer.name}</h3>
              <button onClick={() => setShowAddCustomerDebtModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCustomerDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">نوع المديونية</label>
                <div className="flex gap-2">
                  <label className={`flex-1 p-3 border rounded-xl cursor-pointer text-center text-xs font-bold ${customerDebtType === 'DEBT' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" name="debtType" value="DEBT" checked={customerDebtType === 'DEBT'} onChange={() => setCustomerDebtType('DEBT')} className="hidden" />
                    دين نقدي (كاش)
                  </label>
                  <label className={`flex-1 p-3 border rounded-xl cursor-pointer text-center text-xs font-bold ${customerDebtType === 'CASH' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" name="debtType" value="CASH" checked={customerDebtType === 'CASH'} onChange={() => setCustomerDebtType('CASH')} className="hidden" />
                    دين تحويل (بنكك)
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المبلغ المطلوب</label>
                <input
                  type="number"
                  value={customerDebtAmount}
                  onChange={(e) => setCustomerDebtAmount(e.target.value)}
                  placeholder="ادخل مبلغ الدين"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-left text-lg font-mono font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">ملاحظة / وصف</label>
                <input
                  type="text"
                  value={customerDebtDesc}
                  onChange={(e) => setCustomerDebtDesc(e.target.value)}
                  placeholder="وصف الدين (اختياري)"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerDebtModal(false)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !customerDebtAmount}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition-all text-sm"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ الدين'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Pay Customer Debt Modal */}
      {showPayCustomerDebtModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-12 md:pt-24 justify-center px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-gray-800 text-lg">تسجيل سداد من: {selectedCustomer.name}</h3>
              <button onClick={() => setShowPayCustomerDebtModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4 text-center">
              <p className="text-xs font-bold text-emerald-800 mb-1">إجمالي الدين المستحق</p>
              <p className="font-black text-red-600 text-2xl">{formatCurrency(selectedCustomer.total_debt)} ج.س</p>
            </div>
            <form onSubmit={handlePayCustomerDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المبلغ المسدد</label>
                <input
                  type="number"
                  value={customerPayAmount}
                  onChange={(e) => setCustomerPayAmount(e.target.value)}
                  placeholder="مثال: 5000"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-left text-lg font-mono font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPayCustomerDebtModal(false)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !customerPayAmount}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all text-sm"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ السداد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Waive Customer Debt Modal */}
      {showWaiveCustomerDebtModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-12 md:pt-24 justify-center px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-gray-800 text-lg">إعفاء دين للعميل: {selectedCustomer.name}</h3>
              <button onClick={() => setShowWaiveCustomerDebtModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 text-center">
              <p className="text-xs font-bold text-gray-500 mb-1">إجمالي الدين المستحق</p>
              <p className="font-black text-red-600 text-2xl">{formatCurrency(selectedCustomer.total_debt)} ج.س</p>
            </div>
            <p className="text-xs text-gray-500 bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-center leading-relaxed">
              تنبيه: مبلغ الإعفاء سيتم تسجيله كمصروف (إعفاء دين) في التقارير، وسيتم تخفيض مديونية العميل فوراً.
            </p>
            <form onSubmit={handleWaiveCustomerDebt} className="space-y-4 mt-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">مبلغ الإعفاء</label>
                <input
                  type="number"
                  value={customerWaiveAmount}
                  onChange={(e) => setCustomerWaiveAmount(e.target.value)}
                  placeholder="المبلغ المراد إعفاؤه"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-500 text-left text-lg font-mono font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">سبب الإعفاء</label>
                <input
                  type="text"
                  value={customerWaiveReason}
                  onChange={(e) => setCustomerWaiveReason(e.target.value)}
                  placeholder="مثال: خصم إضافي، ظروف خاصة"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowWaiveCustomerDebtModal(false)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !customerWaiveAmount}
                  className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 disabled:opacity-50 transition-all text-sm"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ تأكيد الإعفاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-12 md:pt-24 justify-center px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-gray-800 text-lg">إضافة مورد جديد</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم المورد / الشركة</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="مثال: شركة النيل للزيوت، مورد السكر"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم الهاتف (اختياري)</label>
                <input
                  type="tel"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="مثال: 09XXXXXXXX"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !supplierName}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all text-sm"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Edit Supplier Modal */}
      {showEditSupplierModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-12 md:pt-24 justify-center px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-gray-800 text-lg">تعديل بيانات المورد</h3>
              <button onClick={() => setShowEditSupplierModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم المورد</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="اسم المورد"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="رقم الهاتف"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditSupplierModal(false)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !supplierName}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all text-sm"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Add Supplier Debt Modal */}
      {showAddSupplierDebtModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-12 md:pt-24 justify-center px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-gray-800 text-lg">تسجيل مديونية للمورد: {selectedSupplier.name}</h3>
              <button onClick={() => setShowAddSupplierDebtModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSupplierDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">نوع الدين المستلم</label>
                <div className="flex gap-2">
                  <label className={`flex-1 p-2.5 border rounded-xl cursor-pointer text-center text-xs font-bold ${supplierDebtType === 'goods' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" name="supDebtType" value="goods" checked={supplierDebtType === 'goods'} onChange={() => setSupplierDebtType('goods')} className="hidden" />
                    بضاعة بالدين
                  </label>
                  <label className={`flex-1 p-2.5 border rounded-xl cursor-pointer text-center text-xs font-bold ${supplierDebtType === 'cash' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" name="supDebtType" value="cash" checked={supplierDebtType === 'cash'} onChange={() => setSupplierDebtType('cash')} className="hidden" />
                    دين كاش
                  </label>
                  <label className={`flex-1 p-2.5 border rounded-xl cursor-pointer text-center text-xs font-bold ${supplierDebtType === 'bank' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" name="supDebtType" value="bank" checked={supplierDebtType === 'bank'} onChange={() => setSupplierDebtType('bank')} className="hidden" />
                    دين بنكك
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">قيمة الدين المستلم</label>
                <input
                  type="number"
                  value={supplierDebtAmount}
                  onChange={(e) => setSupplierDebtAmount(e.target.value)}
                  placeholder="ادخل قيمة الدين"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left text-lg font-mono font-bold"
                  dir="ltr"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">وصف أو تفصيل</label>
                <input
                  type="text"
                  value={supplierDebtDesc}
                  onChange={(e) => setSupplierDebtDesc(e.target.value)}
                  placeholder="أصناف البضاعة أو سبب الدين (اختياري)"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierDebtModal(false)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !supplierDebtAmount}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all text-sm"
                >
                  {actionLoading ? 'جاري الحفظ...' : '✔ حفظ الدين'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Pay Supplier Debt Modal */}
      {showPaySupplierDebtModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start pt-12 md:pt-24 justify-center px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-gray-800 text-lg">سداد مديونية للمورد: {selectedSupplier.name}</h3>
              <button onClick={() => setShowPaySupplierDebtModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4 text-center">
              <p className="text-xs font-bold text-blue-800 mb-1">إجمالي المستحق للمورد</p>
              <p className="font-black text-blue-700 text-2xl">{formatCurrency(selectedSupplier.total_debt)} ج.س</p>
            </div>
            <form onSubmit={handlePaySupplierDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اختر الفاتورة أو المديونية المراد سدادها</label>
                <select
                  value={selectedDebtId}
                  onChange={(e) => setSelectedDebtId(e.target.value)}
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-sm"
                  required
                >
                  <option value="">-- اختر مديونية معينة --</option>
                  {selectedSupplierOutstandingDebts.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.description || 'بضاعة'} بتاريخ {new Date(d.created_at).toLocaleDateString('ar-SD')} (المتبقي: {formatCurrency(d.remaining)} ج.س)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">طريقة السداد</label>
                  <select
                    value={supplierPayMethod}
                    onChange={(e) => setSupplierPayMethod(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none bg-white font-bold text-xs"
                  >
                    <option value="cash">نقداً (كاش)</option>
                    <option value="bank">تحويل (بنكك)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">المبلغ المسدد</label>
                  <input
                    type="number"
                    value={supplierPayAmount}
                    onChange={(e) => setSupplierPayAmount(e.target.value)}
                    placeholder="المبلغ"
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-left text-sm font-mono font-bold"
                    dir="ltr"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">تفاصيل أو ملاحظات</label>
                <input
                  type="text"
                  value={supplierPayDesc}
                  onChange={(e) => setSupplierPayDesc(e.target.value)}
                  placeholder="وصف إضافي للسداد (اختياري)"
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPaySupplierDebtModal(false)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !supplierPayAmount || !selectedDebtId}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all text-sm"
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