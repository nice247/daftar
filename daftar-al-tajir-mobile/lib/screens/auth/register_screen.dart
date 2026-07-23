import 'dart:convert';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  int _step = 1; // 1: phone request, 2: OTP verification, 3: full registration details
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _businessNameController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  final ApiService _api = ApiService();

  void _requestPhoneVerification() async {
    if (_phoneController.text.trim().isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _isLoading = true);

    try {
      final res = await _api.post('/auth/verify-phone', {
        'phone': _phoneController.text.trim(),
      });
      final data = jsonDecode(res.body);

      if (res.statusCode == 200) {
        if (mounted) setState(() => _step = 2);
        messenger.showSnackBar(
          const SnackBar(content: Text("تم إرسال رمز التوثيق بنجاح")),
        );
      } else {
        messenger.showSnackBar(
          SnackBar(content: Text(data['detail'] ?? "خطأ في طلب رمز التوثيق")),
        );
      }
    } catch (e) {
      messenger.showSnackBar(
        const SnackBar(content: Text("تعذر الاتصال بالخادم")),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _confirmPhoneCode() async {
    if (_codeController.text.trim().isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _isLoading = true);

    try {
      final res = await _api.post('/auth/confirm-phone', {
        'phone': _phoneController.text.trim(),
        'code': _codeController.text.trim(),
      });
      final data = jsonDecode(res.body);

      if (res.statusCode == 200) {
        if (mounted) setState(() => _step = 3);
      } else {
        messenger.showSnackBar(
          SnackBar(content: Text(data['detail'] ?? "رمز التوثيق غير صحيح")),
        );
      }
    } catch (e) {
      messenger.showSnackBar(
        const SnackBar(content: Text("تعذر الاتصال بالخادم")),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _completeRegister() async {
    if (_passwordController.text.trim().isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    setState(() => _isLoading = true);

    try {
      final res = await _api.post('/auth/register', {
        'phone': _phoneController.text.trim(),
        'full_name': _fullNameController.text.trim(),
        'business_name': _businessNameController.text.trim(),
        'password': _passwordController.text.trim(),
      });
      final data = jsonDecode(res.body);

      if (res.statusCode == 200 || res.statusCode == 201) {
        messenger.showSnackBar(
          const SnackBar(content: Text("تم التسجيل بنجاح! يمكنك تسجيل الدخول الآن")),
        );
        nav.pop();
      } else {
        messenger.showSnackBar(
          SnackBar(content: Text(data['detail'] ?? "فشل التسجيل")),
        );
      }
    } catch (e) {
      messenger.showSnackBar(
        const SnackBar(content: Text("تعذر الاتصال بالخادم")),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("إنشاء حساب جديد")),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_step == 1) ...[
              const Text(
                "الخطوة 1: أدخل رقم الهاتف",
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: "رقم الهاتف (0XXXXXXXXX)",
                  prefixIcon: Icon(Icons.phone_android),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _requestPhoneVerification,
                child: _isLoading
                    ? const CircularProgressIndicator()
                    : const Text("إرسال رمز التقرير / التفعيل"),
              ),
            ] else if (_step == 2) ...[
              const Text(
                "الخطوة 2: أدخل رمز التفعيل (OTP)",
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "رمز التقرير مكون من 6 أرقام",
                  prefixIcon: Icon(Icons.pin),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _confirmPhoneCode,
                child: _isLoading
                    ? const CircularProgressIndicator()
                    : const Text("تأكيد الرمز"),
              ),
            ] else ...[
              const Text(
                "الخطوة 3: بيانات التاجر",
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _fullNameController,
                decoration: const InputDecoration(
                  labelText: "الاسم الكامل",
                  prefixIcon: Icon(Icons.person),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _businessNameController,
                decoration: const InputDecoration(
                  labelText: "اسم الدكان / المتجر",
                  prefixIcon: Icon(Icons.store),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: "كلمة المرور",
                  prefixIcon: Icon(Icons.lock),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _completeRegister,
                child: _isLoading
                    ? const CircularProgressIndicator()
                    : const Text("إكمال التسجيل والدخول"),
              ),
            ]
          ],
        ),
      ),
    );
  }
}
