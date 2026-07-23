import 'package:flutter_test/flutter_test.dart';
import 'package:daftar_al_tajir_mobile/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const DaftarTajirApp());
    expect(find.byType(DaftarTajirApp), findsOneWidget);
  });
}
