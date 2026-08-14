import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';
import '../../config/api_config.dart';
import '../../services/api_service.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _api = ApiService();

  Map<String, dynamic>? _stats;
  List<dynamic> _users = [];
  List<dynamic> _pendingSubs = [];
  Map<String, dynamic> _settings = {'monthly_price': 10000, 'quarterly_price': 30000, 'semi_annual_price': 60000};
  bool _loading = true;
  bool _savingSettings = false;
  String _searchQuery = '';

  final currencyFormat = NumberFormat('#,##0.##', 'ar');

  String formatCurrency(dynamic val) {
    if (val == null) return '0';
    final numVal = double.tryParse(val.toString()) ?? 0.0;
    return currencyFormat.format(numVal);
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final resList = await Future.wait([
        _api.get(ApiConfig.adminStats),
        _api.get(ApiConfig.adminUsers),
        _api.get(ApiConfig.subscriptionPending),
        _api.get(ApiConfig.adminSettings),
      ]);

      if (resList[0].statusCode == 200) _stats = jsonDecode(resList[0].body);
      if (resList[1].statusCode == 200) _users = jsonDecode(resList[1].body);
      if (resList[2].statusCode == 200) _pendingSubs = jsonDecode(resList[2].body);
      if (resList[3].statusCode == 200) _settings = jsonDecode(resList[3].body);
    } catch (_) {}
    finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showAddUserDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    final daysCtrl = TextEditingController(text: "30");
    String role = 'merchant';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDState) => AlertDialog(
          title: const Text("إضافة مستخدم جديد", style: TextStyle(fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: ChoiceChip(
                        label: const Text("تاجر"),
                        selected: role == 'merchant',
                        onSelected: (val) => setDState(() => role = 'merchant'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ChoiceChip(
                        label: const Text("أدمن"),
                        selected: role == 'admin',
                        onSelected: (val) => setDState(() => role = 'admin'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: "رقم الهاتف (0XXXXXXXXX)")),
                const SizedBox(height: 12),
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: "الاسم / اسم المتجر")),
                const SizedBox(height: 12),
                TextField(controller: passwordCtrl, obscureText: true, decoration: const InputDecoration(labelText: "كلمة المرور المؤقتة")),
                if (role == 'merchant') ...[
                  const SizedBox(height: 12),
                  TextField(controller: daysCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "صلاحية الاشتراك (أيام)")),
                ]
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
            ElevatedButton(
              onPressed: () async {
                if (phoneCtrl.text.isEmpty || nameCtrl.text.isEmpty || passwordCtrl.text.isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await _api.post(ApiConfig.adminAddUser, {
                    'phone': phoneCtrl.text.trim(),
                    'store_name': nameCtrl.text.trim(),
                    'password': passwordCtrl.text.trim(),
                    'role': role,
                    'subscription_days': int.tryParse(daysCtrl.text) ?? 30,
                  });
                  _loadData();
                } catch (_) {}
              },
              child: const Text("حفظ وإضافة"),
            ),
          ],
        ),
      ),
    );
  }

  void _handleToggleFreeze(dynamic user) async {
    final action = user['status'] == 'ACTIVE' ? 'freeze' : 'activate';
    try {
      await _api.post(ApiConfig.adminToggleUser, {
        'user_id': user['id'],
        'action': action,
      });
      _loadData();
    } catch (_) {}
  }

  void _handleExtendSub(dynamic user) {
    final daysCtrl = TextEditingController(text: "30");
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("تمديد اشتراك: ${user['store_name']}", style: const TextStyle(fontWeight: FontWeight.bold)),
        content: TextField(
          controller: daysCtrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: "عدد الأيام للتمديد"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
          ElevatedButton(
            onPressed: () async {
              final days = int.tryParse(daysCtrl.text) ?? 30;
              Navigator.pop(ctx);
              try {
                await _api.post(ApiConfig.adminExtendSub, {
                  'user_id': user['id'],
                  'days': days,
                });
                _loadData();
              } catch (_) {}
            },
            child: const Text("تأكيد التمديد"),
          ),
        ],
      ),
    );
  }

  void _sendRenewalReminder(dynamic user) async {
    String phone = (user['phone'] ?? '').replaceAll(RegExp(r'\D'), '');
    if (phone.startsWith('0')) phone = '249${phone.substring(1)}';
    final message = "مرحباً بك في دفتر التاجر يا ${user['store_name']}، نود تذكيرك بأن اشتراكك قارب على الانتهاء. يرجى التجديد لضمان استمرار الخدمة.";
    final url = Uri.parse("https://wa.me/$phone?text=${Uri.encodeComponent(message)}");
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  void _reviewSubscription(dynamic sub, String action) async {
    String? reason;
    if (action == 'reject') {
      final reasonCtrl = TextEditingController();
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text("سبب رفض الاشتراك"),
          content: TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: "سبب الرفض (اختياري)")),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("إلغاء")),
            ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text("رفض")),
          ],
        ),
      );
      if (confirm != true) return;
      reason = reasonCtrl.text.trim();
    }

    try {
      await _api.post(ApiConfig.subscriptionReview, {
        'subscription_id': sub['id'],
        'action': action,
        'rejection_reason': reason,
      });
      _loadData();
    } catch (_) {}
  }

  Future<void> _saveSettings() async {
    setState(() => _savingSettings = true);
    try {
      await _api.put(ApiConfig.adminSettings, {
        'monthly_price': double.tryParse(_settings['monthly_price'].toString()) ?? 10000,
        'quarterly_price': double.tryParse(_settings['quarterly_price'].toString()) ?? 30000,
        'semi_annual_price': double.tryParse(_settings['semi_annual_price'].toString()) ?? 60000,
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("تم حفظ إعدادات الأسعار بنجاح"), backgroundColor: Color(0xFF2B8A3E)),
      );
    } catch (_) {}
    finally {
      if (mounted) setState(() => _savingSettings = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2B8A3E)));
    }

    final filteredUsers = _users.where((u) {
      final name = u['store_name'] ?? '';
      final phone = u['phone'] ?? '';
      return name.contains(_searchQuery) || phone.contains(_searchQuery);
    }).toList();

    final expiringCount = _stats?['expiring_soon'] ?? 0;

    return Column(
      children: [
        // Title Bar & Add User Button
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ElevatedButton.icon(
                onPressed: _showAddUserDialog,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2B8A3E),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                icon: const Icon(Icons.person_add_alt_1, size: 16),
                label: const Text("إضافة مستخدم", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              const Row(
                children: [
                  Text("لوحة تحكم الأدمن", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF212529))),
                  SizedBox(width: 6),
                  Icon(Icons.shield_outlined, color: Color(0xFF2B8A3E), size: 20),
                ],
              ),
            ],
          ),
        ),

        Container(
          color: Colors.white,
          child: TabBar(
            controller: _tabController,
            labelColor: const Color(0xFF2B8A3E),
            unselectedLabelColor: const Color(0xFF6C757D),
            indicatorColor: const Color(0xFF2B8A3E),
            tabs: [
              const Tab(text: "المستخدمين"),
              Tab(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (_pendingSubs.isNotEmpty)
                      CircleAvatar(
                        radius: 8,
                        backgroundColor: Colors.red,
                        child: Text("${_pendingSubs.length}", style: const TextStyle(color: Colors.white, fontSize: 9)),
                      ),
                    const SizedBox(width: 4),
                    const Text("طلبات الاشتراك"),
                  ],
                ),
              ),
              const Tab(text: "إعدادات الأسعار"),
            ],
          ),
        ),

        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              // Tab 1: Users
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    // 2x2 Grid Stats
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      childAspectRatio: 1.6,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      physics: const NeverScrollableScrollPhysics(),
                      children: [
                        Card(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.people_outline, color: Colors.blue, size: 22),
                              const SizedBox(height: 4),
                              Text("${_stats?['total_users'] ?? 0}", style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                              const Text("إجمالي التجار", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                            ],
                          ),
                        ),
                        Card(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.person_add_alt_1, color: Color(0xFF2B8A3E), size: 22),
                              const SizedBox(height: 4),
                              Text("${_stats?['active_users'] ?? 0}", style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                              const Text("تاجر نشط", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                            ],
                          ),
                        ),
                        Card(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.person_off_outlined, color: Colors.red, size: 22),
                              const SizedBox(height: 4),
                              Text("${_stats?['frozen_users'] ?? 0}", style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                              const Text("تاجر مجمد", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                            ],
                          ),
                        ),
                        Card(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.access_time, color: Colors.amber, size: 22),
                              const SizedBox(height: 4),
                              Text("${_stats?['pending_verification'] ?? 0}", style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                              const Text("معلق", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                            ],
                          ),
                        ),
                      ],
                    ),

                    if (expiringCount > 0) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF9DB),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFFEC99)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.warning_amber, color: Color(0xFFD97706), size: 20),
                            const SizedBox(width: 8),
                            Text(
                              "$expiringCount اشتراكات تقترب من الانتهاء",
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFFD97706)),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 14),

                    // Search bar
                    Row(
                      children: [
                        ElevatedButton(
                          onPressed: () => setState(() {}),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2B8A3E)),
                          child: const Text("بحث"),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            decoration: const InputDecoration(hintText: "بحث برقم الهاتف أو الاسم"),
                            onChanged: (val) => setState(() => _searchQuery = val),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 14),

                    // Users List
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: filteredUsers.length,
                      itemBuilder: (ctx, i) {
                        final u = filteredUsers[i];
                        final isActive = u['status'] == 'ACTIVE';

                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: isActive ? const Color(0xFFE6FCF5) : const Color(0xFFFFF0F0),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        isActive ? "نشط" : "مجمد",
                                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isActive ? const Color(0xFF2B8A3E) : Colors.red),
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(u['store_name'] ?? 'متجر', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                        Text(u['phone'] ?? '', style: const TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                                      ],
                                    ),
                                  ],
                                ),
                                if (u['subscription_end_date'] != null) ...[
                                  const SizedBox(height: 4),
                                  Text("انتهاء الاشتراك: ${u['subscription_end_date']}", style: const TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                                ],
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: () => _handleToggleFreeze(u),
                                        style: OutlinedButton.styleFrom(
                                          backgroundColor: const Color(0xFFFFF0F0),
                                          side: const BorderSide(color: Color(0xFFFFD8D8)),
                                        ),
                                        child: Text(isActive ? "تجميد" : "تنشيط", style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold)),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: () => _handleExtendSub(u),
                                        style: OutlinedButton.styleFrom(
                                          backgroundColor: const Color(0xFFE7F5FF),
                                          side: const BorderSide(color: Color(0xFFA5D8FF)),
                                        ),
                                        child: const Text("تمديد", style: TextStyle(color: Color(0xFF1C7ED6), fontSize: 12, fontWeight: FontWeight.bold)),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    IconButton(
                                      icon: const Icon(Icons.chat, color: Color(0xFF25D366)),
                                      onPressed: () => _sendRenewalReminder(u),
                                      tooltip: "تذكير بالواتساب",
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),

              // Tab 2: Pending Subscriptions
              ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _pendingSubs.length,
                itemBuilder: (ctx, i) {
                  final sub = _pendingSubs[i];
                  final ocr = sub['ocr_data'] ?? {};

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(color: const Color(0xFFFFF9DB), borderRadius: BorderRadius.circular(10)),
                                child: const Text("قيد المراجعة", style: TextStyle(fontSize: 10, color: Color(0xFFD97706), fontWeight: FontWeight.bold)),
                              ),
                              Text("طلب اشتراك جديد (${sub['created_at']?.toString().split('T')[0] ?? ''})", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            ],
                          ),
                          const SizedBox(height: 10),

                          // Extracted OCR Data Box
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8F9FA),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFDEE2E6)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text("المبلغ المستخرج: ${ocr['amount'] != null ? '${formatCurrency(ocr['amount'])} ج.س' : 'غير متوفر'}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                const SizedBox(height: 4),
                                Text("رقم العملية: ${ocr['reference_number'] ?? 'غير متوفر'}", style: const TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                                const SizedBox(height: 4),
                                Text("التاريخ المكتوب: ${ocr['date'] ?? 'غير متوفر'}", style: const TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                              ],
                            ),
                          ),

                          const SizedBox(height: 10),
                          if (sub['receipt_image'] != null)
                            InkWell(
                              onTap: () {
                                showDialog(
                                  context: context,
                                  builder: (iCtx) => Dialog(
                                    child: Image.memory(base64Decode(sub['receipt_image'].replaceAll(RegExp(r'\s+'), '')), fit: BoxFit.contain),
                                  ),
                                );
                              },
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.memory(base64Decode(sub['receipt_image'].replaceAll(RegExp(r'\s+'), '')), height: 120, width: double.infinity, fit: BoxFit.cover),
                              ),
                            ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: () => _reviewSubscription(sub, 'approve'),
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2B8A3E)),
                                  child: const Text("قبول وتفعيل"),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () => _reviewSubscription(sub, 'reject'),
                                  style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.red)),
                                  child: const Text("رفض", style: TextStyle(color: Colors.red)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),

              // Tab 3: Pricing Settings
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("إعدادات أسعار الاشتراكات", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 14),
                        TextFormField(
                          initialValue: _settings['monthly_price']?.toString() ?? '10000',
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: "سعر الاشتراك الشهري (ج.س)"),
                          onChanged: (v) => _settings['monthly_price'] = v,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          initialValue: _settings['quarterly_price']?.toString() ?? '30000',
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: "سعر الاشتراك الربع سنوي - 3 أشهر (ج.س)"),
                          onChanged: (v) => _settings['quarterly_price'] = v,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          initialValue: _settings['semi_annual_price']?.toString() ?? '60000',
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: "سعر الاشتراك النصف سنوي - 6 أشهر (ج.س)"),
                          onChanged: (v) => _settings['semi_annual_price'] = v,
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: _savingSettings ? null : _saveSettings,
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2B8A3E), minimumSize: const Size.fromHeight(46)),
                          child: _savingSettings
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text("✔ حفظ الأسعار الجديدة", style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
