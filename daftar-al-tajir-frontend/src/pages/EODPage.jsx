import { useState, useEffect } from 'react';
import { eodAPI, customerAPI, expenseAPI } from '../services/api';
import { formatCurrency, EXPENSE_CATEGORIES } from '../utils/helpers';
import { FiShoppingCart, FiCreditCard, FiTrendingUp, FiPackage, FiDollarSign, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function EODPage() {
  const [cashSales, setCashSales] = useState('');
  const [bankakSales, setBankakSales] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [debtPayments, setDebtPayments] = useState([]);
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

  // Debt payment handling
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
  const totalOtherIncome = otherIncomes.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
  const netCashflow = totalSales - totalExpenses + totalOtherIncome;

  // Save EOD
  const handleSave = async () => {
    setLoading(true);
    try {
      const data = {
        date: new Date().toISOString().split('T')[0],
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
        other_incomes: otherIncomes
          .filter(o => o.amount && parseFloat(o.amount) > 0)
          .map(o => ({
            category: o.category,
            amount: parseFloat(o.amount),
            description: o.description || null,
          })),
      };

      const response = await eodAPI.save(data);
      toast.success(response.data.message);

      // Reset form
      setCashSales('');
      setBankakSales('');
      setExpenses([]);
      setDebtPayments([]);
      setOtherIncomes([{ category: 'bankak_commission', amount: '', description: 'عمولة بنكك' }]);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'حدث خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-4 animate-fade-in">
      {/* Cycle Status Card */}
      {cycleStatus && cycleStatus.status === 'ACTIVE' && (
        <div className="bg-gradient-to-l from-primary-600 to-primary-700 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">الدورة الحالية</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {cycleStatus.days_remaining !== null ? `متبقي ${cycleStatus.days_remaining} يوم` : 'نشطة'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs opacity-80">المبيعات</p>
              <p className="font-bold text-sm">{formatCurrency(cycleStatus.total_sales)}</p>
            </div>
            <div>
              <p className="text-xs opacity-80">المصروفات</p>
              <p className="font-bold text-sm">{formatCurrency(cycleStatus.total_expenses)}</p>
            </div>
            <div>
              <p className="text-xs opacity-80">الصافي</p>
              <p className="font-bold text-sm">{formatCurrency(cycleStatus.net_cashflow)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Last Restock Card */}
      {lastRestock && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <FiPackage className="text-amber-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-amber-700">آخر شراء (تجديد مخزون)</p>
            <p className="font-bold text-amber-800">{formatCurrency(lastRestock.amount)} ج.س</p>
            <p className="text-xs text-amber-600">{lastRestock.date}</p>
          </div>
        </div>
      )}

      {/* Sales Section */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-3">
          <FiShoppingCart className="text-primary-600" size={20} />
          <h3 className="font-bold text-gray-800">المبيعات</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">المبيعات النقدية (الدرج)</label>
            <input
              type="number"
              value={cashSales}
              onChange={(e) => setCashSales(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-left"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">مبيعات بنكك</label>
            <input
              type="number"
              value={bankakSales}
              onChange={(e) => setBankakSales(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-left"
              dir="ltr"
            />
          </div>
          <div className="bg-primary-50 rounded-lg p-2 text-center">
            <span className="text-xs text-gray-600">إجمالي المبيعات: </span>
            <span className="font-bold text-primary-700">{formatCurrency(totalSales)}</span>
          </div>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiCreditCard className="text-red-500" size={20} />
            <h3 className="font-bold text-gray-800">المصروفات</h3>
          </div>
          <button onClick={addExpense} className="text-xs text-primary-600 font-medium">+ إضافة</button>
        </div>
        {expenses.map((exp, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <select
              value={exp.category}
              onChange={(e) => updateExpense(i, 'category', e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none"
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
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none text-left"
              dir="ltr"
            />
            <input
              type="text"
              value={exp.description}
              onChange={(e) => updateExpense(i, 'description', e.target.value)}
              placeholder="وصف"
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none"
            />
            <button onClick={() => removeExpense(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        ))}
        {expenses.length > 0 && (
          <div className="bg-red-50 rounded-lg p-2 text-center">
            <span className="text-xs text-gray-600">إجمالي المصروفات: </span>
            <span className="font-bold text-red-600">{formatCurrency(totalExpenses)}</span>
          </div>
        )}
      </div>

      {/* Debt Payments Section */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiDollarSign className="text-blue-500" size={20} />
            <h3 className="font-bold text-gray-800">سداد الديون</h3>
          </div>
          <button onClick={addDebtPayment} className="text-xs text-primary-600 font-medium">+ إضافة</button>
        </div>
        {debtPayments.map((dp, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <select
              value={dp.customer_id}
              onChange={(e) => updateDebtPayment(i, 'customer_id', e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none"
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
              className="w-28 px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none text-left"
              dir="ltr"
            />
            <button onClick={() => removeDebtPayment(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        ))}
      </div>

      {/* Other Income Section */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiTrendingUp className="text-green-500" size={20} />
            <h3 className="font-bold text-gray-800">الإيرادات الأخرى</h3>
          </div>
          <button onClick={addOtherIncome} className="text-xs text-primary-600 font-medium">+ إضافة</button>
        </div>
        {otherIncomes.map((oi, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <select
              value={oi.category}
              onChange={(e) => updateOtherIncome(i, 'category', e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none"
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
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs outline-none text-left"
              dir="ltr"
            />
            {otherIncomes.length > 1 && (
              <button onClick={() => removeOtherIncome(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-xl p-4 card-shadow-lg border-2 border-primary-200">
        <h3 className="font-bold text-gray-800 mb-3 text-center">ملخص اليوم</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">إجمالي المبيعات</span>
            <span className="font-bold">{formatCurrency(totalSales)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">إجمالي المصروفات</span>
            <span className="font-bold text-red-600">({formatCurrency(totalExpenses)})</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">الإيرادات الأخرى</span>
            <span className="font-bold text-green-600">{formatCurrency(totalOtherIncome)}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between">
            <span className="font-bold text-gray-800">صافي التدفق النقدي</span>
            <span className={`font-bold text-lg ${netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(netCashflow)}
            </span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        <FiSave size={20} />
        {loading ? 'جاري الحفظ...' : 'حفظ وإغلاق اليوم'}
      </button>
    </div>
  );
}
