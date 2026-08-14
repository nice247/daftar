import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../config/api_config.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import 'backup_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final ApiService _api = ApiService();

  late TextEditingController _storeNameCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _customCycleCtrl;

  dynamic _restockCycleOption = 7; // 7, 14, 30, or 'custom'
  DateTime? _cycleStartDate;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final user = Provider.of<AuthProvider>(context, listen: false).user;
    _storeNameCtrl = TextEditingController(text: user?.storeName ?? '');
    _emailCtrl = TextEditingController(text: '');

    int cycleDays = 7;
    if ([7, 14, 30].contains(cycleDays)) {
      _restockCycleOption = cycleDays;
      _customCycleCtrl = TextEditingController(text: '');
    } else {
      _restockCycleOption = 'custom';
      _customCycleCtrl = TextEditingController(text: cycleDays.toString());
    }
  }

  @override
  void dispose() {
    _storeNameCtrl.dispose();
    _emailCtrl.dispose();
    _customCycleCtrl.dispose();
    super.dispose();
  }

  int get _calculatedCycleDays {
    if (_restockCycleOption == 'custom') {
      return int.tryParse(_customCycleCtrl.text) ?? 7;
    }
    return int.tryParse(_restockCycleOption.toString()) ?? 7;
  }

  Future<void> _handleSave() async {
    final messenger = ScaffoldMessenger.of(context);
    final auth = Provider.of<AuthProvider>(context, listen: false);

    setState(() => _saving = true);

    try {
      final payload = <String, dynamic>{
        'store_name': _storeNameCtrl.text.trim(),
        'email': _emailCtrl.text.trim().isNotEmpty ? _emailCtrl.text.trim() : null,
        'restock_cycle_days': _calculatedCycleDays,
      };

      if (_cycleStartDate != null) {
        payload['cycle_start_date'] = _cycleStartDate!.toIso8601String().split('T')[0];
      }

      final res = await _api.put(ApiConfig.userProfile, payload);

      if (res.statusCode == 200 || res.statusCode == 201) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text("تم تحديث البيانات بنجاح"),
            backgroundColor: Color(0xFF2B8A3E),
          ),
        );
        setState(() => _cycleStartDate = null);
        await auth.fetchProfile();
      } else {
        messenger.showSnackBar(
          const SnackBar(content: Text("فشل في تحديث البيانات")),
        );
      }
    } catch (_) {
      messenger.showSnackBar(
        const SnackBar(content: Text("حدث خطأ أثناء التحديث")),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _openFacebook() async {
    final url = Uri.parse("https://fb.me/61590357776476");
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  void _openCustomerSupport() async {
    final url = Uri.parse("https://wa.me/201280920179?text=${Uri.encodeComponent('مرحباً، أحتاج إلى دعم فني في دفتر التاجر')}");
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).user;

    int daysRemaining = 30;
    if (user?.subscriptionEndDate != null) {
      try {
        final endDate = DateTime.parse(user!.subscriptionEndDate!);
        daysRemaining = endDate.difference(DateTime.now()).inDays;
      } catch (_) {}
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            "الإعدادات والدعم",
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF212529)),
          ),
          const SizedBox(height: 14),

          // 1. Subscription Status Card (Only for Merchants)
          if (!user!.isAdmin)
            Card(
              color: const Color(0xFFF8F9FA),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: daysRemaining > 3 ? const Color(0xFFDEE2E6) : Colors.red.shade300,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.calendar_today_outlined,
                          color: daysRemaining > 3 ? const Color(0xFF2B8A3E) : Colors.red,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        const Text("حالة الاشتراك", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          user.subscriptionEndDate ?? "نشط",
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF212529)),
                        ),
                        const Text("تاريخ الانتهاء:", style: TextStyle(fontSize: 12, color: Color(0xFF6C757D))),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "$daysRemaining يوم",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: daysRemaining > 3 ? const Color(0xFF2B8A3E) : Colors.red,
                          ),
                        ),
                        const Text("الأيام المتبقية:", style: TextStyle(fontSize: 12, color: Color(0xFF6C757D))),
                      ],
                    ),
                  ],
                ),
              ),
            ),

          if (!user.isAdmin) const SizedBox(height: 14),

          // 2. Profile Settings Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.person_outline, color: Color(0xFF6C757D), size: 20),
                      SizedBox(width: 8),
                      Text("بيانات الحساب", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    ],
                  ),
                  const SizedBox(height: 14),

                  const Text("رقم الواتساب (حسابك)", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                  const SizedBox(height: 4),
                  TextField(
                    enabled: false,
                    controller: TextEditingController(text: user.phone),
                    decoration: const InputDecoration(fillColor: Color(0xFFF8F9FA), filled: true),
                  ),

                  const SizedBox(height: 12),
                  Text(user.isAdmin ? "اسم الأدمن" : "اسم المتجر", style: const TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _storeNameCtrl,
                    decoration: const InputDecoration(hintText: "اسم المتجر"),
                  ),

                  const SizedBox(height: 12),
                  const Text("البريد الإلكتروني", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(hintText: "اختياري"),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // 3. Restock Cycle Card (Only for Merchants)
          if (!user.isAdmin)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.card_giftcard, color: Color(0xFFD97706), size: 20),
                        SizedBox(width: 8),
                        Text("دورة الشراء (المدة بين إعادة التخزين)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      "حدد المدة التي عادة تشتري فيها بضاعة جديدة، ستُستخدم لحساب أرباحك في هذه الفترة.",
                      style: TextStyle(fontSize: 11, color: Color(0xFF6C757D)),
                    ),
                    const SizedBox(height: 12),

                    // 4 Options Grid (2x2)
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      childAspectRatio: 2.4,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                      physics: const NeverScrollableScrollPhysics(),
                      children: [
                        { 'val': 7, 'lbl': 'أسبوع' },
                        { 'val': 14, 'lbl': 'أسبوعين' },
                        { 'val': 30, 'lbl': 'شهر' },
                        { 'val': 'custom', 'lbl': 'تحديد فترة' },
                      ].map((opt) {
                        final isSelected = _restockCycleOption == opt['val'];
                        return InkWell(
                          onTap: () => setState(() => _restockCycleOption = opt['val']),
                          child: Container(
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: isSelected ? Colors.white : const Color(0xFFF8F9FA),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected ? const Color(0xFF2B8A3E) : const Color(0xFFDEE2E6),
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Text(
                              opt['lbl'] as String,
                              style: TextStyle(
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                color: isSelected ? const Color(0xFF2B8A3E) : const Color(0xFF6C757D),
                                fontSize: 13,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),

                    if (_restockCycleOption == 'custom') ...[
                      const SizedBox(height: 12),
                      const Text("أدخل عدد الأيام", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                      const SizedBox(height: 4),
                      TextField(
                        controller: _customCycleCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(hintText: "مثال: 10"),
                      ),
                    ],

                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Divider(),
                    ),

                    const Text("تعديل تاريخ بداية الدورة الحالية", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 4),
                    const Text(
                      "إذا كنت في منتصف الدورة بالفعل، يمكنك إدخال تاريخ بدايتها الفعلي لضبط حساباتك. (اتركه فارغاً لبقاء الدورة كما هي).",
                      style: TextStyle(fontSize: 10, color: Color(0xFF6C757D)),
                    ),
                    const SizedBox(height: 10),
                    InkWell(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2030),
                        );
                        if (picked != null) {
                          setState(() => _cycleStartDate = picked);
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFDEE2E6)),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Icon(Icons.arrow_drop_down, color: Color(0xFF6C757D)),
                            Text(
                              _cycleStartDate != null
                                  ? _cycleStartDate!.toIso8601String().split('T')[0]
                                  : "اختر التاريخ...",
                              style: const TextStyle(fontSize: 13, color: Color(0xFF212529)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          if (!user.isAdmin) const SizedBox(height: 14),

          // 4. Backup & Restore Section (النسخ الاحتياطي)
          Card(
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF2B8A3E).withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.cloud_sync_rounded, color: Color(0xFF2B8A3E)),
              ),
              title: const Text(
                "النسخ الاحتياطي واستعادة البيانات",
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              subtitle: const Text(
                "حفظ نسخة سحابية أو تصدير بيانات دفترك لمشاركتها وحمايتها",
                style: TextStyle(fontSize: 11, color: Color(0xFF6C757D)),
              ),
              trailing: const Icon(Icons.arrow_forward_ios, size: 16, color: Color(0xFF6C757D)),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const BackupScreen()),
                );
              },
            ),
          ),

          const SizedBox(height: 14),

          // 5. About Section (حول التطبيق)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text("حول التطبيق", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      SizedBox(width: 6),
                      Icon(Icons.info_outline, color: Color(0xFF2B8A3E), size: 20),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text("دفتر التاجر", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF2B8A3E))),
                  const SizedBox(height: 4),
                  const Text(
                    "نظام إدارة المبيعات والمصروفات والديون للتجار في السودان",
                    style: TextStyle(fontSize: 11, color: Color(0xFF6C757D)),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("1.0.0", style: TextStyle(fontWeight: FontWeight.bold)),
                      Text("الإصدار", style: TextStyle(color: Color(0xFF6C757D))),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("بهاء الدين عثمان", style: TextStyle(fontWeight: FontWeight.bold)),
                      Text("المطور", style: TextStyle(color: Color(0xFF6C757D))),
                    ],
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: () {},
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
                      side: const BorderSide(color: Color(0xFFDEE2E6)),
                    ),
                    icon: const Icon(Icons.share_outlined, color: Color(0xFF212529)),
                    label: const Text("نشر ومشاركة التطبيق", style: TextStyle(color: Color(0xFF212529), fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton.icon(
                    onPressed: _openFacebook,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1877F2),
                      minimumSize: const Size.fromHeight(44),
                    ),
                    icon: const Icon(Icons.facebook, color: Colors.white),
                    label: const Text("صفحتنا على فيسبوك", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton.icon(
                    onPressed: _openCustomerSupport,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366),
                      minimumSize: const Size.fromHeight(44),
                    ),
                    icon: const Icon(Icons.phone_in_talk, color: Colors.white),
                    label: const Text("خدمة العملاء والدعم الفني", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),

          // Save Button
          ElevatedButton(
            onPressed: _saving ? null : _handleSave,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2B8A3E),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: _saving
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text("حفظ الإعدادات", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
