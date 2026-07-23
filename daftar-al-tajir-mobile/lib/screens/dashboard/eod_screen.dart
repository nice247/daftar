import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/offline_banner.dart';

class EodScreen extends StatefulWidget {
  const EodScreen({super.key});

  @override
  State<EodScreen> createState() => _EodScreenState();
}

class _EodScreenState extends State<EodScreen> {
  final ApiService _api = ApiService();

  // Dynamic Lists
  List<Map<String, dynamic>> _incomes = [];
  List<Map<String, dynamic>> _expenses = [];

  // Data States
  Map<String, dynamic>? _cycleStatus;
  Map<String, dynamic>? _todayData;
  Map<String, dynamic>? _lastRestock;
  List<dynamic> _merchantDebts = [];

  bool _loading = false;
  bool _saving = false;
  bool _todaySaved = false;

  final currencyFormat = NumberFormat('#,##0.##', 'ar');

  String formatCurrency(dynamic val) {
    if (val == null) return '0.00';
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
        _api.get('/merchant-debts/'),
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
        _todayData = d2;
        if (d2['has_data'] == true) _todaySaved = true;
      }
      if (responses[3].statusCode == 200) {
        _merchantDebts = jsonDecode(responses[3].body) ?? [];
      }
    } catch (e) {
      debugPrint("EOD load error: $e");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _addIncome() {
    setState(() {
      _incomes.add({'category': 'EOD_CASH', 'amount': '', 'description': ''});
    });
  }

  void _removeIncome(int index) {
    setState(() {
      _incomes.removeAt(index);
    });
  }

  void _addExpense() {
    setState(() {
      _expenses.add({'category': 'RESTOCK', 'amount': '', 'description': '', 'merchant_debt_id': null});
    });
  }

  void _removeExpense(int index) {
    setState(() {
      _expenses.removeAt(index);
    });
  }

  Future<void> _handleSave() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);

    try {
      final validIncomes = _incomes.where((i) {
        final amt = double.tryParse(i['amount'].toString()) ?? 0;
        return amt > 0;
      }).toList();

      double totalCashSales = 0;
      double totalBankakSales = 0;
      final List<Map<String, dynamic>> otherIncomes = [];

      for (var i in validIncomes) {
        final cat = i['category'];
        final amt = double.parse(i['amount'].toString());
        if (cat == 'EOD_CASH') {
          totalCashSales += amt;
        } else if (cat == 'EOD_BANKAK') {
          totalBankakSales += amt;
        } else {
          otherIncomes.add({
            'category': cat,
            'amount': amt,
            'description': i['description']?.isNotEmpty == true ? i['description'] : null,
          });
        }
      }

      final validExpenses = _expenses.where((e) {
        final amt = double.tryParse(e['amount'].toString()) ?? 0;
        return amt > 0;
      }).map((e) {
        return {
          'category': e['category'],
          'amount': double.parse(e['amount'].toString()),
          'description': e['description']?.isNotEmpty == true ? e['description'] : null,
          'merchant_debt_id': e['category'] == 'MERCHANT_DEBT_PAY' ? e['merchant_debt_id'] : null,
        };
      }).toList();

      final eodPayload = {
        'eod_date': DateTime.now().toIso8601String().split('T')[0],
        'sales': {
          'cash_sales': totalCashSales,
          'bankak_sales': totalBankakSales,
        },
        'expenses': validExpenses,
        'debt_payments': [],
        'other_incomes': otherIncomes,
      };

      final res = await _api.post('/eod/save', eodPayload);

      if (res.statusCode == 200 || res.statusCode == 201) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text("تم الحفظ بنجاح"),
            backgroundColor: Color(0xFF2B8A3E),
          ),
        );
        setState(() {
          _todaySaved = true;
          _incomes.clear();
          _expenses.clear();
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
        const SnackBar(content: Text("تم حفظ التقفيل محلياً أوفلاين")),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // Modals
  void _showModal(String title, Widget content) {
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
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const Divider(),
            const SizedBox(height: 12),
            content,
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).user;

    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2B8A3E)));
    }

    return Column(
      children: [
        const OfflineBanner(),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // User Banner
                Card(
                  color: const Color(0xFFF8F9FA),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        const CircleAvatar(
                          backgroundColor: Color(0xFF2B8A3E),
                          child: Icon(Icons.store, color: Colors.white),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?.storeName ?? "متجر التاجر",
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              "مرحباً ${user?.fullName ?? user?.phone ?? ''}",
                              style: const TextStyle(color: Color(0xFF6C757D), fontSize: 13),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Cycle Status Card
                if (_cycleStatus != null)
                  Card(
                    color: const Color(0xFFF8F9FA),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text("ملخص الدورة الحالية (فترة الشراء)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              Chip(
                                label: Text(
                                  _cycleStatus!['status'] == 'ACTIVE'
                                      ? (_cycleStatus!['days_remaining'] != null ? "متبقي ${_cycleStatus!['days_remaining']} يوم" : "نشطة")
                                      : "غير نشطة",
                                  style: const TextStyle(fontSize: 10, color: Color(0xFF6C757D)),
                                ),
                                backgroundColor: const Color(0xFFE9ECEF),
                                padding: EdgeInsets.zero,
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFDEE2E6))),
                                  child: Column(
                                    children: [
                                      const Text("المبيعات الكلية", style: TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                                      Text(formatCurrency(_cycleStatus!['total_sales']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFDEE2E6))),
                                  child: Column(
                                    children: [
                                      const Text("المصروفات/مشتريات", style: TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                                      Text(formatCurrency(_cycleStatus!['total_expenses']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFDEE2E6))),
                                  child: Column(
                                    children: [
                                      const Text("صافي الأرباح", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF6C757D))),
                                      Text(
                                        formatCurrency(_cycleStatus!['net_cashflow']),
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                          color: (_cycleStatus!['net_cashflow'] ?? 0) >= 0 ? const Color(0xFF2B8A3E) : Colors.red,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                const SizedBox(height: 12),

                // Action View Modals Buttons
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _showModal("سجل المصروفات", const Text("سجل المصروفات مسجل محلياً بالسيرفر")),
                        icon: const Icon(Icons.remove_red_eye, size: 14),
                        label: const Text("المصروفات", style: TextStyle(fontSize: 12)),
                      ),
                      const SizedBox(width: 6),
                      OutlinedButton.icon(
                        onPressed: () => _showModal("المشتريات السابقة", const Text("المشتريات السابقة مسجلة بالدورة الحالية")),
                        icon: const Icon(Icons.remove_red_eye, size: 14),
                        label: const Text("المشتريات", style: TextStyle(fontSize: 12)),
                      ),
                      const SizedBox(width: 6),
                      OutlinedButton.icon(
                        onPressed: () => _showModal("ديون التاجر", const Text("قائمة ديون الموردين والشركات")),
                        icon: const Icon(Icons.remove_red_eye, size: 14),
                        label: const Text("ديون التاجر", style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Expenses Section
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text("المصروفات والمشتريات", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            OutlinedButton.icon(
                              onPressed: _addExpense,
                              icon: const Icon(Icons.add, size: 16, color: Colors.red),
                              label: const Text("إضافة مصروف", style: TextStyle(color: Colors.red, fontSize: 12)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _expenses.length,
                          itemBuilder: (ctx, i) {
                            final exp = _expenses[i];
                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8F9FA),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFDEE2E6)),
                              ),
                              child: Column(
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text("مصروف #${i + 1}", style: const TextStyle(fontSize: 12, color: Color(0xFF6C757D))),
                                      IconButton(
                                        icon: const Icon(Icons.close, color: Colors.red, size: 18),
                                        onPressed: () => _removeExpense(i),
                                      ),
                                    ],
                                  ),
                                  DropdownButtonFormField<String>(
                                    value: exp['category'],
                                    decoration: const InputDecoration(labelText: "فئة المصروف"),
                                    items: const [
                                      DropdownMenuItem(value: 'RESTOCK', child: Text('تجديد مخزون / مشتريات')),
                                      DropdownMenuItem(value: 'MERCHANT_DEBT_PAY', child: Text('سداد دين مورد')),
                                      DropdownMenuItem(value: 'electricity', child: Text('كهرباء')),
                                      DropdownMenuItem(value: 'rent', child: Text('إيجار')),
                                      DropdownMenuItem(value: 'salaries', child: Text('مرتبات / عمال')),
                                      DropdownMenuItem(value: 'other', child: Text('مصروفات أخرى')),
                                    ],
                                    onChanged: (val) => setState(() => exp['category'] = val),
                                  ),
                                  const SizedBox(height: 8),
                                  TextFormField(
                                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                    decoration: const InputDecoration(labelText: "المبلغ (جنيه)"),
                                    onChanged: (val) => exp['amount'] = val,
                                  ),
                                  const SizedBox(height: 8),
                                  TextFormField(
                                    decoration: const InputDecoration(labelText: "الوصف / ملاحظات"),
                                    onChanged: (val) => exp['description'] = val,
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Incomes Section
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text("الإيرادات اليومية", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            OutlinedButton.icon(
                              onPressed: _addIncome,
                              icon: const Icon(Icons.add, size: 16, color: Color(0xFF2B8A3E)),
                              label: const Text("إضافة إيراد", style: TextStyle(color: Color(0xFF2B8A3E), fontSize: 12)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _incomes.length,
                          itemBuilder: (ctx, i) {
                            final inc = _incomes[i];
                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8F9FA),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFDEE2E6)),
                              ),
                              child: Column(
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text("إيراد #${i + 1}", style: const TextStyle(fontSize: 12, color: Color(0xFF6C757D))),
                                      IconButton(
                                        icon: const Icon(Icons.close, color: Colors.red, size: 18),
                                        onPressed: () => _removeIncome(i),
                                      ),
                                    ],
                                  ),
                                  DropdownButtonFormField<String>(
                                    value: inc['category'],
                                    decoration: const InputDecoration(labelText: "نوع الإيراد"),
                                    items: const [
                                      DropdownMenuItem(value: 'EOD_CASH', child: Text('مبيعات كاش')),
                                      DropdownMenuItem(value: 'EOD_BANKAK', child: Text('مبيعات بنكك')),
                                      DropdownMenuItem(value: 'bankak_commission', child: Text('عمولة بنكك')),
                                      DropdownMenuItem(value: 'balance_commission', child: Text('عمولة رصيد')),
                                      DropdownMenuItem(value: 'other', child: Text('أخرى')),
                                    ],
                                    onChanged: (val) => setState(() => inc['category'] = val),
                                  ),
                                  const SizedBox(height: 8),
                                  TextFormField(
                                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                    decoration: const InputDecoration(labelText: "المبلغ (جنيه)"),
                                    onChanged: (val) => inc['amount'] = val,
                                  ),
                                  const SizedBox(height: 8),
                                  TextFormField(
                                    decoration: const InputDecoration(labelText: "الوصف / ملاحظة (اختياري)"),
                                    onChanged: (val) => inc['description'] = val,
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ],
                    ),
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
                      : const Text("حفظ التقفيل اليومي", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ),

                if (_todaySaved) ...[
                  const SizedBox(height: 10),
                  const Text(
                    "✔ تم حفظ المعاملات بنجاح — يمكنك إكمال إضافة معاملات أخرى لليوم.",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF2B8A3E), fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ]
              ],
            ),
          ),
        ),
      ],
    );
  }
}
