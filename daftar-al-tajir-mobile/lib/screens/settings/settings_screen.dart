import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final ApiService _api = ApiService();
  int _selectedCycleDays = 30; // 'شهر' default
  DateTime? _cycleStartDate;
  bool _saving = false;

  Future<void> _handleSave() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);
    try {
      final payload = {
        'restock_cycle_days': _selectedCycleDays,
        if (_cycleStartDate != null)
          'cycle_start_date': _cycleStartDate!.toIso8601String().split('T')[0],
      };
      await _api.put('/users/profile', payload);
      messenger.showSnackBar(
        const SnackBar(
          content: Text("تم حفظ الإعدادات بنجاح"),
          backgroundColor: Color(0xFF2B8A3E),
        ),
      );
    } catch (_) {
      messenger.showSnackBar(
        const SnackBar(content: Text("حدث خطأ في حفظ الإعدادات")),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _openFacebook() async {
    final url = Uri.parse("https://www.facebook.com/profile.php?id=61590357776476");
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Cycle duration selector
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setState(() => _selectedCycleDays = 7),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: _selectedCycleDays == 7 ? const Color(0xFF2B8A3E) : const Color(0xFFDEE2E6),
                            ),
                          ),
                          child: const Text("تحديد فترة", style: TextStyle(color: Color(0xFF212529))),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setState(() => _selectedCycleDays = 30),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: _selectedCycleDays == 30 ? const Color(0xFF2B8A3E) : const Color(0xFFDEE2E6),
                            ),
                          ),
                          child: const Text("شهر", style: TextStyle(color: Color(0xFF212529))),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    "تعديل تاريخ بداية الدورة الحالية",
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
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

          const SizedBox(height: 16),

          // About Card: حول التطبيق
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
                  const Text(
                    "دفتر التاجر",
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF2B8A3E)),
                  ),
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
