import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import '../config/api_config.dart';
import '../database/local_db_helper.dart';
import '../services/api_service.dart';

class SyncManager extends ChangeNotifier {
  bool _isOnline = true;
  bool _isSyncing = false;
  int _pendingCount = 0;

  bool get isOnline => _isOnline;
  bool get isSyncing => _isSyncing;
  int get pendingCount => _pendingCount;

  late StreamSubscription _connectivitySubscription;

  // Mapping from temporary local ID to real server UUID
  final Map<String, String> _idMapping = {};

  SyncManager() {
    _initConnectivity();
    _checkPendingCount();
  }

  void _initConnectivity() {
    Connectivity().checkConnectivity().then((results) {
      _updateConnectionStatus(results);
    });

    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((results) {
      _updateConnectionStatus(results);
    });
  }

  Future<void> _checkPendingCount() async {
    final actions = await LocalDbHelper.instance.getPendingSyncActions();
    _pendingCount = actions.length;
    notifyListeners();
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
      _pendingCount = pendingActions.length;
      final api = ApiService();

      for (var action in pendingActions) {
        int id = action['id'];
        String actionType = action['action_type'];
        Map<String, dynamic> payload = jsonDecode(action['payload']);

        bool success = false;

        try {
          if (actionType == 'create_customer') {
            final localId = payload['local_id'];
            final res = await api.post(ApiConfig.customers, {
              'name': payload['name'],
              'phone': payload['phone'],
            });
            if (res.statusCode == 200 || res.statusCode == 201) {
              final data = jsonDecode(res.body);
              final serverId = data['id']?.toString();
              if (localId != null && serverId != null) {
                _idMapping[localId.toString()] = serverId;
              }
              success = true;
            }
          } else if (actionType == 'add_debt') {
            var customerId = payload['customer_id']?.toString() ?? '';
            if (_idMapping.containsKey(customerId)) {
              customerId = _idMapping[customerId]!;
            }
            final res = await api.post(ApiConfig.customerDebt, {
              'customer_id': customerId,
              'amount': payload['amount'],
              'debt_type': payload['debt_type'] ?? 'DEBT',
              'description': payload['description'],
            });
            if (res.statusCode == 200 || res.statusCode == 201) {
              success = true;
            }
          } else if (actionType == 'pay_debt') {
            var customerId = payload['customer_id']?.toString() ?? '';
            if (_idMapping.containsKey(customerId)) {
              customerId = _idMapping[customerId]!;
            }
            final res = await api.post(ApiConfig.customerDebtPay, {
              'customer_id': customerId,
              'amount': payload['amount'],
            });
            if (res.statusCode == 200 || res.statusCode == 201) {
              success = true;
            }
          } else if (actionType == 'waive_debt') {
            var customerId = payload['customer_id']?.toString() ?? '';
            if (_idMapping.containsKey(customerId)) {
              customerId = _idMapping[customerId]!;
            }
            final res = await api.post(ApiConfig.customerDebtWaive, {
              'customer_id': customerId,
              'amount': payload['amount'],
              'reason': payload['reason'],
            });
            if (res.statusCode == 200 || res.statusCode == 201) {
              success = true;
            }
          } else if (actionType == 'add_expense') {
            final res = await api.post(ApiConfig.expenses, {
              'amount': payload['amount'],
              'category': payload['category'] ?? 'OTHER',
              'description': payload['description'] ?? payload['note'],
            });
            if (res.statusCode == 200 || res.statusCode == 201) {
              success = true;
            }
          } else if (actionType == 'add_merchant_debt') {
            final res = await api.post(ApiConfig.merchantDebts, {
              'supplier_name': payload['supplier_name'],
              'debt_type': payload['debt_type'] ?? 'goods',
              'total_amount': payload['total_amount'],
              'description': payload['description'],
            });
            if (res.statusCode == 200 || res.statusCode == 201) {
              success = true;
            }
          } else if (actionType == 'pay_merchant_debt') {
            final res = await api.post(ApiConfig.merchantDebtPay, {
              'merchant_debt_id': payload['merchant_debt_id'],
              'amount': payload['amount'],
              'payment_method': payload['payment_method'] ?? 'cash',
              'description': payload['description'],
            });
            if (res.statusCode == 200 || res.statusCode == 201) {
              success = true;
            }
          } else if (actionType == 'save_eod') {
            // Remap any local customer IDs in debt_payments if present
            if (payload['debt_payments'] != null && payload['debt_payments'] is List) {
              for (var dp in payload['debt_payments']) {
                final cId = dp['customer_id']?.toString();
                if (cId != null && _idMapping.containsKey(cId)) {
                  dp['customer_id'] = _idMapping[cId];
                }
              }
            }
            final res = await api.post(ApiConfig.eodSave, payload);
            if (res.statusCode == 200 || res.statusCode == 201) {
              success = true;
            }
          }
        } catch (itemError) {
          debugPrint("Error syncing item $id ($actionType): $itemError");
        }

        if (success) {
          await LocalDbHelper.instance.removePendingSyncAction(id);
        }
      }
    } catch (e) {
      debugPrint("Sync batch failed: $e");
    } finally {
      final actions = await LocalDbHelper.instance.getPendingSyncActions();
      _pendingCount = actions.length;
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
