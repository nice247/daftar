import 'dart:convert';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  int _step = 1; // 1: enter phone, 2: enter code & new password
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _newPasswordController = TextEditingController();

  bool _isLoading = false;
  final ApiService _api = ApiService();

  void _requestOTP() async {
    if (_phoneController.text.trim().isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _isLoading = true);

    try {
      final res = await _api.post('/auth/forgot-password', {
        'phone': _phoneController.text.trim(),
      });
      final data = jsonDecode(res.body);

      if (res.statusCode == 200) {
        if (mounted) setState(() => _step = 2);
        messenger.showSnackBar(
          const SnackBar(content: Text("تم إرسال رمز إعادة التعيين")),
        );
      } else {
        messenger.showSnackBar(
          SnackBar(content: Text(data['detail'] ?? "خطأ في طلب الرمز")),
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

  void _resetPassword() async {
    if (_codeController.text.trim().isEmpty || _newPasswordController.text.trim().isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    setState(() => _isLoading = true);

    try {
      final res = await _api.post('/auth/reset-password', {
        'phone': _phoneController.text.trim(),
        'code': _codeController.text.trim(),
        'new_password': _newPasswordController.text.trim(),
      });
      final data = jsonDecode(res.body);

      if (res.statusCode == 200) {
        messenger.showSnackBar(
          const SnackBar(content: Text("تم تعيين كلمة المرور بنجاح! يمكنك تسجيل الدخول الان")),
        );
        nav.pop();
      } else {
        messenger.showSnackBar(
          SnackBar(content: Text(data['detail'] ?? "فشل اعادة تعيين كلمة المرور")),
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
      appBar: AppBar(title: const Text("استعادة كلمة المرور")),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_step == 1) ...[
              const Text(
                "أدخل رقم هاتفك لاستلام رمز التفعيل",
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: "رقم الهاتف",
                  prefixIcon: Icon(Icons.phone),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _requestOTP,
                child: _isLoading ? const CircularProgressIndicator() : const Text("إرسال الرمز"),
              ),
            ] else ...[
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "رمز التفعيل (OTP)",
                  prefixIcon: Icon(Icons.pin),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _newPasswordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: "كلمة المرور الجديدة",
                  prefixIcon: Icon(Icons.lock),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _resetPassword,
                child: _isLoading ? const CircularProgressIndicator() : const Text("حفظ كلمة المرور الجديدة"),
              ),
            ]
          ],
        ),
      ),
    );
  }
}
