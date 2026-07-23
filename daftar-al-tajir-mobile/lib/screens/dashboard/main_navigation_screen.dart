import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import 'eod_screen.dart';
import '../customers/customers_screen.dart';
import '../reports/reports_screen.dart';
import '../subscription/subscription_screen.dart';
import '../settings/settings_screen.dart';
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

  final List<Widget> _merchantScreens = const [
    EodScreen(),
    CustomersScreen(),
    ReportsScreen(),
    SubscriptionScreen(),
    SettingsScreen(),
  ];

  final List<Widget> _adminScreens = const [
    AdminScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.user;
    final isAdmin = user?.isAdmin == true;

    final currentScreens = isAdmin ? _adminScreens : _merchantScreens;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          color: Colors.white,
          padding: const EdgeInsets.only(top: 30, left: 16, right: 16, bottom: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: () async {
                  await auth.logout();
                  if (context.mounted) {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    );
                  }
                },
                child: const Text("خروج", style: TextStyle(color: Colors.red, fontSize: 13, fontWeight: FontWeight.bold)),
              ),
              Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        "دفتر التاجر",
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF212529)),
                      ),
                      Text(
                        isAdmin ? "مدير النظام" : (user?.storeName ?? "على بركة الله"),
                        style: const TextStyle(fontSize: 11, color: Color(0xFF6C757D)),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2B8A3E),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text(
                      "دفتر",
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                ],
              ),
            ],
          ),
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
                    onPressed: () => setState(() => _currentIndex = 3),
                    child: const Text("سداد الآن", style: TextStyle(color: Colors.yellow, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          Expanded(child: currentScreens[_currentIndex < currentScreens.length ? _currentIndex : 0]),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex < currentScreens.length ? _currentIndex : 0,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        selectedItemColor: const Color(0xFF2B8A3E),
        unselectedItemColor: const Color(0xFF6C757D),
        selectedFontSize: 11,
        unselectedFontSize: 11,
        items: isAdmin
            ? const [
                BottomNavigationBarItem(
                  icon: Icon(Icons.shield_outlined),
                  activeIcon: Icon(Icons.shield),
                  label: "لوحة التحكم",
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.settings_outlined),
                  activeIcon: Icon(Icons.settings),
                  label: "الإعدادات",
                ),
              ]
            : const [
                BottomNavigationBarItem(
                  icon: Icon(Icons.home_outlined),
                  activeIcon: Icon(Icons.home),
                  label: "الملخص",
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.people_outline),
                  activeIcon: Icon(Icons.people),
                  label: "العملاء والموردين",
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.bar_chart_outlined),
                  activeIcon: Icon(Icons.bar_chart),
                  label: "التقارير",
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.credit_card_outlined),
                  activeIcon: Icon(Icons.credit_card),
                  label: "الاشتراك",
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.settings_outlined),
                  activeIcon: Icon(Icons.settings),
                  label: "الإعدادات",
                ),
              ],
      ),
    );
  }
}
