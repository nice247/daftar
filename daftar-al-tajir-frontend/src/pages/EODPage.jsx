import { useState, useEffect } from 'react';
import { eodAPI, customerAPI } from '../services/api';
import { formatCurrency, EXPENSE_CATEGORIES } from '../utils/helpers';
import { FiShoppingCart, FiCreditCard, FiTrendingUp, FiPackage, FiDollarSign, FiSave, FiList } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function EODPage() {
  const [cashSales, setCashSales] = useState('');
  const [bankakSales, setBankakSales] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [debtPayments, setDebtPayments] = useState([]);
  const [merchantDebts, setMerchantDebts] = useState([]); // ديون على التاجر (إيراد)
  const [otherIncomes, setOtherIncomes] = useState([{ category: 'bankak_commission', amount: '', description: 'عمولة بنكك' }]);
  const [customers, setCustomers] = useState([]);
  const [lastRestock, setLastRestock] = useState(null);
  const [cycleStatus, setCycleStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [custRes, restockRes, cycleRes] = await Promise.allSettled([
        customerAPI.list(),
        eodAPI.getLastRestock(),
        eodAPI.getCycleStatus(),
      ]);
      if (custRes.status === 'fulfilled') setCustomers(custRes.value.data);
      if (restockRes.status === 'fulfilled' && restockRes.value.data.date) setLastRestock(restockRes.value.data);
      if (cycleRes.status === 'fulfilled') setCycleStatus(cycleRes.value.data);
    } catch {}
  };

  // Expense handling
  const addExpense = () => {
    setExpenses([...expenses, { category: 'OTHER', amount: '', description: '' }]);
  };

  const updateExpense = (index, field, value) => {
    const updated = [...expenses];
    updated[index][field] = value;
    setExpenses(updated);
  };

  const removeExpense = (index) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  // Debt payment handling (سداد ديون العملاء)
  const addDebtPayment = () => {
    setDebtPayments([...debtPayments, { customer_id: '', amount: '' }]);
  };

  const updateDebtPayment = (index, field, value) => {
    const updated = [...debtPayments];
    updated[index][field] = value;
    setDebtPayments(updated);
  };

  const removeDebtPayment = (index) => {
    setDebtPayments(debtPayments.filter((_, i) => i !== index));
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

  // Calculate totals
  const totalSales = (parseFloat(cashSales) || 0) + (parseFloat(bankakSales) || 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  
  // Differentiate between other incomes and merchant debts, though both are technically income for the day's cashflow
  const regularOtherIncome = otherIncomes.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
  const totalMerchantDebtReceived = merchantDebts.reduce((sum, md) => sum + (parseFloat(md.amount) || 0), 0);
  
  const totalOtherIncome = regularOtherIncome + totalMerchantDebtReceived; // All extra inflows
  const totalRevenues = totalSales + totalOtherIncome; // الإيرادات الكلية
  const netProfit = totalRevenues - totalExpenses; // صافي الأرباح

  // Save EOD
  const handleSave = async () => {
    setLoading(true);
    try {
      // Combine other incomes and merchant debts into the same API payload for simplicity
      const combinedOtherIncomes = [
        ...otherIncomes.filter(o => o.amount && parseFloat(o.amount) > 0).map(o => ({
          category: o.category,
          amount: parseFloat(o.amount),
          description: o.description || null,
        })),
        ...merchantDebts.filter(md => md.amount && parseFloat(md.amount) > 0).map(md => ({
          category: 'merchant_debt',
          amount: parseFloat(md.amount),
          description: `دين مستلم: ${md.description || ''}`.trim(),
        }))
      ];

      const data = {
        eod_date: new Date().toISOString().split('T')[0],
        sales: {
          cash_sales: parseFloat(cashSales) || 0,
          bankak_sales: parseFloat(bankakSales) || 0,
        },
        expenses: expenses
          .filter(e => e.amount && parseFloat(e.amount) > 0)
          .map(e => ({
            category: e.category,
            amount: parseFloat(e.amount),
            description: e.description || null,
          })),
        debt_payments: debtPayments
          .filter(d => d.customer_id && d.amount && parseFloat(d.amount) > 0)
          .map(d => ({
            customer_id: d.customer_id,
            amount: parseFloat(d.amount),
          })),
        other_incomes: combinedOtherIncomes,
      };

      const response = await eodAPI.save(data);
      toast.success(response.data.message);

      // Reset form
      setCashSales('');
      setBankakSales('');
      setExpenses([]);
      setDebtPayments([]);
      setMerchantDebts([]);
      setOtherIncomes([{ category: 'bankak_commission', amount: '', description: 'عمولة بنكك' }]);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'حدث خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
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

      {/* History Link */}
      <div className="flex justify-end">
        <Link to="/reports" className="flex items-center gap-1 text-sm text-primary-600 font-bold bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors">
          <FiList size={16} />
          سجل المعاملات والتقارير السابقة
        </Link>
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
            <h3 className="font-bold text-gray-800">المبيعات والإيرادات</h3>
          </div>
          <div className="text-left bg-green-50 px-3 py-1 rounded-lg">
            <p className="text-[10px] text-green-800 font-bold">الإيرادات الكلية لليوم</p>
            <p className="font-bold text-green-700">{formatCurrency(totalRevenues)} ج.س</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">المبيعات النقدية (الكاش في الدرج)</label>
            <input
              type="number"
              value={cashSales}
              onChange={(e) => setCashSales(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-left font-mono text-lg"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">مبيعات بنكك (تحويلات)</label>
            <input
              type="number"
              value={bankakSales}
              onChange={(e) => setBankakSales(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-left font-mono text-lg"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Merchant Debts (ديون على التاجر) */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiTrendingUp className="text-blue-500" size={20} />
            <h3 className="font-bold text-gray-800">ديون مستلمة (ديون على التاجر)</h3>
          </div>
          <button onClick={addMerchantDebt} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold hover:bg-blue-100">+ إضافة دين</button>
        </div>
        <p className="text-[10px] text-gray-500 mb-3">مبالغ استدنتها اليوم وتعتبر إيراد (دخلت الخزينة/الحساب).</p>
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
              value={md.description}
              onChange={(e) => updateMerchantDebt(i, 'description', e.target.value)}
              placeholder="وصف (ممن؟)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
            <button onClick={() => removeMerchantDebt(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">✕</button>
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
                {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
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
            <span className="font-bold text-red-700 text-lg">{formatCurrency(totalExpenses)}</span>
          </div>
        )}
      </div>

      {/* Debt Payments Section */}
      <div className="bg-white rounded-xl p-4 card-shadow border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiDollarSign className="text-green-600" size={20} />
            <h3 className="font-bold text-gray-800">سداد ديون العملاء</h3>
          </div>
          <button onClick={addDebtPayment} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md font-bold hover:bg-green-100">+ إضافة سداد</button>
        </div>
        <p className="text-[10px] text-gray-500 mb-3">ديون قام العملاء بتسديدها اليوم.</p>
        {debtPayments.map((dp, i) => (
          <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
            <select
              value={dp.customer_id}
              onChange={(e) => updateDebtPayment(i, 'customer_id', e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none bg-white"
            >
              <option value="">اختر العميل</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({formatCurrency(c.total_debt)})</option>
              ))}
            </select>
            <input
              type="number"
              value={dp.amount}
              onChange={(e) => updateDebtPayment(i, 'amount', e.target.value)}
              placeholder="المبلغ"
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none text-left font-mono"
              dir="ltr"
            />
            <button onClick={() => removeDebtPayment(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">✕</button>
          </div>
        ))}
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
            {otherIncomes.length > 1 && (
              <button onClick={() => removeOtherIncome(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-xl p-5 card-shadow-lg border-2 border-primary-400 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-primary-100 rounded-bl-full -z-10 opacity-50"></div>
        <h3 className="font-black text-gray-800 mb-4 text-center text-xl">ملخص اليومية</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm items-center bg-gray-50 p-2 rounded-lg">
            <span className="text-gray-700 font-bold">الإيرادات الكلية (مبيعات + إيرادات أخرى + ديون مستلمة)</span>
            <span className="font-black text-green-700 text-lg">{formatCurrency(totalRevenues)}</span>
          </div>
          <div className="flex justify-between text-sm items-center bg-gray-50 p-2 rounded-lg">
            <span className="text-gray-700 font-bold">إجمالي المصروفات (والمشتريات)</span>
            <span className="font-black text-red-600 text-lg">({formatCurrency(totalExpenses)})</span>
          </div>
          <div className="border-t-2 border-dashed border-gray-300 pt-4 flex justify-between items-center mt-2">
            <div>
              <span className="font-black text-gray-900 text-xl block">صافي الأرباح (اليوم)</span>
              <span className="text-[10px] text-gray-500">(الإيرادات الكلية - المصروفات)</span>
            </div>
            <span className={`font-black text-2xl px-3 py-1 rounded-lg ${netProfit >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {formatCurrency(netProfit)} ج.س
            </span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-black text-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
      >
        <FiSave size={24} />
        {loading ? 'جاري الحفظ...' : 'حفظ وإغلاق اليوم'}
      </button>
    </div>
  );
}