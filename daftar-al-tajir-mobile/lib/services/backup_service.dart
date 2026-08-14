import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../config/api_config.dart';
import '../database/local_db_helper.dart';
import 'api_service.dart';

class MobileBackupService {
  final ApiService _api = ApiService();

  // 1. Fetch Cloud Backup Summary
  Future<Map<String, dynamic>?> getCloudSummary() async {
    try {
      final res = await _api.get(ApiConfig.backupSummary);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      debugPrint("Get backup summary error: $e");
    }
    return null;
  }

  // 2. Export Cloud Backup
  Future<Map<String, dynamic>?> exportCloudBackup() async {
    try {
      final res = await _api.get(ApiConfig.backupExport);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      debugPrint("Export cloud backup error: $e");
    }
    return null;
  }

  // 3. Restore Cloud Backup
  Future<Map<String, dynamic>> restoreCloudBackup(
    Map<String, dynamic> backupData, {
    bool replaceMode = false,
  }) async {
    try {
      final res = await _api.post(
        '${ApiConfig.backupRestore}?replace_mode=$replaceMode',
        backupData,
      );
      final data = jsonDecode(res.body);
      if (res.statusCode == 200) {
        return {'success': true, 'data': data};
      }
      return {
        'success': false,
        'message': data['detail'] ?? 'فشل في استعادة النسخة الاحتياطية'
      };
    } catch (e) {
      return {'success': false, 'message': 'تعذر الاتصال بالخادم: $e'};
    }
  }

  // 4. Export Local SQLite Backup
  Future<Map<String, dynamic>> exportLocalBackup() async {
    return await LocalDbHelper.instance.exportFullLocalBackup();
  }

  // 5. Restore Local SQLite Backup
  Future<void> restoreLocalBackup(Map<String, dynamic> localData) async {
    await LocalDbHelper.instance.restoreFullLocalBackup(localData);
  }
}
