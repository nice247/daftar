import 'dart:convert';
import 'package:flutter/material.dart';
import '../../config/api_config.dart';
import '../../services/api_service.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  int _step = 1; // 1: Enter phone, 2: Enter OTP & New Password
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;
  final ApiService _api = ApiService();

  String _normalizeDigits(String input) {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (int i = 0; i < 10; i++) {
      input = input.replaceAll(arabicDigits[i], englishDigits[i]);
    }
    return input.replaceAll(' ', '').trim();
  }

  void _requestOTP() async {
    final phone = _normalizeDigits(_phoneController.text);
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("الرجاء إدخال رقم الهاتف")),
      );
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    setState(() => _isLoading = true);

    try {
      final res = await _api.post(ApiConfig.forgotPassword, {
        'phone': phone,
      });
      final data = jsonDecode(res.body);

      if (res.statusCode == 200) {
        if (mounted) setState(() => _step = 2);
        messenger.showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? "تم إرسال رمز التحقق بنجاح"),
            backgroundColor: const Color(0xFF2B8A3E),
          ),
        );
      } else {
        messenger.showSnackBar(
          SnackBar(
            content: Text(data['detail'] ?? "خطأ في طلب رمز الاستعادة"),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text("تعذر الاتصال بالخادم، يرجى التأكد من اتصال الإنترنت"),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _resetPassword() async {
    final phone = _normalizeDigits(_phoneController.text);
    final code = _normalizeDigits(_codeController.text);
    final newPass = _newPasswordController.text.trim();
    final confirmPass = _confirmPasswordController.text.trim();

    final messenger = ScaffoldMessenger.of(context);

    if (code.isEmpty || code.length < 4) {
      messenger.showSnackBar(
        const SnackBar(content: Text("الرجاء إدخال رمز التحقق المكون من 4 أرقام")),
      );
      return;
    }

    if (newPass.length < 6) {
      messenger.showSnackBar(
        const SnackBar(content: Text("يجب أن تتكون كلمة المرور من 6 خانات على الأقل")),
      );
      return;
    }

    if (newPass != confirmPass) {
      messenger.showSnackBar(
        const SnackBar(content: Text("كلمتا المرور غير متطابقتين")),
      );
      return;
    }

    final nav = Navigator.of(context);
    setState(() => _isLoading = true);

    try {
      final res = await _api.post(ApiConfig.resetPassword, {
        'phone': phone,
        'code': code,
        'new_password': newPass,
      });
      final data = jsonDecode(res.body);

      if (res.statusCode == 200) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text("تم إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول"),
            backgroundColor: Color(0xFF2B8A3E),
          ),
        );
        nav.pop();
      } else {
        messenger.showSnackBar(
          SnackBar(
            content: Text(data['detail'] ?? "فشل إعادة تعيين كلمة المرور"),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text("تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً"),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Text("استعادة كلمة المرور", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        centerTitle: true,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Graphic/Icon Container
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE9ECEF)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: const Color(0xFFE6FCF5),
                    child: Icon(
                      _step == 1 ? Icons.lock_reset : Icons.verified_user_outlined,
                      size: 34,
                      color: const Color(0xFF2B8A3E),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _step == 1 ? "استعادة كلمة المرور" : "تعيين كلمة المرور الجديدة",
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF212529)),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _step == 1
                        ? "أدخل رقم هاتفك المسجل وسنرسل لك رمز تأكيد لاستعادة حسابك"
                        : "تم إرسال رمز التأكيد إلى ${_phoneController.text}. أدخل الرمز وكلمة المرور الجديدة.",
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF6C757D)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Form Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE9ECEF)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_step == 1) ...[
                    TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: "رقم الهاتف المسجل",
                        hintText: "مثال: 0912345678",
                        prefixIcon: Icon(Icons.phone_android, color: Color(0xFF2B8A3E)),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2B8A3E),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: _isLoading ? null : _requestOTP,
                      child: _isLoading
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text("إرسال رمز التحقق", style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    ),
                  ] else ...[
                    TextField(
                      controller: _codeController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 20, letterSpacing: 6, fontWeight: FontWeight.bold),
                      decoration: const InputDecoration(
                        labelText: "رمز التحقق (OTP)",
                        hintText: "••••",
                        counterText: "",
                        prefixIcon: Icon(Icons.pin, color: Color(0xFF2B8A3E)),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _newPasswordController,
                      obscureText: _obscureNew,
                      decoration: InputDecoration(
                        labelText: "كلمة المرور الجديدة",
                        prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF2B8A3E)),
                        suffixIcon: IconButton(
                          icon: Icon(_obscureNew ? Icons.visibility_off : Icons.visibility, color: Colors.grey),
                          onPressed: () => setState(() => _obscureNew = !_obscureNew),
                        ),
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _confirmPasswordController,
                      obscureText: _obscureConfirm,
                      decoration: InputDecoration(
                        labelText: "تأكيد كلمة المرور الجديدة",
                        prefixIcon: const Icon(Icons.lock_reset, color: Color(0xFF2B8A3E)),
                        suffixIcon: IconButton(
                          icon: Icon(_obscureConfirm ? Icons.visibility_off : Icons.visibility, color: Colors.grey),
                          onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                        ),
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2B8A3E),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: _isLoading ? null : _resetPassword,
                      child: _isLoading
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text("حفظ كلمة المرور الجديدة", style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 10),
                    TextButton(
                      onPressed: () => setState(() => _step = 1),
                      child: const Text("تعديل رقم الهاتف أو إعادة الإرسال", style: TextStyle(color: Color(0xFF6C757D), fontSize: 13)),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
