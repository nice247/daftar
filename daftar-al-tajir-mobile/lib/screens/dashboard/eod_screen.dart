import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../providers/auth_provider.dart';

class EodScreen extends StatefulWidget {
  const EodScreen({super.key});

  @override
  State<EodScreen> createState() => _EodScreenState();
}

class _EodScreenState extends State<EodScreen> {
  final ApiService _api = ApiService();

  // Inputs
  final TextEditingController _cashSalesCtrl = TextEditingController();
  final TextEditingController _bankakSalesCtrl = TextEditingController();

  final List<Map<String, dynamic>> _merchantDebtsReceived = [];
  final List<Map<String, dynamic>> _expenses = [];
  final List<Map<String, dynamic>> _customerDebtPayments = [];
  final List<Map<String, dynamic>> _otherIncomes = [];

  // Data States
  Map<String, dynamic>? _cycleStatus;
  Map<String, dynamic>? _lastRestock;
  bool _loading = false;
  bool _saving = false;
  bool _todaySaved = false;

  final currencyFormat = NumberFormat('#,##0.##', 'ar');

  String formatCurrency(dynamic val) {
    if (val == null) return '0';
    final numVal = double.tryParse(val.toString()) ?? 0.0;
    return currencyFormat.format(numVal);
  }

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final responses = await Future.wait([
        _api.get('/eod/last-restock'),
        _api.get('/eod/cycle-status'),
        _api.get('/eod/today'),
      ]);

