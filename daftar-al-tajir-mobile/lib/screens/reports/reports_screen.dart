import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../config/api_config.dart';
import '../../database/local_db_helper.dart';
import '../../services/api_service.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _reportData;
  bool _loading = true;

  final currencyFormat = NumberFormat('#,##0.##', 'ar');

  String formatCurrency(dynamic val) {
    if (val == null) return '0';
    final numVal = double.tryParse(val.toString()) ?? 0.0;
    return currencyFormat.format(numVal);
  }

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  Future<void> _loadReport() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get(ApiConfig.reports);
      if (res.statusCode == 200) {
        _reportData = jsonDecode(res.body);
        if (_reportData != null) {
          await LocalDbHelper.instance.cacheReports(_reportData!);
        }
      } else {
        _reportData = await LocalDbHelper.instance.getCachedReports();
      }
    } catch (_) {
      _reportData = await LocalDbHelper.instance.getCachedReports();
    }

    // If still null, generate initial local structure from SQLite
    if (_reportData == null) {
      final debts = await LocalDbHelper.instance.getCachedCustomerDebts();
      final expenses = await LocalDbHelper.instance.getCachedExpenses();
      double totalDebts = debts.fold(0.0, (sum, d) => sum + (d.remainingAmount));
      double totalExpenses = expenses.fold(0.0, (sum, e) => sum + (e.amount));

      _reportData = {
        'current_cycle': {
          'total_sales': 0.0,
          'total_expenses': totalExpenses,
          'net_cashflow': -totalExpenses,
          'start_date': DateTime.now().toIso8601String().substring(0, 10),
        },
        'total_debts_outstanding': totalDebts,
        'comparison': null,
      };
    }

    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2B8A3E)));
    }

    final current = _reportData?['current_cycle'] ?? {};
    final comparison = _reportData?['comparison'];
    final prevCycle = comparison?['previous_cycle'];
    final totalDebts = _reportData?['total_debts_outstanding'] ?? 0.0;

    final double avgSales = double.tryParse(comparison?['average_sales']?.toString() ?? '0') ?? 0.0;
    final double avgExpenses = double.tryParse(comparison?['average_expenses']?.toString() ?? '0') ?? 0.0;
    final double avgNet = avgSales - avgExpenses;

    return RefreshIndicator(
      color: const Color(0xFF2B8A3E),
      onRefresh: _loadReport,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text("التقارير المالية", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF212529))),
          const SizedBox(height: 14),

          // Card 1: 📈 أرباح الدورة الحالية (فترة الشراء)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text("أرباح الدورة الحالية (فترة الشراء)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      SizedBox(width: 6),
                      Icon(Icons.trending_up, color: Color(0xFF2B8A3E), size: 20),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: const Color(0xFFFFF0F0), borderRadius: BorderRadius.circular(12)),
                          child: Column(
                            children: [
                              const Text("المصروفات والمشتريات", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                              const SizedBox(height: 4),
                              Text(formatCurrency(current['total_expenses']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.red)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: const Color(0xFFE6FCF5), borderRadius: BorderRadius.circular(12)),
                          child: Column(
                            children: [
                              const Text("إجمالي المبيعات والايرادات", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                              const SizedBox(height: 4),
                              Text(formatCurrency(current['total_sales']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF212529))),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE7F5FF),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFA5D8FF)),
                    ),
                    child: Column(
                      children: [
                        const Text("الأرباح الصافية لهذه الفترة", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1C7ED6))),
                        const Text("(الايرادات - المشتريات والمصروفات)", style: TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                        const SizedBox(height: 6),
                        Text(
                          "${formatCurrency(current['net_cashflow'])} ج.س",
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: (current['net_cashflow'] ?? 0) >= 0 ? const Color(0xFF2B8A3E) : Colors.red,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (current['start_date'] != null) ...[
                    const SizedBox(height: 10),
                    Center(
                      child: Text(
                        "تغطي الفترة من: ${current['start_date']} ${current['end_date'] != null ? 'إلى ${current['end_date']}' : 'إلى اليوم'}",
                        style: const TextStyle(fontSize: 11, color: Color(0xFF6C757D), fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Card 2: $ الديون القائمة (عند العملاء)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text("الديون القائمة (عند العملاء)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      SizedBox(width: 6),
                      Icon(Icons.attach_money, color: Color(0xFFD97706), size: 20),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    "${formatCurrency(totalDebts)} ج.س",
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.red),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Card 3: 📉 مقارنة فترات الشراء
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text("مقارنة فترات الشراء", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      SizedBox(width: 6),
                      Icon(Icons.trending_down, color: Color(0xFF1C7ED6), size: 20),
                    ],
                  ),
                  if (prevCycle != null) ...[
                    const SizedBox(height: 12),
                    const Text("الفترة السابقة (الدورة المنتهية):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF212529))),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFDEE2E6))),
                            child: Column(
                              children: [
                                const Text("المصروفات والمشتريات", style: TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                                const SizedBox(height: 2),
                                Text(formatCurrency(prevCycle['total_expenses']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.red)),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFDEE2E6))),
                            child: Column(
                              children: [
                                const Text("الإيرادات", style: TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                                const SizedBox(height: 2),
                                Text(formatCurrency(prevCycle['total_sales']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF212529))),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFDEE2E6))),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            "${formatCurrency(prevCycle['net_cashflow'])} ج.س",
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: (prevCycle['net_cashflow'] ?? 0) >= 0 ? const Color(0xFF2B8A3E) : Colors.red),
                          ),
                          const Text("صافي الربح:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF212529))),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text("النهاية: ${prevCycle['end_date'] ?? 'غير محدد'}", style: const TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                        Text("البداية: ${prevCycle['start_date'] ?? 'غير محدد'}", style: const TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                      ],
                    ),
                  ] else ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFDEE2E6))),
                      child: const Center(
                        child: Text(
                          "لا توجد دورات سابقة مسجلة للمقارنة حالياً.\nستظهر البيانات هنا بعد إغلاق دورتك الحالية.",
                          style: TextStyle(fontSize: 11, color: Color(0xFF6C757D)),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),

                  // Dark Navy Box: الأداء العام للنظام
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF212529),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      children: [
                        const Text(
                          "الأداء العام للنظام (متوسط فترات الشراء)",
                          style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: Colors.white.withOpacity(0.08), borderRadius: BorderRadius.circular(8)),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(formatCurrency(avgSales), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              const Text("متوسط الايرادات للدورة", style: TextStyle(color: Colors.white70, fontSize: 11)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: Colors.white.withOpacity(0.08), borderRadius: BorderRadius.circular(8)),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(formatCurrency(avgExpenses), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              const Text("متوسط المصروفات للدورة", style: TextStyle(color: Colors.white70, fontSize: 11)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              "${formatCurrency(avgNet)} ج.س",
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: avgNet >= 0 ? const Color(0xFF2B8A3E) : Colors.red,
                              ),
                            ),
                            const Text("متوسط صافي الربح", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          "هذا التقرير التراكمي يغني عن التقارير (الربع/نصف سنوية) لأنه يقيس كفاءة دورة رأس المال الخاص بك.",
                          style: TextStyle(color: Colors.white60, fontSize: 9),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
}
