import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  String? _token;
  bool _isLoading = true;
  bool _isLoggedIn = false;

  UserModel? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => _isLoggedIn;

  final ApiService _api = ApiService();

  AuthProvider() {
    checkSavedSession();
  }

  // Persistent Login Once Check (Facebook style)
  Future<void> checkSavedSession() async {
    _isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      _token = prefs.getString('access_token');
      final userJsonStr = prefs.getString('user_profile');

      if (_token != null && _token!.isNotEmpty) {
        if (userJsonStr != null && userJsonStr.isNotEmpty) {
          _user = UserModel.fromJson(jsonDecode(userJsonStr));
          _isLoggedIn = true;
        }

        // Silent refresh profile from backend if online
        fetchProfile();
      } else {
        _isLoggedIn = false;
        _user = null;
      }
    } catch (e) {
      debugPrint("Session check error: $e");
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> fetchProfile() async {
    try {
      final response = await _api.get('/users/me');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _user = UserModel.fromJson(data);
        _isLoggedIn = true;
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user_profile', jsonEncode(data));
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint("Profile fetch error (offline fallback): $e");
    }
    return false;
  }

  Future<Map<String, dynamic>> login(String phone, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.post('/auth/login', {
        'phone': phone,
        'password': password,
      });

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['access_token'] != null) {
        _token = data['access_token'];
        _user = UserModel.fromJson(data['user']);
        _isLoggedIn = true;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('access_token', _token!);
        await prefs.setString('user_profile', jsonEncode(data['user']));

        _isLoading = false;
        notifyListeners();
        return {'success': true};
      } else {
        _isLoading = false;
        notifyListeners();
        return {
          'success': false,
          'message': data['detail'] ?? 'فشل تسجيل الدخول، تحقق من رقم الهاتف وكلمة المرور'
        };
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return {'success': false, 'message': 'تعذر الاتصال بالخادم، يرجى الفحص'};
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _isLoggedIn = false;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('user_profile');

    notifyListeners();
  }
}
