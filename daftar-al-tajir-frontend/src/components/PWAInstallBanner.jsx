import { useState, useEffect } from 'react';
import { Download, X, Share2 } from 'lucide-react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Check if already in standalone mode (already installed & running)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) {
      return;
    }

    // 2. Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    if (ios) {
      // For iOS, since beforeinstallprompt doesn't fire, we show the guidance banner after 2 seconds
      const timer = setTimeout(() => {
        // Check if dismissed in this session
        const isDismissed = sessionStorage.getItem('pwa-dismissed') === 'true';
        if (!isDismissed) {
          setShowBanner(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    // 3. For Android/Chrome/Desktop PWA installation event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if dismissed in this session
      const isDismissed = sessionStorage.getItem('pwa-dismissed') === 'true';
      if (!isDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also check if app is installed successfully
    const handleAppInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setShowBanner(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    } else {
      // If rejected, keep the prompt in state for next time, but hide for now
      setShowBanner(false);
    }
  };

  const handleClose = () => {
    // Hide for this session only (sessionStorage), so next time they open the site it will show again
    sessionStorage.setItem('pwa-dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] md:bottom-6 md:left-auto md:right-6 md:max-w-sm animate-slide-up">
      <div className="bg-white/95 backdrop-blur-md border border-[#DEE2E6] text-[#212529] rounded-[12px] p-4 shadow-2xl flex flex-col gap-3 card-shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#F8F9FA] rounded-[12px] border border-[#DEE2E6] text-[#2B8A3E]">
              <Download size={22} className="animate-bounce" />
            </div>
            <div>
              <h4 className="font-black text-sm text-[#212529]">تثبيت تطبيق دفتر التاجر</h4>
              <p className="text-xs text-[#6C757D] mt-0.5">ثبّت التطبيق على شاشتك للوصول السريع بدون إنترنت ومتابعة حساباتك!</p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="text-[#6C757D] hover:text-[#212529] p-1 hover:bg-[#F1F3F5] rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {isIOS ? (
          <div className="bg-[#F8F9FA] p-2.5 rounded-[12px] border border-[#DEE2E6] flex items-center gap-2.5 text-[11px] text-[#6C757D]">
            <Share2 size={16} className="text-[#2B8A3E] flex-shrink-0" />
            <span>
              لتثبيت التطبيق: اضغط على زر <strong>المشاركة</strong> في متصفح سفاري ثم اختر <strong>إضافة إلى الصفحة الرئيسية (Add to Home Screen)</strong>.
            </span>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 bg-[#2B8A3E] hover:bg-[#237032] active:scale-[0.98] text-white font-extrabold text-xs rounded-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Download size={15} />
              <span>تثبيت الآن</span>
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2.5 bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#212529] font-bold text-xs rounded-[12px] transition-all cursor-pointer"
            >
              لاحقاً
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
