import { useState, useEffect } from 'react';
import { reportAPI } from '../services/api';
import { formatCurrency, formatDateArabic } from '../utils/helpers';
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
        <div className="w-8 h-8 border-3 border-[#DEE2E6] border-t-[#2B8A3E] rounded-full animate-spin" style={{ borderWidth: '3px' }} />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-[#6C757D]">لا توجد تقارير بعد</p>
      </div>
    );
  }

  const current = report.current_cycle;

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold text-[#212529]">التقارير المالية</h2>

      {/* Current Cycle Summary */}
      <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FiTrendingUp className="text-[#6C757D]" size={20} />
          <h3 className="font-bold text-[#212529]">أرباح الدورة الحالية (فترة الشراء)</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-[#DEE2E6] rounded-xl p-3 text-center">
            <p className="text-xs text-[#6C757D]">إجمالي المبيعات والايرادات</p>
            <p className="font-black text-[#212529] text-2xl">{formatCurrency(current.total_sales)}</p>
          </div>
          <div className="bg-white border border-[#DEE2E6] rounded-xl p-3 text-center">
            <p className="text-xs text-[#6C757D]">المصروفات والمشتريات</p>
            <p className="font-black text-[#212529] text-2xl">{formatCurrency(current.total_expenses)}</p>
          </div>
          <div className="bg-white border border-[#DEE2E6] rounded-xl p-3 text-center col-span-2">
            <p className="text-xs text-[#6C757D] font-bold mb-1">الأرباح الصافية لهذه الفترة</p>
            <p className="text-[10px] text-[#6C757D] mb-1">(الايرادات - المشتريات والمصروفات)</p>
            <p className={`font-black text-3xl ${current.net_cashflow >= 0 ? 'text-[#2B8A3E]' : 'text-red-600'}`}>
              {formatCurrency(current.net_cashflow)} ج.س
            </p>
          </div>
        </div>
        {current.start_date && (
          <p className="text-xs font-bold text-[#6C757D] mt-3 text-center bg-white border border-[#DEE2E6] p-2 rounded-lg shadow-sm">
            تغطي الفترة من: {formatDateArabic(current.start_date)} {current.end_date ? `إلى ${formatDateArabic(current.end_date)}` : 'إلى اليوم'}
          </p>
        )}
      </div>

      {/* Outstanding Debts */}
      <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FiDollarSign className="text-[#6C757D]" size={20} />
          <h3 className="font-bold text-[#212529]">الديون القائمة (عند العملاء)</h3>
        </div>
        <p className="text-3xl font-black text-red-600 text-center">
          {formatCurrency(report.total_debts_outstanding)} <span className="text-sm font-bold">ج.س</span>
        </p>
      </div>

      {/* Cycle Comparison */}
      {report.comparison && (
        <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FiTrendingDown className="text-[#6C757D]" size={20} />
            <h3 className="font-bold text-[#212529]">مقارنة فترات الشراء</h3>
          </div>

          {report.comparison.previous_cycle && (
            <div className="mb-4">
              <p className="text-sm font-bold text-[#212529] mb-2">الفترة السابقة (الدورة المنتهية):</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-white p-2 rounded-lg text-center border border-[#DEE2E6]">
                  <p className="text-[10px] text-[#6C757D]">الإيرادات</p>
                  <p className="font-bold text-[#212529]">{formatCurrency(report.comparison.previous_cycle.total_sales)}</p>
                </div>
                <div className="bg-white p-2 rounded-lg text-center border border-[#DEE2E6]">
                  <p className="text-[10px] text-[#6C757D]">المصروفات والمشتريات</p>
                  <p className="font-bold text-[#212529]">{formatCurrency(report.comparison.previous_cycle.total_expenses)}</p>
                </div>
                <div className="col-span-2 bg-white p-2 rounded-lg text-center border border-[#DEE2E6] flex items-center justify-between px-4">
                  <p className="text-xs text-[#212529] font-bold">صافي الربح:</p>
                  <p className={`font-black text-xl ${report.comparison.previous_cycle.net_cashflow >= 0 ? 'text-[#2B8A3E]' : 'text-red-600'}`}>
                    {formatCurrency(report.comparison.previous_cycle.net_cashflow)} ج.س
                  </p>
                </div>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-[#6C757D] mt-2 px-1">
                <span>البداية: {report.comparison.previous_cycle.start_date ? formatDateArabic(report.comparison.previous_cycle.start_date) : 'غير محدد'}</span>
                <span>النهاية: {report.comparison.previous_cycle.end_date ? formatDateArabic(report.comparison.previous_cycle.end_date) : 'غير محدد'}</span>
              </div>
            </div>
          )}

          <div className="mt-4 bg-[#212529] rounded-xl p-4 text-white shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-bl-full -z-10"></div>
            <p className="text-xs text-[#DEE2E6] mb-3 font-bold">الأداء العام للنظام (متوسط فترات الشراء)</p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm items-center bg-white/5 p-2 rounded-lg border border-white/10">
                <span className="text-[#DEE2E6]">متوسط الايرادات للدورة</span>
                <span className="font-bold text-white">{formatCurrency(report.comparison.average_sales)}</span>
              </div>
              <div className="flex justify-between text-sm items-center bg-white/5 p-2 rounded-lg border border-white/10">
                <span className="text-[#DEE2E6]">متوسط المصروفات للدورة</span>
                <span className="font-bold text-white">{formatCurrency(report.comparison.average_expenses)}</span>
              </div>
              <div className="pt-2 border-t border-white/20 flex justify-between items-center">
                <span className="font-bold text-[#DEE2E6]">متوسط صافي الربح</span>
                <span className={`font-black text-2xl ${
                  (report.comparison.average_sales - report.comparison.average_expenses) >= 0 
                  ? 'text-[#2B8A3E]' 
                  : 'text-red-500'
                }`}>
                  {formatCurrency(report.comparison.average_sales - report.comparison.average_expenses)} ج.س
                </span>
              </div>
            </div>
            <p className="text-[10px] text-[#6C757D] mt-3 text-center">هذا التقرير التراكمي يغني عن التقارير (الربع/نصف سنوية) لأنه يقيس كفاءة دورة رأس المال الخاص بك.</p>
          </div>
        </div>
      )}

      {!report.comparison && (
        <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-xl p-4 shadow-sm text-center">
          <p className="text-sm text-[#6C757D] font-bold">لا توجد فترات سابقة للمقارنة بعد</p>
          <p className="text-xs text-[#6C757D] mt-1">سيظهر تقرير المقارنة بعد إتمام دورة شراء كاملة.</p>
        </div>
      )}
    </div>
  );
}