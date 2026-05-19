import { useState, useEffect, useCallback } from 'react';
import { eodAPI, customerAPI, expenseAPI, merchantDebtAPI } from '../services/api';
import { formatCurrency, EXPENSE_CATEGORIES } from '../utils/helpers';
import { FiShoppingCart, FiCreditCard, FiTrendingUp, FiPackage, FiDollarSign, FiSave, FiList, FiEye, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function EODPage() {
  const [cashSales, setCashSales] = useState([]);
  const [bankakSales, setBankakSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [merchantDebts, setMerchantDebts] = useState([]); // ديون على التاجر
  const [merchantDebtPayments, setMerchantDebtPayments] = useState([]); // سداد ديون التاجر
  const [otherIncomes, setOtherIncomes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [lastRestock, setLastRestock] = useState(null);
  const [cycleStatus, setCycleStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [todaySaved, setTodaySaved] = useState(false);
  const [todayData, setTodayData] = useState(null);

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
  const [viewOtherIncomes, setViewOtherIncomes] = useState([]);

  // Check if day changed (midnight reset)
  const checkDayReset = useCallback(() => {
    const savedDate = localStorage.getItem('eod_date');
    const today = new Date().toISOString().split('T')[0];
    if (savedDate && savedDate !== today) {
      // New day - clear local form data
      localStorage.removeItem('eod_date');
      localStorage.removeItem('eod_form');
      setCashSales([]);
      setBankakSales([]);
      setExpenses([]);
      setMerchantDebts([]);
      setOtherIncomes([]);
      setTodaySaved(false);
    }
  }, []);

  useEffect(() => {
    checkDayReset();
    loadData();
    // Check for midnight reset every minute
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
        if (td.has_data) {
          setTodaySaved(true);
          // Populate sales fields from server so they persist all day
          if (td.total_cash_sales > 0) setCashSales([{ amount: String(td.total_cash_sales), description: 'إجمالي محفوظ' }]);
          if (td.total_bankak_sales > 0) setBankakSales([{ amount: String(td.total_bankak_sales), description: 'إجمالي محفوظ' }]);
        }
        setTodayData(td);
      }
      if (debtsRes.status === 'fulfilled') setViewMerchantDebts(debtsRes.value.data || []);
    } catch {}
  };

  // Expense handling
  const addExpense = () => {
    setExpenses([...expenses, { category: 'PURCHASE', amount: '', description: '' }]);
  };

  const updateExpense = (index, field, value) => {
    const updated = [...expenses];
    updated[index][field] = value;
    setExpenses(updated);
  };

  const removeExpense = (index) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  // Merchant Debt handling (ديون على التاجر)
  const addMerchantDebt = () => {
    setMerchantDebts([...merchantDebts, { amount: '', description: '' }]);
  };

  const updateMerchantDebt = (index, field, value) => {
    const updated = [...merchantDebts];
    updated[index][field] = value;
    setMerchantDebts(updated);
  };

  const removeMerchantDebt = (index) => {
    setMerchantDebts(merchantDebts.filter((_, i) => i !== index));
  };

  // Other income handling
  const addOtherIncome = () => {
    setOtherIncomes([...otherIncomes, { category: 'other', amount: '', description: '' }]);
  };

  const updateOtherIncome = (index, field, value) => {
    const updated = [...otherIncomes];
    updated[index][field] = value;
    setOtherIncomes(updated);
  };

  const removeOtherIncome = (index) => {
    setOtherIncomes(otherIncomes.filter((_, i) => i !== index));
  };

  // Add & Remove Sales
  const addCashSale = () => setCashSales([...cashSales, { amount: '', description: '' }]);
  const updateCashSale = (index, field, value) => {
    const newList = [...cashSales];
    newList[index][field] = value;
    setCashSales(newList);
  };
  const removeCashSale = (index) => {
    setCashSales(cashSales.filter((_, i) => i !== index));
  };

  const addBankakSale = () => setBankakSales([...bankakSales, { amount: '', description: '' }]);
  const updateBankakSale = (index, field, value) => {
    const newList = [...bankakSales];
    newList[index][field] = value;
    setBankakSales(newList);
  };
  const removeBankakSale = (index) => {
    setBankakSales(bankakSales.filter((_, i) => i !== index));
  };

  // Merchant debt payment handling (سداد ديون التاجر)
  const addMerchantDebtPayment = () => {
    setMerchantDebtPayments([...merchantDebtPayments, { debt_id: '', amount: '' }]);
  };
  const updateMerchantDebtPayment = (index, field, value) => {
    const updated = [...merchantDebtPayments];
    updated[index][field] = value;
    setMerchantDebtPayments(updated);
  };
  const removeMerchantDebtPayment = (index) => {
    setMerchantDebtPayments(merchantDebtPayments.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Create actual merchant debts in the DB
      const validDebts = merchantDebts.filter(md => md.amount && parseFloat(md.amount) > 0);
      for (const md of validDebts) {
        await merchantDebtAPI.create({
          supplier_name: md.description || 'مورد غير محدد',
          debt_type: 'cash',
          total_amount: parseFloat(md.amount),
          description: 'دين تم تسجيله عبر المعاملات'
        });
      }

      // 2. Pay merchant debts (سداد ديون التاجر - يسجل كمصروف)
      const validDebtPayments = merchantDebtPayments.filter(dp => dp.debt_id && dp.amount && parseFloat(dp.amount) > 0);
      for (const dp of validDebtPayments) {
        await merchantDebtAPI.pay({
          merchant_debt_id: dp.debt_id,
          amount: parseFloat(dp.amount),
          payment_method: 'cash',
          description: 'سداد عبر المعاملات'
        });
      }

      // Combine other incomes and merchant debts into the same API payload for cashflow balance
      const combinedOtherIncomes = [
        ...otherIncomes.filter(o => o.amount && parseFloat(o.amount) > 0).map(o => ({
          category: o.category,
          amount: parseFloat(o.amount),
          description: o.description || null,
        })),
        ...validDebts.map(md => ({
          category: 'merchant_debt',
          amount: parseFloat(md.amount),
          description: `دين مستلم: ${md.description || ''}`.trim(),
        }))
      ];

      // Combine normal expenses and merchant debt payments (which are recorded as expenses)
      const combinedExpenses = [
        ...expenses.filter(e => e.amount && parseFloat(e.amount) > 0).map(e => ({
          category: e.category,
          amount: parseFloat(e.amount),
          description: e.description || null,
        })),
        ...validDebtPayments.map(dp => {
          const debtInfo = viewMerchantDebts.find(d => String(d.id) === String(dp.debt_id));
          return {
            category: 'OTHER', // Defaulting to OTHER or BILL for debt payment
            amount: parseFloat(dp.amount),
            description: `سداد دين مورد: ${debtInfo ? debtInfo.supplier_name : ''}`.trim(),
          };
        })
      ];

      const totalCash = cashSales.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const totalBankak = bankakSales.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      await eodAPI.save({
        eod_date: new Date().toISOString().split('T')[0],
        sales: { cash_sales: totalCash, bankak_sales: totalBankak },
        expenses: combinedExpenses,
        other_incomes: combinedOtherIncomes,
      });

      toast.success("تم الحفظ بنجاح");

      // Save today's date so midnight reset knows when to clear
      localStorage.setItem('eod_date', new Date().toISOString().split('T')[0]);
      setTodaySaved(true);

      // Reset all inputs - data is sent as an incremental transaction
      // Sales stay visible per user request
      setExpenses([]);
      setMerchantDebts([]);
      setMerchantDebtPayments([]);
      setOtherIncomes([]);
      loadData();
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
      // eodAPI should get other incomes if there is an endpoint, or we can use todayData.total_other_income if they just want to see it
      // Since there's no dedicated other_incomes endpoint yet, let's just show an alert or placeholder
      // For now, I'll fetch today's data or we can just open a modal.
      const res = await eodAPI.getToday();
      setViewOtherIncomes(res.data?.other_incomes || []);
    } catch { toast.error('فشل تحميل الإيرادات الإضافية'); }
    finally { setViewLoading(false); }
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
      {cycleStatus && cycleStatus.status === 'ACTIVE' && (
        <div className="bg-gradient-to-l from-primary-600 to-primary-700 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">ملخص الدورة الحالية (فترة الشراء)</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {cycleStatus.days_remaining !== null ? `متبقي ${cycleStatus.days_remaining} يوم` : 'نشطة'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mt-3">
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-[10px] opacity-90 mb-1">المبيعات الكلية</p>
              <p className="font-bold text-sm">{formatCurrency(cycleStatus.total_sales)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-[10px] opacity-90 mb-1">المصروفات/مشتريات</p>
              <p className="font-bold text-sm">{formatCurrency(cycleStatus.total_expenses)}</p>
            </div>
            <div className="bg-white/20 rounded-lg p-2 border border-white/30">
              <p className="text-[10px] font-bold mb-1">صافي الأرباح</p>
              <p className="font-bold text-sm">{formatCurrency(cycleStatus.net_cashflow)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Today's Summary Card */}
      {todayData && todayData.has_data && (
        <div className="bg-gradient-to-l from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">ملخص اليوم (حتى الآن)</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mt-3">
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-[10px] opacity-90 mb-1">الإيرادات</p>
              <p className="font-bold text-sm">{formatCurrency((todayData.total_cash_sales || 0) + (todayData.total_bankak_sales || 0) + (todayData.total_other_income || 0))}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-[10px] opacity-90 mb-1">المصروفات</p>
              <p className="font-bold text-sm">{formatCurrency(todayData.total_expenses || 0)}</p>
            </div>
            <div className="bg-white/20 rounded-lg p-2 border border-white/30">
              <p className="text-[10px] font-bold mb-1">الصافي</p>
              <p className="font-bold text-sm">{formatCurrency(todayData.net_cashflow || 0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* View Buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleViewExpenses} className="flex items-center gap-1 text-sm text-red-600 font-bold bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
          <FiEye size={14} />
          المصروفات
        </button>
        <button onClick={handleViewPurchases} className="flex items-center gap-1 text-sm text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
          <FiEye size={14} />
          المشتريات
        </button>
        <button onClick={handleViewMerchantDebts} className="flex items-center gap-1 text-sm text-blue-600 font-bold bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
          <FiEye size={14} />
          ديون التاجر
        </button>
        <button onClick={handleViewOtherIncomes} className="flex items-center gap-1 text-sm text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
          <FiEye size={14} />
          الإيرادات
        </button>
        <button onClick={handleViewYesterday} className="flex items-center gap-1 text-sm text-purple-600 font-bold bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors">
          <FiEye size={14} />
          معاملات أمس
        </button>
      </div>

      {/* Last Restock Card */}
      {lastRestock && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <FiPackage className="text-amber-600" size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-800">آخر عملية شراء (تجديد مخزون)</p>
            <p className="font-bold text-amber-900">{formatCurrency(lastRestock.amount)} ج.س</p>
            <p className="text-[10px] text-amber-600">بتاريخ: {lastRestock.date}</p>
          </div>
        </div>
      )}

      {/* Sales Section */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <FiShoppingCart className="text-primary-600" size={20} />
            <h3 className="font-bold text-gray-800">المبيعات النقدية (كاش)</h3>
          </div>
          <button onClick={addCashSale} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-md font-bold hover:bg-primary-100">+ إضافة مبيعات</button>
        </div>
        {cashSales.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">لا توجد مبيعات كاش مسجلة</p>
        )}
        {cashSales.map((cs, i) => (
          <div key={`cash-${i}`} className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
            <input
              type="number"
              value={cs.amount}
              onChange={(e) => updateCashSale(i, 'amount', e.target.value)}
              placeholder="المبلغ"
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none text-left font-mono"
              dir="ltr"
            />
            <input
              type="text"
              placeholder="وصف (اختياري)"
              value={cs.description || ''}
              onChange={(e) => updateCashSale(i, 'description', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
            <button onClick={() => removeCashSale(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">✕</button>
          </div>
        ))}
        {cashSales.length > 0 && (
          <div className="text-left text-xs font-bold text-gray-600 mt-1">الإجمالي: {formatCurrency(cashSales.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</div>
        )}

        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50 mt-6">
          <div className="flex items-center gap-2">
            <FiShoppingCart className="text-blue-600" size={20} />
            <h3 className="font-bold text-gray-800">مبيعات تحويل (بنكك)</h3>
          </div>
          <button onClick={addBankakSale} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold hover:bg-blue-100">+ إضافة مبيعات</button>
        </div>
        {bankakSales.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">لا توجد مبيعات بنكك مسجلة</p>
        )}
        {bankakSales.map((bs, i) => (
          <div key={`bankak-${i}`} className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
            <input
              type="number"
              value={bs.amount}
              onChange={(e) => updateBankakSale(i, 'amount', e.target.value)}
              placeholder="المبلغ"
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none text-left font-mono"
              dir="ltr"
            />
            <input
              type="text"
              placeholder="وصف (اختياري)"
              value={bs.description || ''}
              onChange={(e) => updateBankakSale(i, 'description', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
            <button onClick={() => removeBankakSale(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">✕</button>
          </div>
        ))}
        {bankakSales.length > 0 && (
          <div className="text-left text-xs font-bold text-gray-600 mt-1">الإجمالي: {formatCurrency(bankakSales.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</div>
        )}
      </div>

      {/* Merchant Debts (ديون التاجر للموردين) */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiTrendingUp className="text-blue-500" size={20} />
            <h3 className="font-bold text-gray-800">ديون التاجر للموردين</h3>
          </div>
          <div className="flex gap-1">
            <button onClick={addMerchantDebt} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold hover:bg-blue-100">+ إضافة دين</button>
            <button onClick={addMerchantDebtPayment} className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-md font-bold hover:bg-orange-100">+ سداد</button>
          </div>
        </div>

        {/* إضافة دين جديد */}
        {merchantDebts.length > 0 && (
          <p className="text-[10px] text-gray-500 mb-2">تسجيل دين جديد على التاجر:</p>
        )}
        {merchantDebts.map((md, i) => (
          <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
            <input
              type="number"
              value={md.amount}
              onChange={(e) => updateMerchantDebt(i, 'amount', e.target.value)}
              placeholder="المبلغ"
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none text-left font-mono"
              dir="ltr"
            />
            <input
              type="text"
              placeholder="اسم المورد / الجهة"
              value={md.description}
              onChange={(e) => updateMerchantDebt(i, 'description', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
            <button onClick={() => removeMerchantDebt(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">✕</button>
          </div>
        ))}

        {/* سداد دين قائم */}
        {merchantDebtPayments.length > 0 && (
          <p className="text-[10px] text-orange-600 font-bold mb-2 mt-3 border-t border-gray-100 pt-2">سداد دين قائم (يسجل كمصروف):</p>
        )}
        {merchantDebtPayments.map((dp, i) => (
          <div key={`dp-${i}`} className="flex items-center gap-2 mb-2 bg-orange-50 p-2 rounded-lg border border-orange-100">
            <select
              value={dp.debt_id}
              onChange={(e) => updateMerchantDebtPayment(i, 'debt_id', e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none bg-white"
            >
              <option value="">اختر الدين</option>
              {viewMerchantDebts.filter(d => d.status !== 'paid').map(d => (
                <option key={d.id} value={d.id}>{d.supplier_name} ({formatCurrency(d.remaining)})</option>
              ))}
            </select>
            <input
              type="number"
              value={dp.amount}
              onChange={(e) => updateMerchantDebtPayment(i, 'amount', e.target.value)}
              placeholder="المبلغ"
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none text-left font-mono"
              dir="ltr"
            />
            <button onClick={() => removeMerchantDebtPayment(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">✕</button>
          </div>
        ))}
      </div>

      {/* Expenses Section */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiCreditCard className="text-red-500" size={20} />
            <h3 className="font-bold text-gray-800">المصروفات والمشتريات</h3>
          </div>
          <button onClick={addExpense} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-md font-bold hover:bg-red-100">+ إضافة مصروف</button>
        </div>
        {expenses.map((exp, i) => (
          <div key={i} className="flex flex-col gap-2 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
            <div className="flex gap-2">
              <select
                value={exp.category}
                onChange={(e) => updateExpense(i, 'category', e.target.value)}
                className="px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none font-bold bg-white"
              >
                {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => {
                  // Hide RESTOCK if cycle is still active
                  if (key === 'RESTOCK' && cycleStatus?.status === 'ACTIVE') return null;
                  return <option key={key} value={key}>{label}</option>;
                })}
              </select>
              <input
                type="number"
                value={exp.amount}
                onChange={(e) => updateExpense(i, 'amount', e.target.value)}
                placeholder="المبلغ"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none text-left font-mono"
                dir="ltr"
              />
              <button onClick={() => removeExpense(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">✕</button>
            </div>
            <input
              type="text"
              value={exp.description}
              onChange={(e) => updateExpense(i, 'description', e.target.value)}
              placeholder="وصف المصروف"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none"
            />
          </div>
        ))}
        {expenses.length > 0 && (
          <div className="bg-red-50 rounded-lg p-2 text-center mt-2 border border-red-100">
            <span className="text-xs font-bold text-red-800">إجمالي المصروفات والمشتريات لليوم: </span>
            <span className="font-bold text-red-700 text-lg">{formatCurrency(expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0))}</span>
          </div>
        )}
      </div>

      {/* Other Income Section */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiTrendingUp className="text-primary-500" size={20} />
            <h3 className="font-bold text-gray-800">إيرادات أخرى إضافية</h3>
          </div>
          <button onClick={addOtherIncome} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-md font-bold hover:bg-primary-100">+ إضافة إيراد</button>
        </div>
        {otherIncomes.map((oi, i) => (
          <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
            <select
              value={oi.category}
              onChange={(e) => updateOtherIncome(i, 'category', e.target.value)}
              className="w-32 px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none bg-white font-bold"
            >
              <option value="bankak_commission">عمولة بنكك</option>
              <option value="balance_commission">عمولة رصيد</option>
              <option value="other">أخرى</option>
            </select>
            <input
              type="number"
              value={oi.amount}
              onChange={(e) => updateOtherIncome(i, 'amount', e.target.value)}
              placeholder="المبلغ"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none text-left font-mono"
              dir="ltr"
            />
            <button onClick={() => removeOtherIncome(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">✕</button>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-black text-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
      >
        <FiSave size={24} />
        {loading ? 'جاري الحفظ...' : 'حفظ'}
      </button>

      {todaySaved && (
        <p className="text-center text-xs text-green-600 font-bold">✔ تم حفظ المعاملات بنجاح — يمكنك إكمال إضافة معاملات أخرى لليوم.</p>
      )}

      {/* ===== Expenses View Modal ===== */}
      {showExpensesModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
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
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
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
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
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

      {/* ===== Yesterday's Data Modal ===== */}
      {showYesterdayModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">ملخص معاملات أمس</h3>
              <button onClick={() => setShowYesterdayModal(false)} className="text-gray-400 hover:text-red-500">
                <span className="text-xl">✖</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-4">
              {viewLoading ? (
                <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
              ) : !yesterdayData || !yesterdayData.has_data ? (
                <p className="text-center text-gray-400 py-8">لا توجد أي معاملات مسجلة لأمس</p>
              ) : (
                <div className="space-y-4">
                  {/* Sales Summary */}
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="font-bold text-blue-800 mb-2">المبيعات</h4>
                    <div className="flex justify-between text-sm mb-1">
                      <span>نقدي (كاش):</span>
                      <span className="font-bold">{formatCurrency(yesterdayData.cash_sales)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>بنكك:</span>
                      <span className="font-bold">{formatCurrency(yesterdayData.bankak_sales)}</span>
                    </div>
                  </div>

                  {/* Expenses Summary */}
                  <div className="bg-red-50 rounded-xl p-4">
                    <h4 className="font-bold text-red-800 mb-2">المصروفات والمشتريات</h4>
                    <div className="flex justify-between text-sm">
                      <span>الإجمالي:</span>
                      <span className="font-bold">{formatCurrency(yesterdayData.total_expenses)}</span>
                    </div>
                  </div>

                  {/* Other Income Summary */}
                  <div className="bg-green-50 rounded-xl p-4">
                    <h4 className="font-bold text-green-800 mb-2">إيرادات أخرى</h4>
                    <div className="flex justify-between text-sm">
                      <span>الإجمالي:</span>
                      <span className="font-bold">{formatCurrency(yesterdayData.total_other_income)}</span>
                    </div>
                  </div>

                  {/* Net Summary */}
                  <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-2">الصافي</h4>
                    <div className="flex justify-between text-sm">
                      <span>صافي الدخل:</span>
                      <span className="font-bold text-primary-600">{formatCurrency(yesterdayData.net)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ===== Other Incomes View Modal ===== */}
      {showOtherIncomesModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">سجل الإيرادات الإضافية</h3>
              <button onClick={() => setShowOtherIncomesModal(false)} className="text-gray-400 hover:text-red-500">
                <span className="text-xl">✖</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {viewLoading ? (
                <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
              ) : viewOtherIncomes.length === 0 ? (
                <p className="text-center text-gray-400 py-8">لا توجد إيرادات مسجلة</p>
              ) : (
                viewOtherIncomes.map((inc, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-600">{inc.category}</span>
                        <span className="font-bold text-green-600">{formatCurrency(inc.amount)} ج.س</span>
                      </div>
                      {inc.description && <p className="text-xs text-gray-500 mt-1">{inc.description}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}