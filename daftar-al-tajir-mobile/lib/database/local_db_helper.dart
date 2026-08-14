import 'dart:convert';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import '../models/customer_model.dart';
import '../models/expense_model.dart';
import '../models/merchant_debt_model.dart';

class LocalDbHelper {
  static final LocalDbHelper instance = LocalDbHelper._init();
  static Database? _database;

  LocalDbHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('daftar_tajir_offline_v2.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
    // 1. Customers Table (ID is TEXT for UUID support)
    await db.execute('''
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        total_debt REAL NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 1
      )
    ''');

    // 2. Customer Debts / Invoices Table
    await db.execute('''
      CREATE TABLE customer_debts (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        amount REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        remaining_amount REAL NOT NULL DEFAULT 0,
        note TEXT,
        created_at TEXT NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 1
      )
    ''');

    // 3. Merchant Debts Table
    await db.execute('''
      CREATE TABLE merchant_debts (
        id TEXT PRIMARY KEY,
        supplier_name TEXT NOT NULL,
        supplier_phone TEXT,
        debt_type TEXT NOT NULL DEFAULT 'goods',
        total_amount REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        remaining_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'unpaid',
        description TEXT,
        is_synced INTEGER NOT NULL DEFAULT 1
      )
    ''');

    // 4. Expenses Table
    await db.execute('''
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        date TEXT NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 1
      )
    ''');

    // 5. EOD Records Table
    await db.execute('''
      CREATE TABLE eod_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eod_date TEXT NOT NULL,
        cash_sales REAL NOT NULL,
        bankak_sales REAL NOT NULL,
        total_sales REAL NOT NULL,
        total_expenses REAL NOT NULL,
        total_debt_payments REAL NOT NULL,
        total_other_income REAL NOT NULL,
        net_cashflow REAL NOT NULL,
        raw_json TEXT,
        is_synced INTEGER NOT NULL DEFAULT 1
      )
    ''');

    // 6. Reports & Overview Cache
    await db.execute('''
      CREATE TABLE reports_cache (
        id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    // 7. Pending Sync Queue
    await db.execute('''
      CREATE TABLE pending_sync_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');
  }

  // ================= Customers =================
  Future<void> cacheCustomers(List<CustomerModel> customers) async {
    final db = await instance.database;
    final batch = db.batch();
    batch.delete('customers');
    for (var c in customers) {
      batch.insert('customers', {
        'id': c.id,
        'name': c.name,
        'phone': c.phone,
        'total_debt': c.totalDebt,
        'is_synced': c.isSynced ? 1 : 0,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<CustomerModel>> getCachedCustomers() async {
    final db = await instance.database;
    final maps = await db.query('customers', orderBy: 'name ASC');
    return maps.map((m) => CustomerModel.fromJson(m)).toList();
  }

  Future<void> insertOfflineCustomer(CustomerModel customer) async {
    final db = await instance.database;
    await db.insert('customers', {
      'id': customer.id,
      'name': customer.name,
      'phone': customer.phone,
      'total_debt': customer.totalDebt,
      'is_synced': 0,
    }, conflictAlgorithm: ConflictAlgorithm.replace);

    await addPendingSync('create_customer', {
      'local_id': customer.id,
      'name': customer.name,
      'phone': customer.phone,
    });
  }

  Future<void> insertOfflineCustomerDebt(String customerId, double amount, String? description) async {
    final db = await instance.database;
    // Update local customer debt balance
    final maps = await db.query('customers', where: 'id = ?', whereArgs: [customerId]);
    if (maps.isNotEmpty) {
      final currentDebt = (maps.first['total_debt'] as num).toDouble();
      await db.update(
        'customers',
        {'total_debt': currentDebt + amount, 'is_synced': 0},
        where: 'id = ?',
        whereArgs: [customerId],
      );
    }

    final localDebtId = 'local_debt_${DateTime.now().millisecondsSinceEpoch}';
    await db.insert('customer_debts', {
      'id': localDebtId,
      'customer_id': customerId,
      'amount': amount,
      'paid_amount': 0,
      'remaining_amount': amount,
      'note': description,
      'created_at': DateTime.now().toIso8601String().split('T')[0],
      'is_synced': 0,
    });

    await addPendingSync('add_debt', {
      'customer_id': customerId,
      'amount': amount,
      'debt_type': 'DEBT',
      'description': description,
    });
  }

  Future<void> insertOfflineDebtPayment(String customerId, double amount) async {
    final db = await instance.database;
    final maps = await db.query('customers', where: 'id = ?', whereArgs: [customerId]);
    if (maps.isNotEmpty) {
      final currentDebt = (maps.first['total_debt'] as num).toDouble();
      final newDebt = (currentDebt - amount) < 0 ? 0.0 : (currentDebt - amount);
      await db.update(
        'customers',
        {'total_debt': newDebt, 'is_synced': 0},
        where: 'id = ?',
        whereArgs: [customerId],
      );
    }

    await addPendingSync('pay_debt', {
      'customer_id': customerId,
      'amount': amount,
    });
  }

  Future<void> insertOfflineDebtWaiver(String customerId, double amount, String? reason) async {
    final db = await instance.database;
    final maps = await db.query('customers', where: 'id = ?', whereArgs: [customerId]);
    if (maps.isNotEmpty) {
      final currentDebt = (maps.first['total_debt'] as num).toDouble();
      final newDebt = (currentDebt - amount) < 0 ? 0.0 : (currentDebt - amount);
      await db.update(
        'customers',
        {'total_debt': newDebt, 'is_synced': 0},
        where: 'id = ?',
        whereArgs: [customerId],
      );
    }

    await addPendingSync('waive_debt', {
      'customer_id': customerId,
      'amount': amount,
      'reason': reason,
    });
  }

  // ================= Merchant Debts =================
  Future<void> cacheMerchantDebts(List<MerchantDebtModel> debts) async {
    final db = await instance.database;
    final batch = db.batch();
    batch.delete('merchant_debts');
    for (var d in debts) {
      batch.insert('merchant_debts', {
        'id': d.id,
        'supplier_name': d.supplierName,
        'supplier_phone': d.supplierPhone,
        'debt_type': d.debtType,
        'total_amount': d.totalAmount,
        'paid_amount': d.paidAmount,
        'remaining_amount': d.remainingAmount,
        'status': d.status,
        'description': d.description,
        'is_synced': d.isSynced ? 1 : 0,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<MerchantDebtModel>> getCachedMerchantDebts() async {
    final db = await instance.database;
    final maps = await db.query('merchant_debts', orderBy: 'id DESC');
    return maps.map((m) => MerchantDebtModel.fromJson(m)).toList();
  }

  Future<void> insertOfflineMerchantDebt(MerchantDebtModel debt) async {
    final db = await instance.database;
    await db.insert('merchant_debts', {
      'id': debt.id,
      'supplier_name': debt.supplierName,
      'supplier_phone': debt.supplierPhone,
      'debt_type': debt.debtType,
      'total_amount': debt.totalAmount,
      'paid_amount': debt.paidAmount,
      'remaining_amount': debt.remainingAmount,
      'status': debt.status,
      'description': debt.description,
      'is_synced': 0,
    }, conflictAlgorithm: ConflictAlgorithm.replace);

    await addPendingSync('add_merchant_debt', {
      'supplier_name': debt.supplierName,
      'debt_type': debt.debtType,
      'total_amount': debt.totalAmount,
      'description': debt.description,
    });
  }

  // ================= Expenses =================
  Future<void> cacheExpenses(List<ExpenseModel> expenses) async {
    final db = await instance.database;
    final batch = db.batch();
    batch.delete('expenses');
    for (var e in expenses) {
      batch.insert('expenses', {
        'server_id': e.id.toString(),
        'amount': e.amount,
        'category': e.category,
        'note': e.note,
        'date': e.date,
        'is_synced': 1,
      });
    }
    await batch.commit(noResult: true);
  }

  Future<List<ExpenseModel>> getCachedExpenses() async {
    final db = await instance.database;
    final maps = await db.query('expenses', orderBy: 'id DESC');
    return maps.map((m) => ExpenseModel.fromJson(m)).toList();
  }

  Future<int> insertOfflineExpense(ExpenseModel expense) async {
    final db = await instance.database;
    final id = await db.insert('expenses', {
      'amount': expense.amount,
      'category': expense.category,
      'note': expense.note,
      'date': expense.date,
      'is_synced': 0,
    });
    await addPendingSync('add_expense', {
      'amount': expense.amount,
      'category': expense.category,
      'description': expense.note,
    });
    return id;
  }

  // ================= EOD Records =================
  Future<void> insertOfflineEOD(Map<String, dynamic> eodPayload, double netCashflow) async {
    final db = await instance.database;
    final sales = eodPayload['sales'] as Map<String, dynamic>? ?? {};
    final cash = (sales['cash_sales'] as num?)?.toDouble() ?? 0.0;
    final bank = (sales['bankak_sales'] as num?)?.toDouble() ?? 0.0;

    await db.insert('eod_records', {
      'eod_date': eodPayload['eod_date'] ?? DateTime.now().toIso8601String().split('T')[0],
      'cash_sales': cash,
      'bankak_sales': bank,
      'total_sales': cash + bank,
      'total_expenses': 0.0,
      'total_debt_payments': 0.0,
      'total_other_income': 0.0,
      'net_cashflow': netCashflow,
      'raw_json': jsonEncode(eodPayload),
      'is_synced': 0,
    });

    await addPendingSync('save_eod', eodPayload);
  }

  // ================= Reports Cache =================
  Future<void> cacheReports(Map<String, dynamic> reportData) async {
    final db = await instance.database;
    await db.insert('reports_cache', {
      'id': 'latest_report',
      'data_json': jsonEncode(reportData),
      'updated_at': DateTime.now().toIso8601String(),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<Map<String, dynamic>?> getCachedReports() async {
    final db = await instance.database;
    final maps = await db.query('reports_cache', where: 'id = ?', whereArgs: ['latest_report']);
    if (maps.isNotEmpty) {
      return jsonDecode(maps.first['data_json'] as String);
    }
    return null;
  }

  // ================= Pending Sync Queue =================
  Future<void> addPendingSync(String actionType, Map<String, dynamic> payload) async {
    final db = await instance.database;
    await db.insert('pending_sync_actions', {
      'action_type': actionType,
      'payload': jsonEncode(payload),
      'created_at': DateTime.now().toIso8601String(),
    });
  }

  Future<List<Map<String, dynamic>>> getPendingSyncActions() async {
    final db = await instance.database;
    return await db.query('pending_sync_actions', orderBy: 'id ASC');
  }

  Future<void> removePendingSyncAction(int id) async {
    final db = await instance.database;
    await db.delete('pending_sync_actions', where: 'id = ?', whereArgs: [id]);
  }

  // ================= Local Backup & Restore =================
  Future<Map<String, dynamic>> exportFullLocalBackup() async {
    final db = await instance.database;
    final customers = await db.query('customers');
    final customerDebts = await db.query('customer_debts');
    final merchantDebts = await db.query('merchant_debts');
    final expenses = await db.query('expenses');
    final eodRecords = await db.query('eod_records');
    final pendingSync = await db.query('pending_sync_actions');

    return {
      'schema_version': '2.0',
      'app_name': 'دفتر التاجر - نسخة احتياطية محلية',
      'exported_at': DateTime.now().toIso8601String(),
      'customers': customers,
      'customer_debts': customerDebts,
      'merchant_debts': merchantDebts,
      'expenses': expenses,
      'eod_records': eodRecords,
      'pending_sync_actions': pendingSync,
      'stats': {
        'customers_count': customers.length,
        'customer_debts_count': customerDebts.length,
        'merchant_debts_count': merchantDebts.length,
        'expenses_count': expenses.length,
        'eod_records_count': eodRecords.length,
      },
    };
  }

  Future<void> restoreFullLocalBackup(Map<String, dynamic> data) async {
    final db = await instance.database;
    await db.transaction((txn) async {
      final batch = txn.batch();
      
      // Clean old local state
      batch.delete('customers');
      batch.delete('customer_debts');
      batch.delete('merchant_debts');
      batch.delete('expenses');
      batch.delete('eod_records');
      batch.delete('pending_sync_actions');

      if (data['customers'] is List) {
        for (var row in data['customers']) {
          batch.insert('customers', Map<String, dynamic>.from(row), conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }

      if (data['customer_debts'] is List) {
        for (var row in data['customer_debts']) {
          batch.insert('customer_debts', Map<String, dynamic>.from(row), conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }

      if (data['merchant_debts'] is List) {
        for (var row in data['merchant_debts']) {
          batch.insert('merchant_debts', Map<String, dynamic>.from(row), conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }

      if (data['expenses'] is List) {
        for (var row in data['expenses']) {
          batch.insert('expenses', Map<String, dynamic>.from(row), conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }

      if (data['eod_records'] is List) {
        for (var row in data['eod_records']) {
          batch.insert('eod_records', Map<String, dynamic>.from(row), conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }

      await batch.commit(noResult: true);
    });
  }
}
