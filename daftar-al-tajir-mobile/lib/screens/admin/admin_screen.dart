import 'dart:convert';
import 'package:flutter/material.dart';
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
  bool _loading = true;
  String _searchQuery = '';

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
        _api.get('/admin/stats'),
        _api.get('/admin/users'),
        _api.get('/subscriptions/pending'),
      ]);

      if (resList[0].statusCode == 200) _stats = jsonDecode(resList[0].body);
      if (resList[1].statusCode == 200) _users = jsonDecode(resList[1].body);
      if (resList[2].statusCode == 200) _pendingSubs = jsonDecode(resList[2].body);
    } catch (_) {}
    finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showAddUserDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    String role = 'merchant';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDState) => AlertDialog(
          title: const Text("إضافة مستخدم جديد", style: TextStyle(fontWeight: FontWeight.bold)),
          content: Column(
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
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: "رقم الهاتف (0XXXXXXXXX)"),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: "الاسم / اسم المتجر"),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: passwordCtrl,
                obscureText: true,
                decoration: const InputDecoration(labelText: "كلمة المرور المؤقتة"),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("إلغاء")),
            ElevatedButton(
              onPressed: () async {
                if (phoneCtrl.text.isEmpty || nameCtrl.text.isEmpty || passwordCtrl.text.isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await _api.post('/admin/users', {
                    'phone': phoneCtrl.text.trim(),
                    'store_name': nameCtrl.text.trim(),
                    'password': passwordCtrl.text.trim(),
                    'role': role,
                    'subscription_days': 30,
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
      await _api.post('/admin/users/toggle', {
        'user_id': user['id'],
        'action': action,
      });
      _loadData();
    } catch (_) {}
  }

  void _handleExtendSub(dynamic user) async {
    try {
      await _api.post('/admin/subscriptions/extend', {
        'user_id': user['id'],
        'days': 30,
      });
      _loadData();
    } catch (_) {}
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
                            decoration: const InputDecoration(
                              hintText: "بحث برقم الهاتف أو الاسم",
                            ),
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
                              const Text("طلب اشتراك جديد", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          if (sub['receipt_image'] != null)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(sub['receipt_image'], height: 120, width: double.infinity, fit: BoxFit.cover),
                            ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: () async {
                                    await _api.post('/subscriptions/review', {'subscription_id': sub['id'], 'action': 'approve'});
                                    _loadData();
                                  },
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2B8A3E)),
                                  child: const Text("قبول وتفعيل"),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () async {
                                    await _api.post('/subscriptions/review', {'subscription_id': sub['id'], 'action': 'reject'});
                                    _loadData();
                                  },
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
            ],
          ),
        ),
      ],
    );
  }
}
