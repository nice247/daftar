import 'dart:convert';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/merchant_debt_model.dart';

class MerchantDebtsScreen extends StatefulWidget {
  const MerchantDebtsScreen({super.key});

  @override
  State<MerchantDebtsScreen> createState() => _MerchantDebtsScreenState();
}

class _MerchantDebtsScreenState extends State<MerchantDebtsScreen> {
  List<MerchantDebtModel> _debts = [];
  bool _isLoading = true;
  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();
    _fetchMerchantDebts();
  }

  void _fetchMerchantDebts() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get('/merchant-debts/');
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        setState(() {
          _debts = data.map((d) => MerchantDebtModel.fromJson(d)).toList();
          _isLoading = false;
        });
        return;
      }
    } catch (e) {
      debugPrint("Fetch merchant debts failed: $e");
    }
    setState(() => _isLoading = false);
  }

  void _showAddMerchantDebtDialog() {
    final supplierNameCtrl = TextEditingController();
    final supplierPhoneCtrl = TextEditingController();
    final totalAmountCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("إضافة مستحق/دين مورد جديد"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: supplierNameCtrl,
              decoration: const InputDecoration(labelText: "اسم المورد / الشركة"),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: supplierPhoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: "رقم هاتف المورد"),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: totalAmountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: "المبلغ المستحق (جنيه)"),
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
              final amount = double.tryParse(totalAmountCtrl.text) ?? 0;
              if (supplierNameCtrl.text.trim().isEmpty || amount <= 0) return;
              Navigator.pop(ctx);

              try {
                await _api.post('/merchant-debts/', {
                  'supplier_name': supplierNameCtrl.text.trim(),
                  'supplier_phone': supplierPhoneCtrl.text.trim(),
                  'total_amount': amount,
                });
                _fetchMerchantDebts();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("تعذر حفظ دين المورد")),
                  );
                }
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
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddMerchantDebtDialog,
        backgroundColor: const Color(0xFF059669),
        icon: const Icon(Icons.add_business),
        label: const Text("دين مورد جديد"),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _debts.isEmpty
              ? const Center(child: Text("لا توجد ديون موردين مسجلة عليك"))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _debts.length,
                  itemBuilder: (ctx, i) {
                    final item = _debts[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: Colors.blueAccent,
                          child: Icon(Icons.local_shipping, color: Colors.white),
                        ),
                        title: Text(
                          item.supplierName,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        subtitle: Text("الهاتف: ${item.supplierPhone ?? 'غير مدخل'}"),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              "${item.remainingAmount} ج.س",
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.red,
                              ),
                            ),
                            const Text("المتبقي للمورد", style: TextStyle(fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
