import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import '../config/api_config.dart';
import '../widgets/update_dialog.dart';

class UpdateService {
  static Future<void> checkForUpdates(BuildContext context) async {
    try {
      final response = await http
          .get(Uri.parse('${ApiConfig.baseUrl}/app/version'))
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);

        int serverVersionCode = data['versionCode'] is int
            ? data['versionCode']
            : int.tryParse(data['versionCode'].toString()) ?? 1;

        int currentVersionCode = 1;
        try {
          final packageInfo = await PackageInfo.fromPlatform();
          currentVersionCode = int.tryParse(packageInfo.buildNumber) ?? 1;
        } catch (_) {}

        if (serverVersionCode > currentVersionCode) {
          if (context.mounted) {
            showDialog(
              context: context,
              barrierDismissible: !(data['forceUpdate'] == true),
              builder: (ctx) => UpdateDialog(
                versionName: data['versionName'] ?? '',
                downloadUrl: data['downloadUrl'] ?? '',
                forceUpdate: data['forceUpdate'] == true,
                releaseNotes: data['releaseNotes'] ?? '',
              ),
            );
          }
        }
      }
    } catch (e) {
      debugPrint("Update check skipped (offline or server dormant): $e");
    }
  }
}