      if (responses[0].statusCode == 200) {
        final d0 = jsonDecode(responses[0].body);
        if (d0['date'] != null) _lastRestock = d0;
      }
      if (responses[1].statusCode == 200) {
        _cycleStatus = jsonDecode(responses[1].body);
      }
      if (responses[2].statusCode == 200) {
        final d2 = jsonDecode(responses[2].body);
        if (d2['has_data'] == true) _todaySaved = true;
      }
    } catch (e) {
      debugPrint("EOD load error: $e");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _totalSales =>
      (double.tryParse(_cashSalesCtrl.text) ?? 0) +
      (double.tryParse(_bankakSalesCtrl.text) ?? 0);

  double get _totalMerchantDebts => _merchantDebtsReceived.fold(
      0.0, (sum, i) => sum + (double.tryParse(i['amount'].toString()) ?? 0));

  double get _totalExpenses => _expenses.fold(
      0.0, (sum, i) => sum + (double.tryParse(i['amount'].toString()) ?? 0));

  double get _totalCustomerPayments => _customerDebtPayments.fold(
      0.0, (sum, i) => sum + (double.tryParse(i['amount'].toString()) ?? 0));

  double get _totalOtherIncome => _otherIncomes.fold(
      0.0, (sum, i) => sum + (double.tryParse(i['amount'].toString()) ?? 0));

  double get _totalIncomesAll =>
      _totalSales + _totalOtherIncome + _totalMerchantDebts + _totalCustomerPayments;

  double get _netDailyProfit => _totalIncomesAll - _totalExpenses;

  Future<void> _handleSave() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);

    try {
      final cashSales = double.tryParse(_cashSalesCtrl.text) ?? 0;
      final bankakSales = double.tryParse(_bankakSalesCtrl.text) ?? 0;

      final formattedExpenses = _expenses.where((e) {
        final amt = double.tryParse(e['amount'].toString()) ?? 0;
        return amt > 0;
      }).map((e) {
        return {
          'category': e['category'] ?? 'RESTOCK',
          'amount': double.parse(e['amount'].toString()),
          'description': e['description']?.isNotEmpty == true ? e['description'] : null,
        };
      }).toList();

      final formattedOtherIncomes = _otherIncomes.where((i) {
        final amt = double.tryParse(i['amount'].toString()) ?? 0;
        return amt > 0;
      }).map((i) {
        return {
          'category': i['category'] ?? 'other',
          'amount': double.parse(i['amount'].toString()),
          'description': i['description']?.isNotEmpty == true ? i['description'] : null,
        };
      }).toList();

      final eodPayload = {
        'eod_date': DateTime.now().toIso8601String().split('T')[0],
        'sales': {
          'cash_sales': cashSales,
          'bankak_sales': bankakSales,
        },
        'expenses': formattedExpenses,
        'debt_payments': [],
        'other_incomes': formattedOtherIncomes,
      };

      final res = await _api.post('/eod/save', eodPayload);

      if (res.statusCode == 200 || res.statusCode == 201) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text("تم حفظ اليومية بنجاح"),
            backgroundColor: Color(0xFF2B8A3E),
          ),
        );
        setState(() {
          _todaySaved = true;
          _cashSalesCtrl.clear();
          _bankakSalesCtrl.clear();
          _merchantDebtsReceived.clear();
          _expenses.clear();
          _customerDebtPayments.clear();
          _otherIncomes.clear();
        });
        _loadData();
      } else {
        final errData = jsonDecode(res.body);
        messenger.showSnackBar(
          SnackBar(content: Text(errData['detail'] ?? "حدث خطأ في الحفظ")),
        );
      }
    } catch (e) {
      messenger.showSnackBar(
        const SnackBar(content: Text("تم حفظ اليومية محلياً أوفلاين")),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showViewModal(String title, List<Widget> children) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2B8A3E)));
    }

    final isExpired = _cycleStatus?['status'] == 'EXPIRED' ||
        (_cycleStatus?['days_remaining'] ?? 0) <= 0;

    final displaySales = isExpired ? 0.0 : (_cycleStatus?['total_sales'] ?? 0.0);
    final displayExpenses = isExpired ? 0.0 : (_cycleStatus?['total_expenses'] ?? 0.0);
    final displayNet = isExpired ? 0.0 : (_cycleStatus?['net_cashflow'] ?? 0.0);
    final remainingDays = isExpired ? 0 : (_cycleStatus?['days_remaining'] ?? 0);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Green Hero Card: ملخص الدورة الحالية
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF2B8A3E),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        "متبقي $remainingDays يوم",
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const Text(
                      "ملخص الدورة الحالية (فترة الشراء)",
                      style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Column(
                          children: [
                            const Text("صافي الأرباح", style: TextStyle(color: Colors.white70, fontSize: 10)),
                            const SizedBox(height: 4),
                            Text(formatCurrency(displayNet), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Column(
                          children: [
                            const Text("المصروفات/مشتريات", style: TextStyle(color: Colors.white70, fontSize: 10)),
                            const SizedBox(height: 4),
                            Text(formatCurrency(displayExpenses), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Column(
                          children: [
                            const Text("المبيعات الكلية", style: TextStyle(color: Colors.white70, fontSize: 10)),
                            const SizedBox(height: 4),
                            Text(formatCurrency(displaySales), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // 3 Action Pills: المصروفات | المشتريات | ديون التاجر
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _showViewModal("سجل المصروفات", [const Text("لا توجد مصروفات مسجلة لليوم")]),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFF0F0),
                    foregroundColor: const Color(0xFFC92A2A),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  icon: const Icon(Icons.remove_red_eye, size: 14),
                  label: const Text("المصروفات", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _showViewModal("المشتريات السابقة", [const Text("المشتريات المسجلة بجدول المخزون")]),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFF9DB),
                    foregroundColor: const Color(0xFFD97706),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  icon: const Icon(Icons.remove_red_eye, size: 14),
                  label: const Text("المشتريات", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _showViewModal("ديون التاجر", [const Text("قائمة ديون الشركات والموردين")]),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE7F5FF),
                    foregroundColor: const Color(0xFF1C7ED6),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  icon: const Icon(Icons.remove_red_eye, size: 14),
                  label: const Text("ديون التاجر", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Card: آخر عملية شراء (تجديد مخزون)
          if (_lastRestock != null)
            Card(
              color: const Color(0xFFFFF9DB),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: Color(0xFFFFEC99)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(color: Color(0xFFFFE066), shape: BoxShape.circle),
                      child: const Icon(Icons.card_giftcard, color: Color(0xFFD97706), size: 20),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text("آخر عملية شراء (تجديد مخزون)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
                        const SizedBox(height: 2),
                        Text("${formatCurrency(_lastRestock!['amount'])} ج.س", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF212529))),
                        Text("بتاريخ: ${_lastRestock!['date'] ?? ''}", style: const TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                      ],
                    ),
                  ],
                ),
              ),
            ),

          const SizedBox(height: 16),

          // Section 1: 🛒 المبيعات والإيرادات
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: const Color(0xFFE6FCF5), borderRadius: BorderRadius.circular(12)),
                        child: Text("الإيرادات الكلية لليوم: ${formatCurrency(_totalSales)} ج.س", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2B8A3E))),
                      ),
                      const Row(
                        children: [
                          Text("المبيعات والإيرادات", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          SizedBox(width: 6),
                          Icon(Icons.shopping_cart_outlined, color: Color(0xFF2B8A3E), size: 20),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Text("المبيعات النقدية (الكاش في الدرج)", style: TextStyle(fontSize: 12, color: Color(0xFF6C757D))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _cashSalesCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(hintText: "0"),
                  ),
                  const SizedBox(height: 12),
                  const Text("مبيعات بنكك (تحويلات)", style: TextStyle(fontSize: 12, color: Color(0xFF6C757D))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _bankakSalesCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(hintText: "0"),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Section 2: 📈 ديون مستلمة (ديون على التاجر)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () {
                          setState(() {
                            _merchantDebtsReceived.add({'amount': '', 'description': ''});
                          });
                        },
                        icon: const Icon(Icons.add, size: 14, color: Color(0xFF2B8A3E)),
                        label: const Text("+ إضافة دين", style: TextStyle(color: Color(0xFF2B8A3E), fontSize: 11)),
                      ),
                      const Row(
                        children: [
                          Text("ديون مستلمة (ديون على التاجر)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          SizedBox(width: 6),
                          Icon(Icons.trending_up, color: Color(0xFF2B8A3E), size: 18),
                        ],
                      ),
                    ],
                  ),
                  ..._merchantDebtsReceived.asMap().entries.map((entry) {
                    final i = entry.key;
                    final item = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          IconButton(icon: const Icon(Icons.close, color: Colors.red, size: 18), onPressed: () => setState(() => _merchantDebtsReceived.removeAt(i))),
                          Expanded(
                            child: TextField(
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(hintText: "المبلغ"),
                              onChanged: (v) => setState(() => item['amount'] = v),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Section 3: 💳 المصروفات والمشتريات
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () {
                          setState(() {
                            _expenses.add({'category': 'RESTOCK', 'amount': '', 'description': ''});
                          });
                        },
                        style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.red)),
                        icon: const Icon(Icons.add, size: 14, color: Colors.red),
                        label: const Text("+ إضافة مصروف", style: TextStyle(color: Colors.red, fontSize: 11)),
                      ),
                      const Row(
                        children: [
                          Text("المصروفات والمشتريات", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          SizedBox(width: 6),
                          Icon(Icons.credit_card, color: Colors.red, size: 18),
                        ],
                      ),
                    ],
                  ),
                  ..._expenses.asMap().entries.map((entry) {
                    final i = entry.key;
                    final item = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          IconButton(icon: const Icon(Icons.close, color: Colors.red, size: 18), onPressed: () => setState(() => _expenses.removeAt(i))),
                          Expanded(
                            child: TextField(
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(hintText: "المبلغ (جنيه)"),
                              onChanged: (v) => setState(() => item['amount'] = v),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Section 4: 💲 سداد ديون العملاء
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () {
                          setState(() {
                            _customerDebtPayments.add({'amount': '', 'customer': ''});
                          });
                        },
                        icon: const Icon(Icons.add, size: 14, color: Color(0xFF2B8A3E)),
                        label: const Text("+ إضافة سداد", style: TextStyle(color: Color(0xFF2B8A3E), fontSize: 11)),
                      ),
                      const Row(
                        children: [
                          Text("سداد ديون العملاء", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          SizedBox(width: 6),
                          Icon(Icons.attach_money, color: Color(0xFF2B8A3E), size: 18),
                        ],
                      ),
                    ],
                  ),
                  const Text("ديون قام العملاء بتسديدها اليوم.", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                  ..._customerDebtPayments.asMap().entries.map((entry) {
                    final i = entry.key;
                    final item = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          IconButton(icon: const Icon(Icons.close, color: Colors.red, size: 18), onPressed: () => setState(() => _customerDebtPayments.removeAt(i))),
                          Expanded(
                            child: TextField(
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(hintText: "المبلغ المسدد"),
                              onChanged: (v) => setState(() => item['amount'] = v),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Section 5: 📈 إيرادات أخرى إضافية
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () {
                          setState(() {
                            _otherIncomes.add({'category': 'bankak_commission', 'amount': '', 'description': ''});
                          });
                        },
                        icon: const Icon(Icons.add, size: 14, color: Color(0xFF2B8A3E)),
                        label: const Text("+ إضافة إيراد", style: TextStyle(color: Color(0xFF2B8A3E), fontSize: 11)),
                      ),
                      const Row(
                        children: [
                          Text("إيرادات أخرى إضافية", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          SizedBox(width: 6),
                          Icon(Icons.trending_up, color: Color(0xFF2B8A3E), size: 18),
                        ],
                      ),
                    ],
                  ),
                  ..._otherIncomes.asMap().entries.map((entry) {
                    final i = entry.key;
                    final item = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          IconButton(icon: const Icon(Icons.close, color: Colors.red, size: 18), onPressed: () => setState(() => _otherIncomes.removeAt(i))),
                          Expanded(
                            child: TextField(
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(hintText: "المبلغ"),
                              onChanged: (v) => setState(() => item['amount'] = v),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Section 6: ملخص اليومية (Green Border Card)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF2B8A3E), width: 2),
            ),
            child: Column(
              children: [
                const Text("ملخص اليومية", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("${formatCurrency(_totalIncomesAll)} ج.س", style: const TextStyle(fontWeight: FontWeight.bold)),
                    const Text("الإيرادات الكلية (مبيعات + إيرادات أخرى + ديون مستلمة)", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("(${formatCurrency(_totalExpenses)}) ج.س", style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
                    const Text("إجمالي المصروفات (والمشتريات)", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(color: Color(0xFFDEE2E6)),
                ),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE6FCF5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("${formatCurrency(_netDailyProfit)} ج.س", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF2B8A3E))),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text("صافي الأرباح (اليوم)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF2B8A3E))),
                          Text("(الإيرادات الكلية - المصروفات)", style: TextStyle(fontSize: 9, color: Color(0xFF6C757D))),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Save Button
          ElevatedButton.icon(
            onPressed: _saving ? null : _handleSave,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2B8A3E),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            icon: const Icon(Icons.save, size: 22),
            label: _saving
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text("حفظ اليومية / التقفيل اليومي", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),

          if (_todaySaved) ...[
            const SizedBox(height: 10),
            const Text(
              "✔ تم حفظ المعاملات بنجاح — يمكنك إكمال إضافة معاملات أخرى لليوم.",
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF2B8A3E), fontWeight: FontWeight.bold, fontSize: 12),
            ),
          ]
        ],
      ),
    );
  }
}
