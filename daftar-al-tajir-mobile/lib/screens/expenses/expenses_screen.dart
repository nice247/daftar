import 'dart:convert';
import 'package:flutter/material.dart';
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

  @override
  void initState() {
    super.initState();
    _fetchExpenses();
  }

  void _fetchExpenses() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get('/expenses/');
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        final list = data.map((e) => ExpenseModel.fromJson(e)).toList();
        setState(() {
          _expenses = list;
          _isLoading = false;
        });
        LocalDbHelper.instance.cacheExpenses(list);
        return;
      }
    } catch (e) {
      debugPrint("Expenses fetch error, fallback to cache");
    }

    final cached = await LocalDbHelper.instance.getCachedExpenses();
    setState(() {
      _expenses = cached;
      _isLoading = false;
    });
  }

  void _showAddExpenseDialog() {
    final amountCtrl = TextEditingController();
    final categoryCtrl = TextEditingController(text: "عام");
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("إضافة مصروف جديد"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: "المبلغ (جنيه)"),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: categoryCtrl,
              decoration: const InputDecoration(labelText: "الفئة (إيجار، كهرباء، بضاعة...)"),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteCtrl,
              decoration: const InputDecoration(labelText: "ملاحظات"),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("إلغاء"),
          ),
          ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              if (amount <= 0) return;
              Navigator.pop(ctx);

              final newExpense = ExpenseModel(
                id: 0,
                amount: amount,
                category: categoryCtrl.text.trim(),
                note: noteCtrl.text.trim(),
                date: DateTime.now().toIso8601String().split('T')[0],
              );

              try {
                await _api.post('/expenses/', newExpense.toJson());
                _fetchExpenses();
              } catch (e) {
                await LocalDbHelper.instance.insertOfflineExpense(newExpense);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("تم حفظ المصروف محلياً أوفلاين")),
                );
                _fetchExpenses();
              }
            },
            child: const Text("حفظ"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalExpenses = _expenses.fold<double>(0, (sum, item) => sum + item.amount);

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddExpenseDialog,
        backgroundColor: const Color(0xFF059669),
        icon: const Icon(Icons.add),
        label: const Text("مصروف جديد"),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  color: const Color(0xFF059669).withOpacity(0.1),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "إجمالي المصروفات المسجلة:",
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        "$totalExpenses ج.س",
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF059669),
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
                                leading: const CircleAvatar(
                                  backgroundColor: Colors.orangeAccent,
                                  child: Icon(Icons.money_off, color: Colors.white),
                                ),
                                title: Text(
                                  "${item.amount} ج.س",
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                                subtitle: Text("${item.category} • ${item.date}"),
                                trailing: item.note != null && item.note!.isNotEmpty
                                    ? Text(item.note!, style: const TextStyle(color: Colors.grey))
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
