import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }

  Future<Map<String, String>> _getHeaders({bool isJson = true}) async {
    final token = await _getToken();
    final headers = <String, String>{};
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<http.Response> get(String endpoint, {Map<String, String>? queryParams}) async {
    var uri = Uri.parse('${ApiConfig.baseUrl}$endpoint');
    if (queryParams != null && queryParams.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParams);
    }
    final headers = await _getHeaders();
    return await http.get(uri, headers: headers);
  }

  Future<http.Response> post(String endpoint, Map<String, dynamic> data) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$endpoint');
    final headers = await _getHeaders();
    return await http.post(uri, headers: headers, body: jsonEncode(data));
  }

  Future<http.Response> put(String endpoint, Map<String, dynamic> data) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$endpoint');
    final headers = await _getHeaders();
    return await http.put(uri, headers: headers, body: jsonEncode(data));
  }

  Future<http.Response> delete(String endpoint) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$endpoint');
    final headers = await _getHeaders();
    return await http.delete(uri, headers: headers);
  }

  Future<http.StreamedResponse> uploadFile(String endpoint, File file, {String fieldName = 'file'}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$endpoint');
    final token = await _getToken();
    final request = http.MultipartRequest('POST', uri);
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    request.files.add(await http.MultipartFile.fromPath(fieldName, file.path));
    return await request.send();
  }
}
