import 'dart:convert';
import 'package:flutter/material.dart';
import '../../config/api_config.dart';
import '../../services/api_service.dart';
import '../../models/merchant_debt_model.dart';
import '../../database/local_db_helper.dart';

class MerchantDebtsScreen extends StatefulWidget {
  const MerchantDebtsScreen({super.key});

  @override
  State<MerchantDebtsScreen> createState() => _MerchantDebtsScreenState();
}

class _MerchantDebtsScreenState extends State<MerchantDebtsScreen> {
  List<MerchantDebtModel> _debts = [];
  bool _isLoading = true;
  final ApiService _api = ApiService();

  final List<Map<String, String>> _debtTypes = [
    {'key': 'goods', 'label': 'بضاعة (آجل)'},
    {'key': 'cash', 'label': 'نقدي (كاش)'},
    {'key': 'bank', 'label': 'تحويل بنكي (بنكك)'},
  ];

  @override
  void initState() {
    super.initState();
    _fetchMerchantDebts();
  }

  void _fetchMerchantDebts() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get(ApiConfig.merchantDebts);
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        final list = data.map((d) => MerchantDebtModel.fromJson(d)).toList();
        setState(() {
          _debts = list;
          _isLoading = false;
        });
        LocalDbHelper.instance.cacheMerchantDebts(list);
        return;
      }
    } catch (e) {
      debugPrint("Fetch merchant debts failed, loading cache: $e");
    }

    final cached = await LocalDbHelper.instance.getCachedMerchantDebts();
    setState(() {
      _debts = cached;
      _isLoading = false;
    });
  }

  void _showAddMerchantDebtDialog() {
    final supplierNameCtrl = TextEditingController();
    final supplierPhoneCtrl = TextEditingController();
    final totalAmountCtrl = TextEditingController();
    final descriptionCtrl = TextEditingController();
    String selectedDebtType = 'goods';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDState) => AlertDialog(
          title: const Text("إضافة دين مورد جديد", style: TextStyle(fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: supplierNameCtrl,
                  decoration: const InputDecoration(
                    labelText: "اسم المورد / الشركة",
                    prefixIcon: Icon(Icons.business),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedDebtType,
                  decoration: const InputDecoration(
                    labelText: "نوع الدين",
                    prefixIcon: Icon(Icons.category),
                  ),
                  items: _debtTypes.map((t) {
                    return DropdownMenuItem(
                      value: t['key'],
                      child: Text(t['label']!),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setDState(() => selectedDebtType = val);
                    }
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: supplierPhoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: "رقم هاتف المورد (اختياري)",
                    prefixIcon: Icon(Icons.phone),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: totalAmountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: "المبلغ المستحق (جنيه)",
                    prefixIcon: Icon(Icons.money),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descriptionCtrl,
                  decoration: const InputDecoration(
                    labelText: "ملاحظات / وصف البضاعة",
                    prefixIcon: Icon(Icons.notes),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("إلغاء"),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2B8A3E)),
              onPressed: () async {
                final amount = double.tryParse(totalAmountCtrl.text) ?? 0;
                if (supplierNameCtrl.text.trim().isEmpty || amount <= 0) return;
                Navigator.pop(ctx);

                final newDebt = MerchantDebtModel(
                  id: 'local_${DateTime.now().millisecondsSinceEpoch}',
                  supplierName: supplierNameCtrl.text.trim(),
                  supplierPhone: supplierPhoneCtrl.text.trim().isNotEmpty ? supplierPhoneCtrl.text.trim() : null,
                  debtType: selectedDebtType,
                  totalAmount: amount,
                  paidAmount: 0,
                  remainingAmount: amount,
                  status: 'unpaid',
                  description: descriptionCtrl.text.trim(),
                  isSynced: false,
                );

                try {
                  final res = await _api.post(ApiConfig.merchantDebts, {
                    'supplier_name': supplierNameCtrl.text.trim(),
                    'debt_type': selectedDebtType,
                    'total_amount': amount,
                    'description': descriptionCtrl.text.trim(),
                  });
                  if (res.statusCode == 200 || res.statusCode == 201) {
                    _fetchMerchantDebts();
                    return;
                  }
                  throw Exception("Status: ${res.statusCode}");
                } catch (e) {
                  await LocalDbHelper.instance.insertOfflineMerchantDebt(newDebt);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("تم حفظ دين المورد محلياً أوفلاين"),
                        backgroundColor: Colors.amber,
                      ),
                    );
                  }
                  _fetchMerchantDebts();
                }
              },
              child: const Text("حفظ الدين"),
            ),
          ],
        ),
      ),
    );
  }

  void _showPayDebtDialog(MerchantDebtModel debt) {
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("سداد للمورد: ${debt.supplierName}", style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("المبلغ المتبقي: ${debt.remainingAmount} ج.س", style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              controller: amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: "مبلغ السداد (جنيه)"),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteCtrl,
              decoration: const InputDecoration(labelText: "ملاحظات السداد"),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2B8A3E)),
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              if (amount <= 0 || amount > debt.remainingAmount) return;
              Navigator.pop(ctx);

              try {
                final res = await _api.post(ApiConfig.merchantDebtPay, {
                  'merchant_debt_id': debt.id,
                  'amount': amount,
                  'payment_method': 'cash',
                  'description': noteCtrl.text.trim(),
                });
                if (res.statusCode == 200) {
                  _fetchMerchantDebts();
                  return;
                }
              } catch (_) {}

              await LocalDbHelper.instance.addPendingSync('pay_merchant_debt', {
                'merchant_debt_id': debt.id,
                'amount': amount,
                'payment_method': 'cash',
                'description': noteCtrl.text.trim(),
              });
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("تم تسجيل السداد محلياً أوفلاين"), backgroundColor: Colors.amber),
                );
              }
              _fetchMerchantDebts();
            },
            child: const Text("تأكيد السداد"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalRemaining = _debts.fold<double>(0, (sum, item) => sum + item.remainingAmount);

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddMerchantDebtDialog,
        backgroundColor: const Color(0xFF2B8A3E),
        icon: const Icon(Icons.add_business),
        label: const Text("دين مورد جديد"),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2B8A3E)))
          : Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  color: Colors.red.shade50,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "إجمالي المستحق للموردين:",
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        "$totalRemaining ج.س",
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.red,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _debts.isEmpty
                      ? const Center(child: Text("لا توجد ديون موردين مسجلة عليك"))
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _debts.length,
                          itemBuilder: (ctx, i) {
                            final item = _debts[i];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: item.status == 'paid'
                                      ? Colors.green.shade100
                                      : Colors.red.shade100,
                                  child: Icon(
                                    Icons.local_shipping_outlined,
                                    color: item.status == 'paid'
                                      ? const Color(0xFF2B8A3E)
                                      : Colors.red.shade800,
                                  ),
                                ),
                                title: Text(
                                  item.supplierName,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                ),
                                subtitle: Text(
                                  "${item.debtTypeArabicName} • ${item.statusArabicName}\nإجمالي: ${item.totalAmount} | مسدد: ${item.paidAmount}",
                                ),
                                isThreeLine: true,
                                trailing: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      "${item.remainingAmount} ج.س",
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: item.remainingAmount > 0 ? Colors.red : const Color(0xFF2B8A3E),
                                      ),
                                    ),
                                    const Text("المتبقي", style: TextStyle(fontSize: 10, color: Colors.grey)),
                                  ],
                                ),
                                onTap: item.remainingAmount > 0 ? () => _showPayDebtDialog(item) : null,
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
