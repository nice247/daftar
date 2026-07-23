import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand & Aesthetic Color Palette
  static const Color primaryGreen = Color(0xFF2B8A3E);
  static const Color primaryGreenDark = Color(0xFF1E602B);
  static const Color primaryGreenLight = Color(0xFFE6FCF5);

  static const Color accentAmber = Color(0xFFD97706);
  static const Color accentAmberLight = Color(0xFFFFF9DB);

  static const Color dangerRed = Color(0xFFE03131);
  static const Color dangerRedLight = Color(0xFFFFF0F0);

  static const Color infoBlue = Color(0xFF1C7ED6);
  static const Color infoBlueLight = Color(0xFFE7F5FF);

  static const Color bgWhite = Color(0xFFFFFFFF);
  static const Color bgLightGrey = Color(0xFFF8F9FA);
  static const Color borderGrey = Color(0xFFE9ECEF);
  static const Color borderCard = Color(0xFFDEE2E6);

  static const Color textDark = Color(0xFF212529);
  static const Color textMuted = Color(0xFF6C757D);

  static ThemeData get lightTheme {
    final baseTextTheme = ThemeData.light().textTheme;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: primaryGreen,
      scaffoldBackgroundColor: bgLightGrey,
      cardColor: bgWhite,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryGreen,
        primary: primaryGreen,
        secondary: accentAmber,
        surface: bgWhite,
        error: dangerRed,
      ),
      textTheme: GoogleFonts.cairoTextTheme(baseTextTheme).copyWith(
        displayLarge: GoogleFonts.cairo(fontWeight: FontWeight.bold, color: textDark),
        titleLarge: GoogleFonts.cairo(fontWeight: FontWeight.bold, color: textDark, fontSize: 18),
        titleMedium: GoogleFonts.cairo(fontWeight: FontWeight.bold, color: textDark, fontSize: 15),
        bodyLarge: GoogleFonts.cairo(color: textDark, fontSize: 14),
        bodyMedium: GoogleFonts.cairo(color: textDark, fontSize: 13),
        bodySmall: GoogleFonts.cairo(color: textMuted, fontSize: 11),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bgWhite,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: true,
        iconTheme: const IconThemeData(color: textDark),
        titleTextStyle: GoogleFonts.cairo(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: textDark,
        ),
      ),
      cardTheme: CardThemeData(
        color: bgWhite,
        elevation: 0,
        margin: const EdgeInsets.only(bottom: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: borderCard, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgWhite,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: borderCard),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: borderCard),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: primaryGreen, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: GoogleFonts.cairo(color: textMuted, fontSize: 13),
        hintStyle: GoogleFonts.cairo(color: textMuted.withOpacity(0.7), fontSize: 13),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryGreen,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.cairo(
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: textDark,
          side: const BorderSide(color: borderCard),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.cairo(
            fontSize: 13,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  static ThemeData get darkTheme => lightTheme;
}
