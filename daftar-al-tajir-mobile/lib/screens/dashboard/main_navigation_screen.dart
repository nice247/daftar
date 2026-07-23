import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import 'eod_screen.dart';
import '../customers/customers_screen.dart';
import '../expenses/expenses_screen.dart';
import '../merchant_debts/merchant_debts_screen.dart';
import '../reports/reports_screen.dart';
import '../subscription/subscription_screen.dart';
import '../admin/admin_screen.dart';
import '../../services/update_service.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      UpdateService.checkForUpdates(context);
    });
  }

  final List<Widget> _screens = const [
    EodScreen(),
    CustomersScreen(),
    ExpensesScreen(),
    MerchantDebtsScreen(),
    ReportsScreen(),
  ];

  final List<String> _titles = const [
    "التقفيل اليومي",
    "سجل الديون والعملاء",
    "المصروفات اليومية",
    "ديون الموردين",
    "التقارير المالية",
  ];

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_currentIndex]),
        actions: [
          IconButton(
            icon: const Icon(Icons.verified_user_outlined),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
              );
            },
            tooltip: "الاشتراك وإيصال بنكك",
          ),
          if (user?.isAdmin == true)
            IconButton(
              icon: const Icon(Icons.admin_panel_settings),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AdminScreen()),
                );
              },
              tooltip: "لوحة الإدارة",
            ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF059669)),
              accountName: Text(user?.businessName ?? "دفتر التاجر"),
              accountEmail: Text("هاتف: ${user?.phone ?? ''}"),
              currentAccountPicture: const CircleAvatar(
                backgroundColor: Colors.white,
                child: Icon(Icons.store, color: Color(0xFF059669), size: 36),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.subscriptions),
              title: const Text("الاشتراك وإيصال بنكك"),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
                );
              },
            ),
            if (user?.isAdmin == true)
              ListTile(
                leading: const Icon(Icons.admin_panel_settings),
                title: const Text("لوحة المدير (Admin)"),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminScreen()),
                  );
                },
              ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text("تسجيل الخروج", style: TextStyle(color: Colors.red)),
              onTap: () async {
                final navState = Navigator.of(context);
                await auth.logout();
                navState.pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              },
            ),
          ],
        ),
      ),
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF10B981),
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.space_dashboard_rounded),
            label: "التقفيل",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.people_alt_rounded),
            label: "العملاء",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long_rounded),
            label: "المصروفات",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.local_shipping_rounded),
            label: "الموردين",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.analytics_rounded),
            label: "التقارير",
          ),
        ],
      ),
    );
  }
}
