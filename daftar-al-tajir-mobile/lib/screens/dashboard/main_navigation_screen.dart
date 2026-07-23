import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import 'eod_screen.dart';
import '../customers/customers_screen.dart';
import '../expenses/expenses_screen.dart';
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
    ReportsScreen(),
  ];

  final List<String> _titles = const [
    "التقفيل اليومي",
    "سجل الديون والعملاء",
    "المصروفات اليومية",
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
            icon: const Icon(Icons.stars, color: Color(0xFF2B8A3E)),
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
              icon: const Icon(Icons.admin_panel_settings, color: Color(0xFF2B8A3E)),
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
              decoration: const BoxDecoration(color: Color(0xFF2B8A3E)),
              accountName: Text(user?.storeName ?? "دفتر التاجر", style: const TextStyle(fontWeight: FontWeight.bold)),
              accountEmail: Text("هاتف: ${user?.phone ?? ''}"),
              currentAccountPicture: const CircleAvatar(
                backgroundColor: Colors.white,
                child: Icon(Icons.store, color: Color(0xFF2B8A3E), size: 36),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.space_dashboard_rounded, color: Color(0xFF2B8A3E)),
              title: const Text("التقفيل اليومي"),
              onTap: () {
                Navigator.pop(context);
                setState(() => _currentIndex = 0);
              },
            ),
            ListTile(
              leading: const Icon(Icons.people_alt_rounded, color: Color(0xFF2B8A3E)),
              title: const Text("الديون والعملاء"),
              onTap: () {
                Navigator.pop(context);
                setState(() => _currentIndex = 1);
              },
            ),
            ListTile(
              leading: const Icon(Icons.receipt_long_rounded, color: Color(0xFF2B8A3E)),
              title: const Text("المصروفات اليومية"),
              onTap: () {
                Navigator.pop(context);
                setState(() => _currentIndex = 2);
              },
            ),
            ListTile(
              leading: const Icon(Icons.analytics_rounded, color: Color(0xFF2B8A3E)),
              title: const Text("التقارير المالية"),
              onTap: () {
                Navigator.pop(context);
                setState(() => _currentIndex = 3);
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.verified_user_outlined),
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
                leading: const Icon(Icons.admin_panel_settings, color: Colors.blue),
                title: const Text("لوحة المدير (Admin Panel)"),
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
      body: Column(
        children: [
          if (user?.isFrozen == true)
            Container(
              width: double.infinity,
              color: Colors.red.shade700,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              child: Row(
                children: [
                  const Icon(Icons.warning, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      "اشتراكك منتهي ومجمّد. يرجى سداد الاشتراك ورفع إيصال بنكك لتفعيل الحساب.",
                      style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
                      );
                    },
                    child: const Text("سداد الآن", style: TextStyle(color: Colors.yellow, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          Expanded(child: _screens[_currentIndex]),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF2B8A3E),
        unselectedItemColor: const Color(0xFF6C757D),
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
            icon: Icon(Icons.analytics_rounded),
            label: "التقارير",
          ),
        ],
      ),
    );
  }
}
