import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../database/sync_manager.dart';

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<SyncManager>(
      builder: (context, syncManager, child) {
        if (syncManager.isOnline && !syncManager.isSyncing) {
          return const SizedBox.shrink();
        }

        if (syncManager.isSyncing) {
          return Container(
            width: double.infinity,
            color: Colors.blue.shade700,
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
                SizedBox(width: 8),
                Text(
                  "جاري مزامنة البيانات المحفوضة أوفلاين...",
                  style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          );
        }

        return Container(
          width: double.infinity,
          color: Colors.amber.shade800,
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.wifi_off_rounded, color: Colors.white, size: 16),
              SizedBox(width: 8),
              Text(
                "أنت تعمل في وضع عدم الاتصال (Offline) - يتم حفظ التغييرات محلياً",
                style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        );
      },
    );
  }
}
