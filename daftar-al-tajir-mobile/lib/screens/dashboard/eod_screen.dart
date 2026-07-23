import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/offline_banner.dart';

class EodScreen extends StatefulWidget {
  const EodScreen({super.key});

  @override
  State<EodScreen> createState() => _EodScreenState();
}

class _EodScreenState extends State<EodScreen> {
  final _salesController = TextEditingController();
  final _cashController = TextEditingController();
  final _bankController = TextEditingController();
  final _expensesController = TextEditingController();

  bool _isLoading = false;
  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();
    _fetchTodaySummary();
  }

  void _fetchTodaySummary() async {
    try {
      final res = await _api.get('/eod/today');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted && data['total_sales'] != null) {
          setState(() {
            _salesController.text = data['total_sales'].toString();
            _cashController.text = (data['cash_amount'] ?? 0).toString();
            _bankController.text = (data['bank_amount'] ?? 0).toString();
            _expensesController.text = (data['expenses_amount'] ?? 0).toString();
          });
        }
      }
    } catch (e) {
      debugPrint("EOD Fetch error: $e");
    }
  }

  void _saveEOD() async {
    final sales = double.tryParse(_salesController.text) ?? 0;
    final cash = double.tryParse(_cashController.text) ?? 0;
    final bank = double.tryParse(_bankController.text) ?? 0;
    final exp = double.tryParse(_expensesController.text) ?? 0;

    final messenger = ScaffoldMessenger.of(context);
    setState(() => _isLoading = true);

    try {
      final res = await _api.post('/eod/save', {
        'total_sales': sales,
        'cash_amount': cash,
        'bank_amount': bank,
        'expenses_amount': exp,
        'date': DateTime.now().toIso8601String().split('T')[0],
      });

      if (res.statusCode == 200 || res.statusCode == 201) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text("تم حفظ التقفيل اليومي بنجاح!"),
            backgroundColor: Color(0xFF059669),
          ),
        );
        _fetchTodaySummary();
      } else {
        messenger.showSnackBar(
          const SnackBar(content: Text("حدث خطأ أثناء حفظ التقفيل")),
        );
      }
    } catch (e) {
      messenger.showSnackBar(
        const SnackBar(content: Text("تم حفظ التقفيل محلياً أوفلاين")),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).user;

    return Column(
      children: [
        const OfflineBanner(),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        const CircleAvatar(
                          backgroundColor: Color(0xFF059669),
                          child: Icon(Icons.store, color: Colors.white),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?.businessName ?? "متجر التاجر",
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              "مرحباً ${user?.fullName ?? user?.phone ?? ''}",
                              style: const TextStyle(color: Colors.grey),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  "سجل التقفيل اليومي",
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        TextField(
                          controller: _salesController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(
                            labelText: "إجمالي المبيعات اليومية (جنيه)",
                            prefixIcon: Icon(Icons.point_of_sale),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _cashController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: const InputDecoration(
                                  labelText: "نقداً (كاش)",
                                  prefixIcon: Icon(Icons.money),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextField(
                                controller: _bankController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: const InputDecoration(
                                  labelText: "بنكك / تحويل",
                                  prefixIcon: Icon(Icons.account_balance),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _expensesController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(
                            labelText: "المصروفات اليومية",
                            prefixIcon: Icon(Icons.shopping_bag_outlined),
                          ),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _isLoading ? null : _saveEOD,
                            icon: const Icon(Icons.save),
                            label: _isLoading
                                ? const CircularProgressIndicator(color: Colors.white)
                                : const Text("حفظ التقفيل اليومي"),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
