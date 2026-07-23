import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  final ApiService _api = ApiService();
  bool _uploading = false;

  void _copyAccountNumber() {
    Clipboard.setData(const ClipboardData(text: "7712964"));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("تم نسخ رقم حساب بنكك (7712964)"), backgroundColor: Color(0xFF2B8A3E)),
    );
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
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle, color: Color(0xFF2B8A3E), size: 24),
                      SizedBox(width: 6),
                      Text("الاشتراك مفعل", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF2B8A3E))),
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

                  // Dashed box
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F9FA),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFDEE2E6), width: 1.5),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.cloud_upload_outlined, color: Color(0xFF6C757D), size: 40),
                        const SizedBox(height: 8),
                        const Text("اختر ملف أو قم بسحبه وإفلاته هنا", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF2B8A3E))),
                        const SizedBox(height: 4),
                        const Text("PNG, JPG, GIF up to 10MB", style: TextStyle(fontSize: 10, color: Color(0xFF6C757D))),
                      ],
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
