import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import '../../config/api_config.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  final ApiService _api = ApiService();
  final ImagePicker _picker = ImagePicker();

  bool _uploading = false;
  File? _selectedImage;
  Map<String, dynamic>? _pendingSub;
  Map<String, dynamic>? _prices;

  final currencyFormat = NumberFormat('#,##0.##', 'ar');

  String formatCurrency(dynamic val) {
    if (val == null) return '0';
    final numVal = double.tryParse(val.toString()) ?? 0.0;
    return currencyFormat.format(numVal);
  }

  @override
  void initState() {
    super.initState();
    _checkPendingSubscription();
  }

  Future<void> _checkPendingSubscription() async {
    try {
      final res = await _api.get(ApiConfig.subscriptionMy);
      if (res.statusCode == 200) {
        final dynamic data = jsonDecode(res.body);
        if (data is List && data.isNotEmpty) {
          final pending = data.firstWhere(
            (s) => s['status'] == 'PENDING',
            orElse: () => null,
          );
          if (mounted) setState(() => _pendingSub = pending);
        }
      }
      
      final priceRes = await _api.get(ApiConfig.subscriptionPrices);
      if (priceRes.statusCode == 200) {
        if (mounted) setState(() => _prices = jsonDecode(priceRes.body));
      }
    } catch (_) {}
  }

  void _copyAccountNumber() {
    Clipboard.setData(const ClipboardData(text: "7712964"));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("تم نسخ الرقم"), backgroundColor: Color(0xFF2B8A3E)),
    );
  }

  Future<void> _pickAndUploadReceipt(ImageSource source) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final XFile? image = await _picker.pickImage(source: source, imageQuality: 85);
      if (image == null) return;

      final file = File(image.path);
      setState(() {
        _selectedImage = file;
        _uploading = true;
      });

      final streamedRes = await _api.uploadFile(
        ApiConfig.subscriptionUploadReceipt,
        file,
        fieldName: 'receipt_image',
      );
      final res = await http.Response.fromStream(streamedRes);

      if (res.statusCode == 200 || res.statusCode == 201) {
        messenger.showSnackBar(
          const SnackBar(content: Text("تم رفع الإشعار بنجاح. سيتم مراجعته وتفعيل الاشتراك."), backgroundColor: Color(0xFF2B8A3E)),
        );
        _checkPendingSubscription();
      } else {
        final err = jsonDecode(res.body);
        messenger.showSnackBar(SnackBar(content: Text(err['detail'] ?? "فشل رفع الإشعار")));
      }
    } catch (e) {
      messenger.showSnackBar(const SnackBar(content: Text("حدث خطأ أثناء رفع الصورة")));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).user;

    bool isSubscriptionActive = false;
    int diffDays = 0;
    if (user?.subscriptionEndDate != null) {
      try {
        final endDate = DateTime.parse(user!.subscriptionEndDate!);
        isSubscriptionActive = endDate.isAfter(DateTime.now());
        diffDays = endDate.difference(DateTime.now()).inDays.abs();
      } catch (_) {}
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Card 1: حالة الاشتراك
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("حالة الاشتراك", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF212529))),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(
                        isSubscriptionActive ? Icons.check_circle : Icons.warning_amber_rounded,
                        color: isSubscriptionActive ? const Color(0xFF2B8A3E) : Colors.red,
                        size: 24,
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isSubscriptionActive ? "الاشتراك مفعل" : "الاشتراك غير مفعل",
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: isSubscriptionActive ? const Color(0xFF2B8A3E) : Colors.red,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            user?.subscriptionEndDate != null
                                ? (isSubscriptionActive
                                    ? "ينتهي بعد $diffDays يوم (${user!.subscriptionEndDate})"
                                    : "انتهى منذ $diffDays يوم (${user!.subscriptionEndDate})")
                                : "لا يوجد اشتراك حالي",
                            style: const TextStyle(fontSize: 12, color: Color(0xFF6C757D)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Pending Notice
          if (_pendingSub != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF9DB),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFFEC99)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.hourglass_top, color: Color(0xFFD97706), size: 20),
                      SizedBox(width: 6),
                      Text("لديك طلب تجديد قيد المراجعة.", style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF212529), fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text("سيتم إشعارك عند تفعيله من قبل الإدارة.", style: TextStyle(fontSize: 11, color: Color(0xFF6C757D))),
                  if (_pendingSub!['ocr_data'] != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFDEE2E6))),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("البيانات المستخرجة (للتأكيد):", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                          const SizedBox(height: 4),
                          Text("المبلغ: ${formatCurrency(_pendingSub!['ocr_data']['amount'])} ج.س", style: const TextStyle(fontSize: 11)),
                          Text("رقم العملية: ${_pendingSub!['ocr_data']['reference_number'] ?? 'غير متوفر'}", style: const TextStyle(fontSize: 11)),
                          Text("التاريخ: ${_pendingSub!['ocr_data']['date'] ?? 'غير متوفر'}", style: const TextStyle(fontSize: 11)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Card 2: تجديد الاشتراك
          if (_pendingSub == null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("تجديد الاشتراك", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF212529))),
                    const SizedBox(height: 14),

                    // Instructions box
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8F9FA),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFDEE2E6)),
                      ),
                      child: Column(
                        children: [
                          Text(
                            "الرسوم الأساسية: ${formatCurrency(_prices?['monthly_price'] ?? 10000)} ج.س للشهر الواحد",
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF212529)),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            "يمكنك تحويل مبلغ لعدة أشهر دفعة واحدة (مثال: 100,000 تعني 10 أشهر)",
                            style: TextStyle(fontSize: 10, color: Color(0xFF6C757D)),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 12),
                          const Text("قم بالتحويل إلى حساب بنكك التالي:", style: TextStyle(fontSize: 12, color: Color(0xFF6C757D))),
                          const SizedBox(height: 8),
                          InkWell(
                            onTap: _copyAccountNumber,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.copy_outlined, color: Color(0xFF2B8A3E), size: 20),
                                const SizedBox(width: 8),
                                const Text(
                                  "7712964",
                                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF2B8A3E), letterSpacing: 2),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "بإسم بهاء الدين عثمان اسحق محمد",
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF212529)),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),
                    const Text("إرفاق إشعار الدفع", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF6C757D))),
                    const SizedBox(height: 8),

                    // Dashed file upload box
                    InkWell(
                      onTap: _uploading ? null : () {
                        showModalBottomSheet(
                          context: context,
                          builder: (ctx) => SafeArea(
                            child: Wrap(
                              children: [
                                ListTile(
                                  leading: const Icon(Icons.photo_library, color: Color(0xFF2B8A3E)),
                                  title: const Text("اختيار ملف / المعرض"),
                                  onTap: () {
                                    Navigator.pop(ctx);
                                    _pickAndUploadReceipt(ImageSource.gallery);
                                  },
                                ),
                                ListTile(
                                  leading: const Icon(Icons.camera_alt, color: Color(0xFF2B8A3E)),
                                  title: const Text("التقاط صورة بالكاميرا"),
                                  onTap: () {
                                    Navigator.pop(ctx);
                                    _pickAndUploadReceipt(ImageSource.camera);
                                  },
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8F9FA),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFDEE2E6), width: 1.5),
                        ),
                        child: Column(
                          children: [
                            _uploading
                                ? const CircularProgressIndicator(color: Color(0xFF2B8A3E))
                                : _selectedImage != null
                                    ? ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: Image.file(_selectedImage!, height: 120, width: double.infinity, fit: BoxFit.cover),
                                      )
                                    : const Icon(Icons.cloud_upload_outlined, color: Color(0xFF6C757D), size: 40),
                            const SizedBox(height: 8),
                            Text(
                              _uploading
                                  ? "جاري قراءة بيانات الإشعار..."
                                  : "اختر ملف أو قم بسحبه وإفلاته هنا",
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF2B8A3E)),
                            ),
                            const SizedBox(height: 4),
                            const Text("PNG, JPG, GIF up to 10MB", style: TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
