import 'dart:convert';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Map<String, dynamic>? _reports;
  bool _isLoading = true;
  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();
    _fetchReports();
  }

  void _fetchReports() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get('/reports/');
      if (res.statusCode == 200) {
        setState(() {
          _reports = jsonDecode(res.body);
          _isLoading = false;
        });
        return;
      }
    } catch (e) {
      debugPrint("Reports fetch error: $e");
    }
    setState(() => _isLoading = false);
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: color.withOpacity(0.15),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.grey, fontSize: 13)),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async => _fetchReports(),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    "الملخص والتقارير المالية",
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  _buildStatCard(
                    "إجمالي المبيعات",
                    "${_reports?['total_sales'] ?? 0} ج.س",
                    Icons.trending_up,
                    Colors.green,
                  ),
                  const SizedBox(height: 12),
                  _buildStatCard(
                    "إجمالي المصروفات",
                    "${_reports?['total_expenses'] ?? 0} ج.س",
                    Icons.money_off,
                    Colors.orange,
                  ),
                  const SizedBox(height: 12),
                  _buildStatCard(
                    "إجمالي ديون العملاء عليك",
                    "${_reports?['total_customer_debts'] ?? 0} ج.س",
                    Icons.account_balance_wallet,
                    Colors.red,
                  ),
                  const SizedBox(height: 12),
                  _buildStatCard(
                    "صافي الأرباح المقدّرة",
                    "${_reports?['net_profit'] ?? 0} ج.س",
                    Icons.savings,
                    const Color(0xFF059669),
                  ),
                ],
              ),
            ),
    );
  }
}
