import { useState, useEffect } from 'react';
import { reportAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const response = await reportAPI.get();
      setReport(response.data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-primary-600 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">لا توجد تقارير بعد</p>
      </div>
    );
  }

  const current = report.current_cycle;

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold text-gray-800">التقارير المالية</h2>

      {/* Current Cycle Summary */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <FiTrendingUp className="text-primary-600" size={20} />
          <h3 className="font-bold text-gray-800">أرباح الدورة الحالية (فترة الشراء)</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-600">إجمالي المبيعات والايرادات</p>
            <p className="font-bold text-green-700 text-lg">{formatCurrency(current.total_sales)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-600">المصروفات والمشتريات</p>
            <p className="font-bold text-red-700 text-lg">{formatCurrency(current.total_expenses)}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center col-span-2 border-2 border-blue-200">
            <p className="text-xs text-blue-600 font-bold mb-1">الأرباح الصافية لهذه الفترة</p>
            <p className="text-xs text-gray-500 mb-1">(الايرادات - المشتريات والمصروفات)</p>
            <p className={`font-bold text-2xl ${current.net_cashflow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(current.net_cashflow)} ج.س
            </p>
          </div>
        </div>
        {current.start_date && (
          <p className="text-xs text-gray-400 mt-3 text-center bg-gray-50 p-2 rounded">
            تغطي الفترة من: {current.start_date} {current.end_date ? `إلى ${current.end_date}` : 'إلى اليوم'}
          </p>
        )}
      </div>

      {/* Outstanding Debts */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-3">
          <FiDollarSign className="text-amber-600" size={20} />
          <h3 className="font-bold text-gray-800">الديون القائمة (عند العملاء)</h3>
        </div>
        <p className="text-3xl font-bold text-amber-700 text-center">
          {formatCurrency(report.total_debts_outstanding)} <span className="text-sm">ج.س</span>
        </p>
      </div>

      {/* Cycle Comparison */}
      {report.comparison && (
        <div className="bg-white rounded-xl p-4 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <FiTrendingDown className="text-blue-600" size={20} />
            <h3 className="font-bold text-gray-800">مقارنة فترات الشراء</h3>
          </div>

          {report.comparison.previous_cycle && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                <span className="text-gray-600">أرباح الفترة السابقة</span>
                <span className="font-bold">{formatCurrency(report.comparison.previous_cycle.net_cashflow)}</span>
              </div>
            </div>
          )}

          <div className="mt-4 bg-gradient-to-l from-gray-800 to-gray-900 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-bl-full -z-10"></div>
            <p className="text-xs text-gray-400 mb-3 font-bold">الأداء العام للنظام (متوسط فترات الشراء)</p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm items-center bg-white/10 p-2 rounded-lg">
                <span className="text-gray-300">متوسط الايرادات للدورة</span>
                <span className="font-bold text-green-400">{formatCurrency(report.comparison.average_sales)}</span>
              </div>
              <div className="flex justify-between text-sm items-center bg-white/10 p-2 rounded-lg">
                <span className="text-gray-300">متوسط المصروفات للدورة</span>
                <span className="font-bold text-red-400">{formatCurrency(report.comparison.average_expenses)}</span>
              </div>
              <div className="pt-2 border-t border-white/20 flex justify-between items-center">
                <span className="font-bold">متوسط صافي الربح</span>
                <span className={`font-black text-xl ${
                  (report.comparison.average_sales - report.comparison.average_expenses) >= 0 
                  ? 'text-green-400' 
                  : 'text-red-400'
                }`}>
                  {formatCurrency(report.comparison.average_sales - report.comparison.average_expenses)} ج.س
                </span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-3 text-center">هذا التقرير التراكمي يغني عن التقارير (الربع/نصف سنوية) لأنه يقيس كفاءة دورة رأس المال الخاص بك.</p>
          </div>
        </div>
      )}
    </div>
  );
}