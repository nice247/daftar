import 'dart:convert';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  List<dynamic> _users = [];
  bool _isLoading = true;
  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  void _fetchUsers() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get('/admin/users');
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        setState(() {
          _users = data;
          _isLoading = false;
        });
        return;
      }
    } catch (e) {
      debugPrint("Admin fetch error: $e");
    }
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("لوحة تحكم المدير")),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _users.isEmpty
              ? const Center(child: Text("لا يوجد تجار حالياً"))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _users.length,
                  itemBuilder: (ctx, i) {
                    final u = _users[i];
                    return Card(
                      child: ListTile(
                        leading: const CircleAvatar(child: Icon(Icons.person)),
                        title: Text(u['business_name'] ?? u['full_name'] ?? u['phone']),
                        subtitle: Text("الهاتف: ${u['phone']} • الدور: ${u['role']}"),
                        trailing: Text(
                          u['subscription_status'] ?? 'مجاني',
                          style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
