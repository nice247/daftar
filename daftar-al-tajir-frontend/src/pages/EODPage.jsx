import { useState, useEffect, useCallback } from 'react';
import { eodAPI, customerAPI, expenseAPI, merchantDebtAPI } from '../services/api';
import { formatCurrency, EXPENSE_CATEGORIES, normalizeArabicNumber } from '../utils/helpers';
import { FiShoppingCart, FiCreditCard, FiTrendingUp, FiPackage, FiDollarSign, FiSave, FiList, FiEye, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function EODPage() {
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [otherIncomes, setOtherIncomes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [lastRestock, setLastRestock] = useState(null);
  const [cycleStatus, setCycleStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [todaySaved, setTodaySaved] = useState(false);
  const [todayData, setTodayData] = useState(null);
  const [error, setError] = useState('');

  // View modals
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [showPurchasesModal, setShowPurchasesModal] = useState(false);
  const [showMerchantDebtsModal, setShowMerchantDebtsModal] = useState(false);
  const [showOtherIncomesModal, setShowOtherIncomesModal] = useState(false);
  const [viewExpenses, setViewExpenses] = useState([]);
  const [viewPurchases, setViewPurchases] = useState([]);
  const [viewMerchantDebts, setViewMerchantDebts] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [showYesterdayModal, setShowYesterdayModal] = useState(false);
  const [yesterdayData, setYesterdayData] = useState(null);
  const [viewIncomesData, setViewIncomesData] = useState(null);

  // Check if day changed (midnight reset)
  const checkDayReset = useCallback(() => {
    const savedDate = localStorage.getItem('eod_date');
    const offset = new Date().getTimezoneOffset();
    const localDate = new Date(new Date().getTime() - (offset * 60 * 1000));
    const today = localDate.toISOString().split('T')[0];
    if (savedDate && savedDate !== today) {
      localStorage.removeItem('eod_date');
      setIncomes([]);
      setExpenses([]);
      setTodaySaved(false);
    }
  }, []);

  useEffect(() => {
    checkDayReset();
    loadData();
    const interval = setInterval(checkDayReset, 60000);
    return () => clearInterval(interval);
  }, [checkDayReset]);

  const loadData = async () => {
    try {
      const [custRes, restockRes, cycleRes, todayRes, debtsRes] = await Promise.allSettled([
        customerAPI.list(),
        eodAPI.getLastRestock(),
        eodAPI.getCycleStatus(),
        eodAPI.getToday(),
        merchantDebtAPI.list(),
      ]);
      if (custRes.status === 'fulfilled') setCustomers(custRes.value.data);
      if (restockRes.status === 'fulfilled' && restockRes.value.data.date) setLastRestock(restockRes.value.data);
      if (cycleRes.status === 'fulfilled') setCycleStatus(cycleRes.value.data);
      if (todayRes.status === 'fulfilled') {
        const td = todayRes.value.data;
        if (td.has_data) setTodaySaved(true);
        setTodayData(td);
      }
      if (debtsRes.status === 'fulfilled') setViewMerchantDebts(debtsRes.value.data || []);
    } catch {}
  };

  const addIncome = () => setIncomes([...incomes, { category: 'EOD_CASH', amount: '', description: '' }]);
  const updateIncome = (i, field, value) => {
    const newIncomes = [...incomes];
    newIncomes[i][field] = field === 'amount' ? normalizeArabicNumber(value) : value;
    setIncomes(newIncomes);
  };
  const removeIncome = (i) => setIncomes(incomes.filter((_, idx) => idx !== i));

  const addExpense = () => setExpenses([...expenses, { category: 'RESTOCK', amount: '', description: '', merchant_debt_id: '' }]);
  const updateExpense = (i, field, value) => {
    const newExp = [...expenses];
    newExp[i][field] = field === 'amount' ? normalizeArabicNumber(value) : value;
    setExpenses(newExp);
  };
  const removeExpense = (i) => setExpenses(expenses.filter((_, idx) => idx !== i));



  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Separate Incomes into Cash, Bankak, and Other Incomes
      const validIncomes = incomes.filter(i => i.amount && parseFloat(i.amount) > 0);
      
      const totalCashSales = validIncomes
        .filter(i => i.category === 'EOD_CASH')
        .reduce((sum, i) => sum + parseFloat(i.amount), 0);
        
      const totalBankakSales = validIncomes
        .filter(i => i.category === 'EOD_BANKAK')
        .reduce((sum, i) => sum + parseFloat(i.amount), 0);
        
      const combinedOtherIncomes = validIncomes
        .filter(i => i.category !== 'EOD_CASH' && i.category !== 'EOD_BANKAK')
        .map(i => ({
          category: i.category,
          amount: parseFloat(i.amount),
          description: i.description || null,
        }));

      // Combine normal expenses
      const combinedExpenses = expenses.filter(e => e.amount && parseFloat(e.amount) > 0).map(e => ({
        category: e.category,
        amount: parseFloat(e.amount),
        description: e.description || null,
        merchant_debt_id: e.category === 'MERCHANT_DEBT_PAY' ? e.merchant_debt_id || null : null
      }));

      const offset = new Date().getTimezoneOffset();
      const localDate = new Date(new Date().getTime() - (offset * 60 * 1000));
      const localDateString = localDate.toISOString().split('T')[0];

      const eodData = {
        eod_date: localDateString,
        sales: {
          cash_sales: totalCashSales,
          bankak_sales: totalBankakSales,
        },
        expenses: combinedExpenses,
        debt_payments: [],
        other_incomes: combinedOtherIncomes,
      };

      await eodAPI.save(eodData);
      
      toast.success("تم الحفظ بنجاح");
      localStorage.setItem('eod_date', eodData.eod_date);
      setTodaySaved(true);

      // Clear all inputs after successful save
      setIncomes([]);
      setExpenses([]);
      
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'حدث خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
  };

  // View all expenses
  const handleViewExpenses = async () => {
    setViewLoading(true);
    setShowExpensesModal(true);
    try {
      const res = await expenseAPI.list({ limit: 100 });
      setViewExpenses(res.data.expenses || res.data || []);
    } catch { toast.error('فشل تحميل المصروفات'); }
    finally { setViewLoading(false); }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      await expenseAPI.delete(id);
      toast.success('تم حذف المصروف بنجاح');
      // Refresh the view
      setViewExpenses(viewExpenses.filter(e => e.id !== id));
      loadData(); // To update the cycle totals
    } catch {
      toast.error('فشل حذف المصروف');
    }
  };

  // View purchases (RESTOCK expenses)
  const handleViewPurchases = async () => {
    setViewLoading(true);
    setShowPurchasesModal(true);
    try {
      const res = await expenseAPI.list({ category: 'RESTOCK', limit: 100 });
      setViewPurchases(res.data.expenses || res.data || []);
    } catch { toast.error('فشل تحميل المشتريات'); }
    finally { setViewLoading(false); }
  };

  // View merchant debts
  const handleViewMerchantDebts = async () => {
    setViewLoading(true);
    setShowMerchantDebtsModal(true);
    try {
      const res = await merchantDebtAPI.list();
      setViewMerchantDebts(res.data || []);
    } catch { toast.error('فشل تحميل ديون التاجر'); }
    finally { setViewLoading(false); }
  };

  // View Other Incomes
  const handleViewOtherIncomes = async () => {
    setViewLoading(true);
    setShowOtherIncomesModal(true);
    try {
      const res = await eodAPI.getToday();
      setViewIncomesData(res.data);
    } catch { 
      toast.error('فشل تحميل الإيرادات الكلية لليوم'); 
    } finally { 
      setViewLoading(false); 
    }
  };

  // View Yesterday's Data
  const handleViewYesterday = async () => {
    setViewLoading(true);
    setShowYesterdayModal(true);
    try {
      const res = await eodAPI.getYesterday();
      setYesterdayData(res.data);
    } catch { toast.error('فشل تحميل بيانات أمس'); }
    finally { setViewLoading(false); }
  };

  return (
    <div className="space-y-4 pb-8 animate-fade-in">
      {/* Cycle Status Card */}
      {cycleStatus && (
        <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-xl p-4 text-[#212529] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">ملخص الدورة الحالية (فترة الشراء)</span>
            <span className="text-xs bg-[#E9ECEF] text-[#6C757D] px-2 py-0.5 rounded-full">
              {cycleStatus.status === 'ACTIVE'
                ? (cycleStatus.days_remaining !== null ? `متبقي ${cycleStatus.days_remaining} يوم` : 'نشطة')
                : 'غير نشطة'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mt-3">
            <div className="bg-white border border-[#DEE2E6] rounded-lg p-2">
              <p className="text-[10px] text-[#6C757D] mb-1">المبيعات الكلية</p>
              <p className="font-bold text-sm">{formatCurrency(cycleStatus.status === 'ACTIVE' ? cycleStatus.total_sales : 0)}</p>
            </div>
            <div className="bg-white border border-[#DEE2E6] rounded-lg p-2">
              <p className="text-[10px] text-[#6C757D] mb-1">المصروفات/مشتريات</p>
              <p className="font-bold text-sm">{formatCurrency(cycleStatus.status === 'ACTIVE' ? cycleStatus.total_expenses : 0)}</p>
            </div>
            <div className="bg-white border border-[#DEE2E6] rounded-lg p-2">
              <p className="text-[10px] font-bold mb-1 text-[#6C757D]">صافي الأرباح</p>
              <p className={`font-bold text-sm ${cycleStatus.status === 'ACTIVE' && cycleStatus.net_cashflow >= 0 ? 'text-[#2B8A3E]' : 'text-red-600'}`}>
                {formatCurrency(cycleStatus.status === 'ACTIVE' ? cycleStatus.net_cashflow : 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Today's Summary Card */}
      {todayData && (
        <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-xl p-4 text-[#212529] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">ملخص معاملات اليوم</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mt-3">
            <div className="bg-white border border-[#DEE2E6] rounded-lg p-2 flex flex-col justify-between">
              <div>
                <p className="text-[10px] text-[#6C757D] mb-1">إجمالي الإيرادات</p>
                <p className="font-bold text-sm">{formatCurrency((todayData.total_cash_sales || 0) + (todayData.total_bankak_sales || 0) + (todayData.total_other_income || 0) + (todayData.total_debt_payments || 0))}</p>
              </div>
              {parseFloat(todayData.total_debt_payments || 0) > 0 && (
                <p className="text-[8px] text-[#2B8A3E] mt-1 font-bold">شامل تحصيل ديون: {formatCurrency(todayData.total_debt_payments)}</p>
              )}
            </div>
            <div className="bg-white border border-[#DEE2E6] rounded-lg p-2 flex flex-col justify-center">
              <p className="text-[10px] text-[#6C757D] mb-1">المصروفات</p>
              <p className="font-bold text-sm">{formatCurrency(todayData.total_expenses || 0)}</p>
            </div>
            <div className="bg-white border border-[#DEE2E6] rounded-lg p-2 flex flex-col justify-center">
              <p className="text-[10px] font-bold mb-1 text-[#6C757D]">صافي الدخل</p>
              <p className={`font-bold text-sm ${todayData.net_cashflow >= 0 ? 'text-[#2B8A3E]' : 'text-red-600'}`}>
                {formatCurrency(todayData.net_cashflow || 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleViewExpenses} className="flex items-center gap-1 text-sm text-[#6C757D] font-bold bg-[#F8F9FA] border border-[#DEE2E6] px-3 py-1.5 rounded-lg hover:bg-white transition-colors">
          <FiEye size={14} />
          المصروفات
        </button>
        <button onClick={handleViewPurchases} className="flex items-center gap-1 text-sm text-[#6C757D] font-bold bg-[#F8F9FA] border border-[#DEE2E6] px-3 py-1.5 rounded-lg hover:bg-white transition-colors">
          <FiEye size={14} />
          المشتريات
        </button>
        <button onClick={handleViewMerchantDebts} className="flex items-center gap-1 text-sm text-[#6C757D] font-bold bg-[#F8F9FA] border border-[#DEE2E6] px-3 py-1.5 rounded-lg hover:bg-white transition-colors">
          <FiEye size={14} />
          ديون التاجر
        </button>
        <button onClick={handleViewOtherIncomes} className="flex items-center gap-1 text-sm text-[#6C757D] font-bold bg-[#F8F9FA] border border-[#DEE2E6] px-3 py-1.5 rounded-lg hover:bg-white transition-colors">
          <FiEye size={14} />
          الإيرادات
        </button>
        <button onClick={handleViewYesterday} className="flex items-center gap-1 text-sm text-[#6C757D] font-bold bg-[#F8F9FA] border border-[#DEE2E6] px-3 py-1.5 rounded-lg hover:bg-white transition-colors">
          <FiEye size={14} />
          معاملات أمس
        </button>
      </div>

      {/* Last Restock Card */}
      {lastRestock && (
        <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 bg-white rounded-lg border border-[#DEE2E6] flex items-center justify-center">
            <FiPackage className="text-[#6C757D]" size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#6C757D]">آخر عملية شراء (تجديد مخزون)</p>
            <p className="font-bold text-[#212529]">{formatCurrency(lastRestock.amount)} ج.س</p>
            <p className="text-[10px] text-[#6C757D]">بتاريخ: {lastRestock.date}</p>
          </div>
        </div>
      )}





      {/* Expenses Section */}
      <div className="bg-white rounded-2xl p-5 card-shadow border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F8F9FA] border border-[#DEE2E6] flex items-center justify-center">
              <FiCreditCard className="text-[#6C757D]" size={18} />
            </div>
            <h3 className="font-black text-[#212529] text-base">المصروفات والمشتريات</h3>
          </div>
          <button 
            onClick={addExpense} 
            className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold transition-all border border-red-100 flex items-center gap-1"
          >
            <span>+</span> إضافة مصروف
          </button>
        </div>
        <div className="space-y-3">
          {expenses.map((exp, i) => (
            <div key={i} className="bg-slate-50/50 hover:bg-slate-50 p-4 rounded-xl border border-slate-100 transition-all space-y-3 relative">
              {/* Header with Row Title and Delete button */}
              <div className="flex items-center justify-between border-b border-dashed border-gray-200 pb-2">
                <span className="text-xs font-bold text-gray-500 font-mono">مصروف #{i + 1}</span>
                <button 
                  onClick={() => removeExpense(i)} 
                  className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100/30 font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Stacked Inputs */}
              <div className="grid grid-cols-1 gap-2.5">
                {/* Category select */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400">فئة المصروف</label>
                  <select
                    value={exp.category}
                    onChange={(e) => updateExpense(i, 'category', e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DEE2E6] rounded-[12px] text-xs outline-none font-bold bg-white focus:border-[#6C757D] focus:ring-1 focus:ring-[#6C757D] cursor-pointer shadow-sm text-[#212529] h-9"
                  >
                    {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => {
                      // Hide RESTOCK if cycle is still active
                      if (key === 'RESTOCK' && cycleStatus?.status === 'ACTIVE') return null;
                      return <option key={key} value={key}>{label}</option>;
                    })}
                  </select>
                </div>

                {/* Amount input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400">المبلغ (ج.س)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={exp.amount}
                    onChange={(e) => updateExpense(i, 'amount', e.target.value)}
                    placeholder="المبلغ بالأرقام"
                    className="w-full px-3 py-2 border border-[#DEE2E6] rounded-[12px] text-sm outline-none text-left font-mono font-bold text-[#212529] focus:border-[#6C757D] focus:ring-1 focus:ring-[#6C757D] h-9"
                    dir="ltr"
                  />
                </div>

                {/* Description or Merchant debt select */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400">
                    {exp.category === 'MERCHANT_DEBT_PAY' ? 'المورد والدين' : 'الوصف / ملاحظة'}
                  </label>
                  {exp.category === 'MERCHANT_DEBT_PAY' ? (
                    <select
                      value={exp.merchant_debt_id || ''}
                      onChange={(e) => updateExpense(i, 'merchant_debt_id', e.target.value)}
                      className="w-full px-2.5 py-2 border border-[#DEE2E6] rounded-[12px] text-xs outline-none bg-white font-bold focus:border-[#6C757D] focus:ring-1 focus:ring-[#6C757D] h-9"
                    >
                      <option value="">اختر المورد والدين...</option>
                      {viewMerchantDebts.filter(d => d.status !== 'paid').map(d => (
                        <option key={d.id} value={d.id}>{d.supplier_name} ({formatCurrency(d.remaining)})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={exp.description || ''}
                      onChange={(e) => updateExpense(i, 'description', e.target.value)}
                      placeholder="وصف المصروف (مثال: كهرباء، عمال)"
                      className="w-full px-3 py-2 border border-[#DEE2E6] rounded-[12px] text-xs outline-none focus:border-[#6C757D] focus:ring-1 focus:ring-[#6C757D] h-9"
                    />
                  )}
                </div>
              </div>
              
              {exp.category === 'MERCHANT_DEBT_PAY' && (
                <div className="flex flex-col gap-1 pt-1">
                  <label className="text-[10px] font-bold text-gray-400">ملاحظة السداد (اختياري)</label>
                  <input
                    type="text"
                    value={exp.description || ''}
                    onChange={(e) => updateExpense(i, 'description', e.target.value)}
                    placeholder="ملاحظات حول عملية الدفع"
                    className="w-full px-3 py-2 border border-[#DEE2E6] rounded-[12px] text-xs outline-none focus:border-[#6C757D] focus:ring-1 focus:ring-[#6C757D] h-9"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {expenses.length > 0 && (
          <div className="bg-red-50/50 rounded-xl p-3 text-center mt-3 border border-red-100/60 flex justify-between items-center px-4">
            <span className="text-xs font-bold text-red-800">إجمالي المصروفات لليوم:</span>
            <span className="font-extrabold text-red-700 text-base font-mono">{formatCurrency(expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0))} ج.س</span>
          </div>
        )}
      </div>

      {/* Incomes Section */}
      <div className="bg-white rounded-2xl p-5 card-shadow border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F8F9FA] border border-[#DEE2E6] flex items-center justify-center">
              <FiTrendingUp className="text-[#6C757D]" size={18} />
            </div>
            <h3 className="font-black text-[#212529] text-base">الإيرادات اليومية</h3>
          </div>
          <button 
            onClick={addIncome} 
            className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-bold transition-all border border-emerald-100 flex items-center gap-1"
          >
            <span>+</span> إضافة إيراد
          </button>
        </div>
        
        <div className="space-y-3">
          {incomes.map((oi, i) => (
            <div key={i} className="bg-slate-50/50 hover:bg-slate-50 p-4 rounded-xl border border-slate-100 transition-all space-y-3 relative">
              {/* Header with Row Title and Delete button */}
              <div className="flex items-center justify-between border-b border-dashed border-gray-200 pb-2">
                <span className="text-xs font-bold text-gray-500 font-mono">إيراد #{i + 1}</span>
                <button 
                  onClick={() => removeIncome(i)} 
                  className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100/30 font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Stacked Inputs */}
              <div className="grid grid-cols-1 gap-2.5">
                {/* Category select */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400">نوع الإيراد</label>
                  <select
                    value={oi.category}
                    onChange={(e) => updateIncome(i, 'category', e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DEE2E6] rounded-[12px] text-xs outline-none font-bold bg-white focus:border-[#2B8A3E] focus:ring-1 focus:ring-[#2B8A3E] cursor-pointer shadow-sm text-[#212529] h-9"
                  >
                    <option value="EOD_CASH">مبيعات كاش</option>
                    <option value="EOD_BANKAK">مبيعات بنكك</option>
                    <option value="bankak_commission">عمولة بنكك</option>
                    <option value="balance_commission">عمولة رصيد</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                {/* Amount input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400">المبلغ (ج.س)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={oi.amount}
                    onChange={(e) => updateIncome(i, 'amount', e.target.value)}
                    placeholder="المبلغ بالأرقام"
                    className="w-full px-3 py-2 border border-[#DEE2E6] rounded-[12px] text-sm outline-none text-left font-mono font-bold text-[#2B8A3E] bg-[#f0fdf4] focus:border-[#2B8A3E] focus:ring-1 focus:ring-[#2B8A3E] h-9"
                    dir="ltr"
                  />
                </div>

                {/* Description input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400">الوصف / ملاحظة</label>
                  <input
                    type="text"
                    value={oi.description || ''}
                    onChange={(e) => updateIncome(i, 'description', e.target.value)}
                    placeholder="وصف الإيراد (اختياري)"
                    className="w-full px-3 py-2 border border-[#DEE2E6] rounded-[12px] text-xs outline-none focus:border-[#2B8A3E] focus:ring-1 focus:ring-[#2B8A3E] h-9"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {incomes.length > 0 && (
          <div className="bg-emerald-50/50 rounded-xl p-3 text-center mt-3 border border-emerald-100/60 flex justify-between items-center px-4">
            <span className="text-xs font-bold text-emerald-800">إجمالي الإيرادات المدخلة لليوم:</span>
            <span className="font-extrabold text-emerald-700 text-base font-mono">{formatCurrency(incomes.reduce((sum, oi) => sum + (parseFloat(oi.amount) || 0), 0))} ج.س</span>
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full py-3 bg-[#2B8A3E] text-white rounded-[12px] font-black text-lg hover:bg-[#237032] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
      >
        <FiSave size={24} />
        {loading ? 'جاري الحفظ...' : 'حفظ'}
      </button>

      {todaySaved && (
        <p className="text-center text-xs text-green-600 font-bold">✔ تم حفظ المعاملات بنجاح — يمكنك إكمال إضافة معاملات أخرى لليوم.</p>
      )}

      {/* ===== Expenses View Modal ===== */}
      {showExpensesModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-start pt-10 px-4 justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">سجل المصروفات</h3>
              <button onClick={() => setShowExpensesModal(false)} className="text-gray-400 hover:text-red-500">
                <span className="text-xl">✖</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {viewLoading ? (
                <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
              ) : viewExpenses.length === 0 ? (
                <p className="text-center text-gray-400 py-8">لا توجد مصروفات مسجلة</p>
              ) : (
                viewExpenses.map((exp, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-600">{EXPENSE_CATEGORIES[exp.category] || exp.category}</span>
                        <span className="font-bold text-red-600">{formatCurrency(exp.amount)} ج.س</span>
                      </div>
                      {exp.description && <p className="text-xs text-gray-500 mt-1">{exp.description}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{exp.created_at}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="mr-3 text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف"
                    >
                      ✖
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Purchases View Modal ===== */}
      {showPurchasesModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-start pt-10 px-4 justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">المشتريات السابقة (تجديد مخزون)</h3>
              <button onClick={() => setShowPurchasesModal(false)} className="text-gray-400 hover:text-red-500">
                <span className="text-xl">✖</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {viewLoading ? (
                <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
              ) : viewPurchases.length === 0 ? (
                <p className="text-center text-gray-400 py-8">لا توجد مشتريات مسجلة</p>
              ) : (
                viewPurchases.map((p, i) => (
                  <div key={i} className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-700">تجديد مخزون</span>
                      <span className="font-bold text-amber-800">{formatCurrency(p.amount)} ج.س</span>
                    </div>
                    {p.description && <p className="text-xs text-gray-600 mt-1">{p.description}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{p.created_at}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Merchant Debts View Modal ===== */}
      {showMerchantDebtsModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-start pt-10 px-4 justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">ديون التاجر على الموردين</h3>
              <button onClick={() => setShowMerchantDebtsModal(false)} className="text-gray-400 hover:text-red-500">
                <span className="text-xl">✖</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {viewLoading ? (
                <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
              ) : viewMerchantDebts.length === 0 ? (
                <p className="text-center text-gray-400 py-8">لا توجد ديون مسجلة</p>
              ) : (
                viewMerchantDebts.map((d, i) => (
                  <div key={i} className={`rounded-lg p-3 border ${d.status === 'paid' ? 'bg-green-50 border-green-100' : d.status === 'partial' ? 'bg-yellow-50 border-yellow-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-gray-800">{d.supplier_name}</span>
                        <span className={`text-[10px] mr-2 px-1.5 py-0.5 rounded-full ${d.debt_type === 'cash' ? 'bg-green-100 text-green-700' : d.debt_type === 'bank' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                          {d.debt_type === 'cash' ? 'كاش' : d.debt_type === 'bank' ? 'بنكك' : 'بضاعة'}
                        </span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.status === 'paid' ? 'bg-green-100 text-green-700' : d.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {d.status === 'paid' ? 'مسدد' : d.status === 'partial' ? 'جزئي' : 'غير مسدد'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">المبلغ: {formatCurrency(d.total_amount)}</span>
                      <span className="text-xs text-gray-500">المتبقي: {formatCurrency(d.remaining)}</span>
                    </div>
                    {d.description && <p className="text-xs text-gray-500 mt-1">{d.description}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{d.created_at}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {showYesterdayModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-start pt-10 px-4 justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                  <FiList size={18} />
                </div>
                <h3 className="font-black text-gray-800 text-base">ملخص معاملات أمس</h3>
              </div>
              <button onClick={() => setShowYesterdayModal(false)} className="text-gray-400 hover:text-red-500 font-bold transition-colors">
                <span className="text-lg">✖</span>
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 space-y-3.5 pr-1">
              {viewLoading ? (
                <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
              ) : !yesterdayData || !yesterdayData.has_data ? (
                <p className="text-center text-gray-400 py-8">لا توجد أي معاملات مسجلة لأمس</p>
              ) : (
                <div className="space-y-3">
                  {/* Inflows summary */}
                  <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-100/50">
                    <h4 className="font-bold text-blue-900 mb-2.5 text-xs">المقبوضات والمبيعات</h4>
                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>مبيعات نقدي (كاش):</span>
                        <span className="font-bold font-mono">{formatCurrency(yesterdayData.total_cash_sales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>مبيعات بنكك:</span>
                        <span className="font-bold font-mono">{formatCurrency(yesterdayData.total_bankak_sales)}</span>
                      </div>
                      {parseFloat(yesterdayData.total_other_income || 0) > 0 && (
                        <div className="flex justify-between text-green-700 font-medium">
                          <span>عمولات وإيرادات إضافية:</span>
                          <span className="font-bold font-mono">{formatCurrency(yesterdayData.total_other_income)}</span>
                        </div>
                      )}
                      {parseFloat(yesterdayData.total_debt_payments || 0) > 0 && (
                        <div className="flex justify-between text-emerald-700 font-medium border-t border-blue-100/50 pt-1.5 mt-1.5">
                          <span>سدادات ديون العملاء:</span>
                          <span className="font-bold font-mono">{formatCurrency(yesterdayData.total_debt_payments)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-800 font-black border-t border-blue-200/50 pt-1.5 mt-1.5 text-sm">
                        <span>إجمالي المقبوضات:</span>
                        <span className="font-mono text-blue-700">
                          {formatCurrency(
                            (yesterdayData.total_cash_sales || 0) + 
                            (yesterdayData.total_bankak_sales || 0) + 
                            (yesterdayData.total_other_income || 0) + 
                            (yesterdayData.total_debt_payments || 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expenses Summary */}
                  <div className="bg-red-50/50 rounded-xl p-3.5 border border-red-100/50">
                    <h4 className="font-bold text-red-900 mb-2 text-xs">المصروفات والمشتريات</h4>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">إجمالي المدفوعات:</span>
                      <span className="font-bold text-red-700 font-mono">{formatCurrency(yesterdayData.total_expenses)}</span>
                    </div>
                  </div>

                  {/* Net Summary */}
                  <div className="bg-slate-100/80 rounded-xl p-3.5 border border-slate-200/60 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-gray-700">صافي الدخل لليوم:</span>
                      <span className={`font-black text-base font-mono ${yesterdayData.net_cashflow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(yesterdayData.net_cashflow)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Incomes View Modal ===== */}
      {showOtherIncomesModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-start pt-10 px-4 justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <FiTrendingUp size={18} />
                </div>
                <h3 className="font-black text-gray-800 text-base">سجل الإيرادات والمقبوضات لليوم</h3>
              </div>
              <button onClick={() => setShowOtherIncomesModal(false)} className="text-gray-400 hover:text-red-500 font-bold transition-colors">
                <span className="text-lg">✖</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {viewLoading ? (
                <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
              ) : !viewIncomesData ? (
                <p className="text-center text-gray-400 py-8">لا توجد إيرادات مسجلة لليوم</p>
              ) : (
                <div className="space-y-4">
                  {/* Daily In-Store Sales */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 border-b border-slate-200/50 pb-1.5">مبيعات المحل (اليومية)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100 text-center">
                        <span className="text-[10px] text-gray-500 block mb-0.5">نقدي (كاش)</span>
                        <span className="font-bold text-gray-800 text-sm font-mono">{formatCurrency(viewIncomesData.total_cash_sales || 0)}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100 text-center">
                        <span className="text-[10px] text-gray-500 block mb-0.5">بنكك</span>
                        <span className="font-bold text-gray-800 text-sm font-mono">{formatCurrency(viewIncomesData.total_bankak_sales || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Debt Payments */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 border-b border-slate-100 pb-1 flex justify-between">
                      <span>دفعات ديون العملاء المحصلة</span>
                      <span className="text-[10px] text-emerald-600 font-extrabold font-mono">+{formatCurrency(viewIncomesData.total_debt_payments || 0)}</span>
                    </h4>
                    {!viewIncomesData.debt_payments || viewIncomesData.debt_payments.length === 0 ? (
                      <p className="text-[11px] text-gray-400 text-center py-2 bg-slate-50/30 rounded-lg">لا توجد تحصيلات ديون اليوم</p>
                    ) : (
                      <div className="space-y-1.5">
                        {viewIncomesData.debt_payments.map((dp, i) => (
                          <div key={i} className="bg-emerald-50/30 rounded-xl p-2.5 border border-emerald-100/30 flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span className="font-bold text-slate-700">{dp.customer_name}</span>
                            </div>
                            <span className="font-extrabold text-emerald-700 font-mono">{formatCurrency(dp.amount)} ج.س</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Other/Additional Incomes */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 border-b border-slate-100 pb-1 flex justify-between">
                      <span>العمولات والإيرادات الإضافية</span>
                      <span className="text-[10px] text-green-600 font-extrabold font-mono">+{formatCurrency(viewIncomesData.total_other_income || 0)}</span>
                    </h4>
                    {!viewIncomesData.other_incomes || viewIncomesData.other_incomes.length === 0 ? (
                      <p className="text-[11px] text-gray-400 text-center py-2 bg-slate-50/30 rounded-lg">لا توجد عمولات أو إيرادات إضافية اليوم</p>
                    ) : (
                      <div className="space-y-1.5">
                        {viewIncomesData.other_incomes.map((inc, i) => (
                          <div key={i} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/70 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-gray-700 block text-xs">
                                {inc.category === 'bankak_commission' ? 'عمولة بنكك' : inc.category === 'balance_commission' ? 'عمولة رصيد' : 'أخرى'}
                              </span>
                              {inc.description && <span className="text-[10px] text-gray-400 block mt-0.5">{inc.description}</span>}
                            </div>
                            <span className="font-extrabold text-green-600 font-mono">{formatCurrency(inc.amount)} ج.س</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Total Inflows Banner */}
                  <div className="bg-emerald-600 rounded-xl p-3.5 text-white flex justify-between items-center mt-6 shadow-md">
                    <span className="text-xs font-black">إجمالي المقبوضات لليوم:</span>
                    <span className="font-black text-lg font-mono">
                      {formatCurrency(
                        (viewIncomesData.total_cash_sales || 0) + 
                        (viewIncomesData.total_bankak_sales || 0) + 
                        (viewIncomesData.total_other_income || 0) + 
                        (viewIncomesData.total_debt_payments || 0)
                      )} ج.س
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}