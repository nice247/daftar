import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../models/customer_model.dart';
import '../../models/merchant_debt_model.dart';
import '../../database/local_db_helper.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _api = ApiService();

  List<CustomerModel> _customers = [];
  List<MerchantDebtModel> _merchantDebts = [];
  bool _loading = true;
  String _customerSearch = '';
  String _supplierSearch = '';

  final currencyFormat = NumberFormat('#,##0.##', 'ar');

  String formatCurrency(dynamic val) {
    if (val == null) return '0.00';
    final numVal = double.tryParse(val.toString()) ?? 0.0;
    return currencyFormat.format(numVal);
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final resList = await Future.wait([
        _api.get('/customers/'),
        _api.get('/merchant-debts/'),
      ]);

      if (resList[0].statusCode == 200) {
        final List cData = jsonDecode(resList[0].body);
        _customers = cData.map((c) => CustomerModel.fromJson(c)).toList();
        LocalDbHelper.instance.cacheCustomers(_customers);
      }
      if (resList[1].statusCode == 200) {
        final List dData = jsonDecode(resList[1].body);
        _merchantDebts = dData.map((d) => MerchantDebtModel.fromJson(d)).toList();
      }
    } catch (e) {
      _customers = await LocalDbHelper.instance.getCachedCustomers();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // --- Customer Dialogs ---
  void _showAddCustomerDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("إضافة عميل جديد", style: TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: "اسم العميل")),
            const SizedBox(height: 12),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: "رقم الهاتف")),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              try {
                await _api.post('/customers/', {'name': nameCtrl.text.trim(), 'phone': phoneCtrl.text.trim()});
                _loadData();
              } catch (_) {}
            },
            child: const Text("حفظ العميل"),
          ),
        ],
      ),
    );
  }

  void _showEditCustomerDialog(CustomerModel customer) {
    final nameCtrl = TextEditingController(text: customer.name);
    final phoneCtrl = TextEditingController(text: customer.phone);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("تعديل بيانات العميل", style: TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: "اسم العميل")),
            const SizedBox(height: 12),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: "رقم الهاتف")),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              try {
                await _api.put('/customers/${customer.id}', {'name': nameCtrl.text.trim(), 'phone': phoneCtrl.text.trim()});
                _loadData();
              } catch (_) {}
            },
            child: const Text("حفظ التعديل"),
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
        title: Text("تسجيل دين على: ${customer.name}", style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: amountCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: "المبلغ (جنيه)")),
            const SizedBox(height: 12),
            TextField(controller: noteCtrl, decoration: const InputDecoration(labelText: "ملاحظات / وصف البضاعة")),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
          ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              if (amount <= 0) return;
              Navigator.pop(ctx);
              try {
                await _api.post('/customers/debt', {'customer_id': customer.id, 'amount': amount, 'description': noteCtrl.text.trim()});
                _loadData();
              } catch (_) {}
            },
            child: const Text("تسجيل الدين"),
          ),
        ],
      ),
    );
  }

  void _showPayDebtDialog(CustomerModel customer) {
    final amountCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("سداد دين من: ${customer.name}", style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("المتبقي عليه حالياً: ${formatCurrency(customer.totalDebt)} ج.س", style: const TextStyle(fontSize: 12, color: Color(0xFF6C757D))),
            const SizedBox(height: 10),
            TextField(controller: amountCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: "المبلغ المسدد (جنيه)")),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
          ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              if (amount <= 0) return;
              Navigator.pop(ctx);
              try {
                await _api.post('/customers/pay-debt', {'customer_id': customer.id, 'amount': amount});
                _loadData();
              } catch (_) {}
            },
            child: const Text("تأكيد السداد"),
          ),
        ],
      ),
    );
  }

  void _showWaiveDebtDialog(CustomerModel customer) {
    final amountCtrl = TextEditingController();
    final reasonCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("إعفاء دين عن: ${customer.name}", style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: amountCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: "المبلغ المعفى (جنيه)")),
            const SizedBox(height: 12),
            TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: "سبب الإعفاء (اختياري)")),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.amber.shade800),
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              if (amount <= 0) return;
              Navigator.pop(ctx);
              try {
                await _api.post('/customers/waive-debt', {'customer_id': customer.id, 'amount': amount, 'reason': reasonCtrl.text.trim()});
                _loadData();
              } catch (_) {}
            },
            child: const Text("تأكيد الإعفاء"),
          ),
        ],
      ),
    );
  }

  void _deleteCustomer(CustomerModel customer) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("حذف العميل"),
        content: Text("هل أنت متأكد من حذف العميل '${customer.name}'؟"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("إلغاء")),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text("حذف")),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _api.delete('/customers/${customer.id}');
        _loadData();
      } catch (_) {}
    }
  }

  void _sendWhatsAppReminder(CustomerModel customer) async {
    String phone = customer.phone.replaceAll(RegExp(r'\D'), '');
    if (phone.startsWith('0')) {
      phone = '249${phone.substring(1)}';
    } else if (!phone.startsWith('249')) {
      phone = '249$phone';
    }

    final message = "تذكير لطيف من متجرنا: المتبقي في حساب الدين الخاص بك هو ${formatCurrency(customer.totalDebt)} جنيه. شكراً لتواصلك معنا!";
    final url = Uri.parse("https://wa.me/$phone?text=${Uri.encodeComponent(message)}");

    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  // --- Supplier Dialogs ---
  void _showAddSupplierDebtDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final amountCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("إضافة مستحق مورد جديد", style: TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: "اسم المورد / الشركة")),
            const SizedBox(height: 12),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: "رقم هاتف المورد")),
            const SizedBox(height: 12),
            TextField(controller: amountCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: "المبلغ المستحق (جنيه)")),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
          ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              if (nameCtrl.text.trim().isEmpty || amount <= 0) return;
              Navigator.pop(ctx);
              try {
                await _api.post('/merchant-debts/', {
                  'supplier_name': nameCtrl.text.trim(),
                  'supplier_phone': phoneCtrl.text.trim(),
                  'total_amount': amount,
                });
                _loadData();
              } catch (_) {}
            },
            child: const Text("حفظ المستحق"),
          ),
        ],
      ),
    );
  }

  void _showPaySupplierDebtDialog(MerchantDebtModel debt) {
    final amountCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("سداد مستحق للمورد: ${debt.supplierName}", style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("المتبقي له حالياً: ${formatCurrency(debt.remainingAmount)} ج.س", style: const TextStyle(fontSize: 12, color: Color(0xFF6C757D))),
            const SizedBox(height: 10),
            TextField(controller: amountCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: "المبلغ المدفوع (جنيه)")),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
          ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              if (amount <= 0) return;
              Navigator.pop(ctx);
              try {
                await _api.post('/merchant-debts/pay', {
                  'merchant_debt_id': debt.id,
                  'amount': amount,
                  'payment_method': 'cash',
                });
                _loadData();
              } catch (_) {}
            },
            child: const Text("تأكيد السداد"),
          ),
        ],
      ),
    );
  }

  void _deleteSupplierDebt(MerchantDebtModel debt) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("حذف مستحق المورد"),
        content: Text("هل أنت متأكد من حذف مستحق '${debt.supplierName}'؟"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("إلغاء")),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text("حذف")),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _api.delete('/merchant-debts/${debt.id}');
        _loadData();
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredCustomers = _customers.where((c) {
      return c.name.contains(_customerSearch) || c.phone.contains(_customerSearch);
    }).toList();

    final filteredSuppliers = _merchantDebts.where((s) {
      return s.supplierName.contains(_supplierSearch);
    }).toList();

    return Column(
      children: [
        Container(
          color: Colors.white,
          child: TabBar(
            controller: _tabController,
            labelColor: const Color(0xFF2B8A3E),
            unselectedLabelColor: const Color(0xFF6C757D),
            indicatorColor: const Color(0xFF2B8A3E),
            tabs: const [
              Tab(text: "ديون العملاء"),
              Tab(text: "ديون الموردين"),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF2B8A3E)))
              : TabBarView(
                  controller: _tabController,
                  children: [
                    // Tab 1: Customers
                    Scaffold(
                      floatingActionButton: FloatingActionButton.extended(
                        onPressed: _showAddCustomerDialog,
                        backgroundColor: const Color(0xFF2B8A3E),
                        icon: const Icon(Icons.person_add),
                        label: const Text("عميل جديد"),
                      ),
                      body: Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: TextField(
                              decoration: const InputDecoration(
                                hintText: "بحث عن عميل بالاسم أو الهاتف...",
                                prefixIcon: Icon(Icons.search),
                              ),
                              onChanged: (val) => setState(() => _customerSearch = val),
                            ),
                          ),
                          Expanded(
                            child: filteredCustomers.isEmpty
                                ? const Center(child: Text("لا يوجد عملاء مطابقون"))
                                : ListView.builder(
                                    padding: const EdgeInsets.symmetric(horizontal: 12),
                                    itemCount: filteredCustomers.length,
                                    itemBuilder: (ctx, i) {
                                      final customer = filteredCustomers[i];
                                      return Card(
                                        color: const Color(0xFFF8F9FA),
                                        margin: const EdgeInsets.only(bottom: 8),
                                        child: ListTile(
                                          title: Text(customer.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                          subtitle: Text("الهاتف: ${customer.phone}", style: const TextStyle(color: Color(0xFF6C757D))),
                                          trailing: Column(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            children: [
                                              Text(
                                                "${formatCurrency(customer.totalDebt)} ج.س",
                                                style: TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  color: customer.totalDebt > 0 ? Colors.red : const Color(0xFF2B8A3E),
                                                ),
                                              ),
                                              const Text("إجمالي الدين", style: TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                                            ],
                                          ),
                                          onTap: () {
                                            showModalBottomSheet(
                                              context: context,
                                              builder: (bCtx) => SafeArea(
                                                child: Wrap(
                                                  children: [
                                                    ListTile(
                                                      leading: const Icon(Icons.add_card, color: Colors.red),
                                                      title: const Text("تسجيل دين جديد"),
                                                      onTap: () {
                                                        Navigator.pop(bCtx);
                                                        _showAddDebtDialog(customer);
                                                      },
                                                    ),
                                                    ListTile(
                                                      leading: const Icon(Icons.payments_outlined, color: Color(0xFF2B8A3E)),
                                                      title: const Text("سداد دين"),
                                                      onTap: () {
                                                        Navigator.pop(bCtx);
                                                        _showPayDebtDialog(customer);
                                                      },
                                                    ),
                                                    ListTile(
                                                      leading: const Icon(Icons.card_giftcard, color: Colors.amber),
                                                      title: const Text("إعفاء من دين"),
                                                      onTap: () {
                                                        Navigator.pop(bCtx);
                                                        _showWaiveDebtDialog(customer);
                                                      },
                                                    ),
                                                    ListTile(
                                                      leading: const Icon(Icons.chat, color: Color(0xFF2B8A3E)),
                                                      title: const Text("إرسال تذكير بالواتساب"),
                                                      onTap: () {
                                                        Navigator.pop(bCtx);
                                                        _sendWhatsAppReminder(customer);
                                                      },
                                                    ),
                                                    ListTile(
                                                      leading: const Icon(Icons.edit, color: Colors.blue),
                                                      title: const Text("تعديل بيانات العميل"),
                                                      onTap: () {
                                                        Navigator.pop(bCtx);
                                                        _showEditCustomerDialog(customer);
                                                      },
                                                    ),
                                                    ListTile(
                                                      leading: const Icon(Icons.delete, color: Colors.red),
                                                      title: const Text("حذف العميل", style: TextStyle(color: Colors.red)),
                                                      onTap: () {
                                                        Navigator.pop(bCtx);
                                                        _deleteCustomer(customer);
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
                          ),
                        ],
                      ),
                    ),

                    // Tab 2: Suppliers
                    Scaffold(
                      floatingActionButton: FloatingActionButton.extended(
                        onPressed: _showAddSupplierDebtDialog,
                        backgroundColor: const Color(0xFF2B8A3E),
                        icon: const Icon(Icons.add_business),
                        label: const Text("مستحق مورد جديد"),
                      ),
                      body: Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: TextField(
                              decoration: const InputDecoration(
                                hintText: "بحث عن مورد...",
                                prefixIcon: Icon(Icons.search),
                              ),
                              onChanged: (val) => setState(() => _supplierSearch = val),
                            ),
                          ),
                          Expanded(
                            child: filteredSuppliers.isEmpty
                                ? const Center(child: Text("لا توجد ديون موردين مسجلة"))
                                : ListView.builder(
                                    padding: const EdgeInsets.symmetric(horizontal: 12),
                                    itemCount: filteredSuppliers.length,
                                    itemBuilder: (ctx, i) {
                                      final item = filteredSuppliers[i];
                                      return Card(
                                        color: const Color(0xFFF8F9FA),
                                        margin: const EdgeInsets.only(bottom: 8),
                                        child: ListTile(
                                          leading: const CircleAvatar(
                                            backgroundColor: Colors.blueAccent,
                                            child: Icon(Icons.local_shipping, color: Colors.white),
                                          ),
                                          title: Text(item.supplierName, style: const TextStyle(fontWeight: FontWeight.bold)),
                                          subtitle: Text("المتبقي: ${formatCurrency(item.remainingAmount)} ج.س"),
                                          trailing: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                icon: const Icon(Icons.payments_outlined, color: Color(0xFF2B8A3E)),
                                                onPressed: () => _showPaySupplierDebtDialog(item),
                                                tooltip: "سداد المستحق",
                                              ),
                                              IconButton(
                                                icon: const Icon(Icons.delete_outline, color: Colors.red),
                                                onPressed: () => _deleteSupplierDebt(item),
                                                tooltip: "حذف المستحق",
                                              ),
                                            ],
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}
