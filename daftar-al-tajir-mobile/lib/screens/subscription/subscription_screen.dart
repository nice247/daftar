import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../services/api_service.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  File? _imageFile;
  bool _isUploading = false;
  final ApiService _api = ApiService();

  void _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source);
    if (picked != null) {
      setState(() {
        _imageFile = File(picked.path);
      });
    }
  }

  void _uploadReceipt() async {
    if (_imageFile == null) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _isUploading = true);

    try {
      final res = await _api.uploadFile('/subscriptions/upload-receipt', _imageFile!);
      if (res.statusCode == 200 || res.statusCode == 201) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text("تم رفع الإيصال وقراءته بالـ OCR بنجاح! تم إرسال الطلب للمراجعة"),
            backgroundColor: Color(0xFF059669),
          ),
        );
        if (mounted) {
          setState(() => _imageFile = null);
        }
      } else {
        messenger.showSnackBar(
          const SnackBar(content: Text("فشل قراءة الإيصال، تأكد من وضوح صورة إيصال بنكك")),
        );
      }
    } catch (e) {
      messenger.showSnackBar(
        const SnackBar(content: Text("تعذر رفع الإيصال، يرجى التأكد من الاتصال")),
      );
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("الاشتراك وإيصال بنكك")),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: const [
                    Icon(Icons.stars, color: Colors.amber, size: 48),
                    SizedBox(height: 12),
                    Text(
                      "اشتراك دفتر التاجر",
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    Text(
                      "قم بتحويل مبلغ الاشتراك عبر تطبيق بنكك، ثم ارفع صورة الإيصال ليتم التحقق والتحليل بالذكاء الاصطناعي (OCR) تلقائياً.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            Container(
              height: 220,
              decoration: BoxDecoration(
                color: Colors.grey.shade900,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white24),
              ),
              child: _imageFile != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.file(_imageFile!, fit: BoxFit.cover),
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.receipt_long_rounded, size: 64, color: Colors.grey),
                        SizedBox(height: 8),
                        Text("لم يتم تحديد صورة إيصال بعد", style: TextStyle(color: Colors.grey)),
                      ],
                    ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pickImage(ImageSource.camera),
                    icon: const Icon(Icons.camera_alt),
                    label: const Text("الكاميرا"),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pickImage(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library),
                    label: const Text("المعرض"),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _imageFile == null || _isUploading ? null : _uploadReceipt,
              icon: const Icon(Icons.cloud_upload),
              label: _isUploading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text("رفع الإيصال للتحقق فورا (OCR)"),
            ),
          ],
        ),
      ),
    );
  }
}
