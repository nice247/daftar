import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
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

  @override
  void initState() {
    super.initState();
    _checkPendingSubscription();
  }

  Future<void> _checkPendingSubscription() async {
    try {
      final res = await _api.get('/subscriptions/my-pending');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data != null && data['id'] != null) {
          setState(() => _pendingSub = data);
        }
      }
    } catch (_) {}
  }

  void _copyAccountNumber() {
    Clipboard.setData(const ClipboardData(text: "7712964"));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("تم نسخ رقم حساب بنكك (7712964)"), backgroundColor: Color(0xFF2B8A3E)),
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

      final streamedRes = await _api.uploadFile('/subscriptions/upload-receipt', file, fieldName: 'receipt');
      final res = await http.Response.fromStream(streamedRes);

      if (res.statusCode == 200 || res.statusCode == 201) {
        messenger.showSnackBar(
          const SnackBar(content: Text("تم إرسال إشعار الدفع بنجاح وهو قيد المراجعة"), backgroundColor: Color(0xFF2B8A3E)),
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
                children: [
                  const Text("حالة الاشتراك", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF212529))),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        user?.isFrozen == true ? Icons.cancel : Icons.check_circle,
                        color: user?.isFrozen == true ? Colors.red : const Color(0xFF2B8A3E),
                        size: 24,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        user?.isFrozen == true ? "الاشتراك مجمّد" : "الاشتراك مفعل",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: user?.isFrozen == true ? Colors.red : const Color(0xFF2B8A3E),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    user?.subscriptionEndDate != null
                        ? "ينتهي الاشتراك بتاريخ: ${user!.subscriptionEndDate}"
                        : "اشتراكك نشط",
                    style: const TextStyle(fontSize: 12, color: Color(0xFF6C757D)),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

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
                      Text("لديك طلب اشتراك قيد المراجعة", style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
                    ],
                  ),
                  const SizedBox(height: 6),
                  if (_pendingSub!['ocr_data'] != null) ...[
                    Text("المبلغ: ${_pendingSub!['ocr_data']['amount'] ?? ''} ج.س", style: const TextStyle(fontSize: 12, color: Color(0xFF212529))),
                    Text("رقم العملية: ${_pendingSub!['ocr_data']['reference_number'] ?? ''}", style: const TextStyle(fontSize: 12, color: Color(0xFF212529))),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Card 2: تجديد الاشتراك
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Center(
                    child: Text("تجديد الاشتراك", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF212529))),
                  ),
                  const SizedBox(height: 14),

                  // Light green box
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE6FCF5),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF96F2D7)),
                    ),
                    child: Column(
                      children: [
                        const Text(
                          "الرسوم الأساسية: 10,000 ج.س للشهر الواحد",
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF2B8A3E)),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          "(يمكنك تحويل مبلغ لعدة أشهر دفعة واحدة (مثال: 100,000 تعني 10 أشهر)",
                          style: TextStyle(fontSize: 10, color: Color(0xFF2B8A3E)),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        const Text("قم بالتحويل إلى حساب بنكك التالي:", style: TextStyle(fontSize: 12, color: Color(0xFF212529))),
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
                                style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Color(0xFF2B8A3E), letterSpacing: 2),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          "باسم بهاء الدين عثمان اسحق محمد",
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF212529)),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),
                  const Text("إرفاق إشعار الدفع", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF6C757D))),
                  const SizedBox(height: 8),

                  // Upload options buttons / Dashed box
                  InkWell(
                    onTap: _uploading ? null : () {
                      showModalBottomSheet(
                        context: context,
                        builder: (ctx) => SafeArea(
                          child: Wrap(
                            children: [
                              ListTile(
                                leading: const Icon(Icons.photo_library, color: Color(0xFF2B8A3E)),
                                title: const Text("اختيار من المعرض"),
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
                                      child: Image.file(_selectedImage!, height: 100, width: 100, fit: BoxFit.cover),
                                    )
                                  : const Icon(Icons.cloud_upload_outlined, color: Color(0xFF6C757D), size: 40),
                          const SizedBox(height: 8),
                          Text(
                            _uploading
                                ? "جاري قراءة واستخراج بيانات الإشعار..."
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
