import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import '../database/local_db_helper.dart';
import '../services/api_service.dart';

class SyncManager extends ChangeNotifier {
  bool _isOnline = true;
  bool _isSyncing = false;

  bool get isOnline => _isOnline;
  bool get isSyncing => _isSyncing;

  late StreamSubscription _connectivitySubscription;

  SyncManager() {
    _initConnectivity();
  }

  void _initConnectivity() {
    Connectivity().checkConnectivity().then((results) {
      _updateConnectionStatus(results);
    });

    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((results) {
      _updateConnectionStatus(results);
    });
  }

  void _updateConnectionStatus(List<ConnectivityResult> results) {
    bool hasConnection = results.any((r) => r != ConnectivityResult.none);
    if (_isOnline != hasConnection) {
      _isOnline = hasConnection;
      notifyListeners();
      if (_isOnline) {
        syncPendingData();
      }
    }
  }

  Future<void> syncPendingData() async {
    if (!_isOnline || _isSyncing) return;
    _isSyncing = true;
    notifyListeners();

    try {
      final pendingActions = await LocalDbHelper.instance.getPendingSyncActions();
      final api = ApiService();

      for (var action in pendingActions) {
        int id = action['id'];
        String actionType = action['action_type'];
        Map<String, dynamic> payload = jsonDecode(action['payload']);

        bool success = false;
        if (actionType == 'add_expense') {
          final res = await api.post('/expenses/', payload);
          if (res.statusCode == 200 || res.statusCode == 201) {
            success = true;
          }
        } else if (actionType == 'add_debt') {
          final res = await api.post('/customers/debt', payload);
          if (res.statusCode == 200 || res.statusCode == 201) {
            success = true;
          }
        } else if (actionType == 'save_eod') {
          final res = await api.post('/eod/save', payload);
          if (res.statusCode == 200 || res.statusCode == 201) {
            success = true;
          }
        }

        if (success) {
          await LocalDbHelper.instance.removePendingSyncAction(id);
        }
      }
    } catch (e) {
      debugPrint("Sync failed: $e");
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _connectivitySubscription.cancel();
    super.dispose();
  }
}
