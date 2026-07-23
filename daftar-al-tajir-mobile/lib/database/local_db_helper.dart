import 'dart:convert';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import '../models/customer_model.dart';
import '../models/expense_model.dart';

class LocalDbHelper {
  static final LocalDbHelper instance = LocalDbHelper._init();
  static Database? _database;

  LocalDbHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('daftar_tajir_offline.db');
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
    await db.execute('''
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        total_debt REAL NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 1
      )
    ''');

    await db.execute('''
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        date TEXT NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 1
      )
    ''');

    await db.execute('''
      CREATE TABLE eod_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_sales REAL NOT NULL,
        cash_amount REAL NOT NULL,
        bank_amount REAL NOT NULL,
        expenses_amount REAL NOT NULL,
        net_cash REAL NOT NULL,
        date TEXT NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 1
      )
    ''');

    await db.execute('''
      CREATE TABLE pending_sync_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');
  }

  // Customers Cache
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
        'is_synced': 1,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<CustomerModel>> getCachedCustomers() async {
    final db = await instance.database;
    final maps = await db.query('customers');
    return maps.map((m) => CustomerModel.fromJson(m)).toList();
  }

  // Expenses Cache & Offline Insert
  Future<void> cacheExpenses(List<ExpenseModel> expenses) async {
    final db = await instance.database;
    final batch = db.batch();
    for (var e in expenses) {
      batch.insert('expenses', e.toJson(), conflictAlgorithm: ConflictAlgorithm.replace);
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
      'note': expense.note,
      'date': expense.date,
    });
    return id;
  }

  // Pending Actions
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
}
