import 'dart:convert';
import 'package:flutter/material.dart';
import '../../config/api_config.dart';
import '../../services/api_service.dart';
import '../../models/expense_model.dart';
import '../../database/local_db_helper.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  List<ExpenseModel> _expenses = [];
  bool _isLoading = true;
  final ApiService _api = ApiService();

  final List<Map<String, String>> _categories = [
    {'key': 'RESTOCK', 'label': 'بضاعة (تجديد مخزون)'},
    {'key': 'BILL', 'label': 'فواتير (إيجار، كهرباء، ماء)'},
    {'key': 'OTHER', 'label': 'مصروفات عامة / أخرى'},
    {'key': 'MERCHANT_DEBT_PAY', 'label': 'سداد دين مورد'},
  ];

  @override
  void initState() {
    super.initState();
    _fetchExpenses();
  }

  void _fetchExpenses() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get(ApiConfig.expenses);
      if (res.statusCode == 200) {
        final dynamic decoded = jsonDecode(res.body);
        List<dynamic> expList = [];
        if (decoded is Map<String, dynamic> && decoded.containsKey('expenses')) {
          expList = decoded['expenses'] as List<dynamic>;
        } else if (decoded is List) {
          expList = decoded;
        }

        final list = expList.map((e) => ExpenseModel.fromJson(e)).toList();
        setState(() {
          _expenses = list;
          _isLoading = false;
        });
        LocalDbHelper.instance.cacheExpenses(list);
        return;
      }
    } catch (e) {
      debugPrint("Expenses fetch error, fallback to local cache: $e");
    }

    final cached = await LocalDbHelper.instance.getCachedExpenses();
    setState(() {
      _expenses = cached;
      _isLoading = false;
    });
  }

  void _showAddExpenseDialog() {
    final amountCtrl = TextEditingController();
    String selectedCategory = 'OTHER';
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDState) => AlertDialog(
          title: const Text("إضافة مصروف جديد", style: TextStyle(fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: "المبلغ (جنيه)",
                  prefixIcon: Icon(Icons.money),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: selectedCategory,
                decoration: const InputDecoration(
                  labelText: "فئة المصروف",
                  prefixIcon: Icon(Icons.category),
                ),
                items: _categories.map((cat) {
                  return DropdownMenuItem(
                    value: cat['key'],
                    child: Text(cat['label']!),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setDState(() => selectedCategory = val);
                  }
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                decoration: const InputDecoration(
                  labelText: "ملاحظات / بيان المصروف",
                  prefixIcon: Icon(Icons.notes),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("إلغاء"),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2B8A3E)),
              onPressed: () async {
                final amount = double.tryParse(amountCtrl.text) ?? 0;
                if (amount <= 0) return;
                Navigator.pop(ctx);

                final newExpense = ExpenseModel(
                  id: 0,
                  amount: amount,
                  category: selectedCategory,
                  note: noteCtrl.text.trim(),
                  date: DateTime.now().toIso8601String().split('T')[0],
                  isSynced: false,
                );

                try {
                  final res = await _api.post(ApiConfig.expenses, {
                    'amount': amount,
                    'category': selectedCategory,
                    'description': noteCtrl.text.trim(),
                  });
                  if (res.statusCode == 200 || res.statusCode == 201) {
                    _fetchExpenses();
                    return;
                  }
                  throw Exception("Server status: ${res.statusCode}");
                } catch (e) {
                  await LocalDbHelper.instance.insertOfflineExpense(newExpense);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("تم حفظ المصروف محلياً (أوفلاين) وسيتم مزامنته تلقائياً"),
                        backgroundColor: Colors.amber,
                      ),
                    );
                  }
                  _fetchExpenses();
                }
              },
              child: const Text("حفظ المصروف"),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalExpenses = _expenses.fold<double>(0, (sum, item) => sum + item.amount);

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddExpenseDialog,
        backgroundColor: const Color(0xFF2B8A3E),
        icon: const Icon(Icons.add),
        label: const Text("مصروف جديد"),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2B8A3E)))
          : Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  color: const Color(0xFF2B8A3E).withOpacity(0.08),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "إجمالي المصروفات:",
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        "$totalExpenses ج.س",
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF2B8A3E),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _expenses.isEmpty
                      ? const Center(child: Text("لا توجد مصروفات مسجلة"))
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _expenses.length,
                          itemBuilder: (ctx, i) {
                            final item = _expenses[i];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: item.category == 'RESTOCK'
                                      ? Colors.blue.shade100
                                      : Colors.orange.shade100,
                                  child: Icon(
                                    item.category == 'RESTOCK'
                                        ? Icons.inventory_2_outlined
                                        : Icons.receipt_long_outlined,
                                    color: item.category == 'RESTOCK'
                                        ? Colors.blue.shade800
                                        : Colors.orange.shade800,
                                  ),
                                ),
                                title: Text(
                                  "${item.amount} ج.س",
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                ),
                                subtitle: Text("${item.categoryArabicName} • ${item.date}"),
                                trailing: item.note != null && item.note!.isNotEmpty
                                    ? Text(
                                        item.note!,
                                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                                      )
                                    : null,
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
