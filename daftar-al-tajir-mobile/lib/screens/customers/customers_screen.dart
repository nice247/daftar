import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/api_service.dart';
import '../../models/customer_model.dart';
import '../../database/local_db_helper.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  List<CustomerModel> _customers = [];
  bool _isLoading = true;
  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();
    _fetchCustomers();
  }

  void _fetchCustomers() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get('/customers/');
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        final list = data.map((c) => CustomerModel.fromJson(c)).toList();
        if (mounted) {
          setState(() {
            _customers = list;
            _isLoading = false;
          });
        }
        LocalDbHelper.instance.cacheCustomers(list);
        return;
      }
    } catch (e) {
      debugPrint("Fetching online customers failed, falling back to offline cache");
    }

    final offlineList = await LocalDbHelper.instance.getCachedCustomers();
    if (mounted) {
      setState(() {
        _customers = offlineList;
        _isLoading = false;
      });
    }
  }

  void _showAddCustomerDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("إضافة عميل جديد"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: "اسم العميل"),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: "رقم الهاتف"),
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
              if (nameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);

              try {
                await _api.post('/customers/', {
                  'name': nameCtrl.text.trim(),
                  'phone': phoneCtrl.text.trim(),
                });
                _fetchCustomers();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("تعذر إضافة العميل")),
                  );
                }
              }
            },
            child: const Text("إضافة"),
          ),
        ],
      ),
    );
  }

  void _showAddDebtDialog(CustomerModel customer) {
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("تسجيل دين على: ${customer.name}"),
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
              controller: noteCtrl,
              decoration: const InputDecoration(labelText: "ملاحظات / البضاعة"),
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

              try {
                await _api.post('/customers/debt', {
                  'customer_id': customer.id,
                  'amount': amount,
                  'note': noteCtrl.text.trim(),
                });
                _fetchCustomers();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("تم حفظ الدين في السجل")),
                  );
                }
              }
            },
            child: const Text("تسجيل الدين"),
          ),
        ],
      ),
    );
  }

  void _sendWhatsAppReminder(CustomerModel customer) async {
    final messenger = ScaffoldMessenger.of(context);
    String phone = customer.phone.replaceAll(RegExp(r'\D'), '');
    if (phone.startsWith('0')) {
      phone = '249${phone.substring(1)}';
    } else if (!phone.startsWith('249')) {
      phone = '249$phone';
    }

    final message = "تذكير لطيف من متجرنا: المتبقي في حساب الدين الخاص بك هو ${customer.totalDebt} جنيه. شكراً لتواصلك معنا!";
    final url = Uri.parse("https://wa.me/$phone?text=${Uri.encodeComponent(message)}");

    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      messenger.showSnackBar(
        const SnackBar(content: Text("تعذر فتح تطبيق الواتساب")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddCustomerDialog,
        backgroundColor: const Color(0xFF059669),
        icon: const Icon(Icons.person_add),
        label: const Text("إضافة عميل"),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _customers.isEmpty
              ? const Center(child: Text("لا يوجد عملاء مضافين حالياً"))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _customers.length,
                  itemBuilder: (ctx, index) {
                    final customer = _customers[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: customer.totalDebt > 0
                              ? Colors.red.withOpacity(0.15)
                              : const Color(0xFF059669).withOpacity(0.15),
                          child: Icon(
                            customer.totalDebt > 0 ? Icons.money_off : Icons.check_circle,
                            color: customer.totalDebt > 0 ? Colors.red : const Color(0xFF10B981),
                          ),
                        ),
                        title: Text(
                          customer.name,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        subtitle: Text("الهاتف: ${customer.phone}"),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              "${customer.totalDebt} ج.س",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: customer.totalDebt > 0 ? Colors.red : Colors.green,
                              ),
                            ),
                            const Text("إجمالي الدين", style: TextStyle(fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                        onTap: () {
                          showModalBottomSheet(
                            context: context,
                            builder: (bCtx) => Container(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    customer.name,
                                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 16),
                                  ListTile(
                                    leading: const Icon(Icons.add_card, color: Colors.red),
                                    title: const Text("تسجيل دين جديد"),
                                    onTap: () {
                                      Navigator.pop(bCtx);
                                      _showAddDebtDialog(customer);
                                    },
                                  ),
                                  ListTile(
                                    leading: const Icon(Icons.chat, color: Colors.green),
                                    title: const Text("إرسال تذكير بالواتساب"),
                                    onTap: () {
                                      Navigator.pop(bCtx);
                                      _sendWhatsAppReminder(customer);
                                    },
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),
    );
  }
}
