import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI, ocrAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { UploadCloud, CheckCircle, AlertTriangle, Loader, Copy } from 'lucide-react';
import { formatDate } from '../utils/helpers'; // Using built-in helper

const ADMIN_ACCOUNT_NUMBER = '7712964'; // Correct account number
const ADMIN_ACCOUNT_NAME = 'بهاء الدين عثمان اسحق محمد'; // Account name

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState(10000);

  useEffect(() => {
    if (!authLoading) {
      loadSubscription();
    }
  }, [authLoading]);

  const loadSubscription = async () => {
    try {
      const [subRes, priceRes] = await Promise.all([
        subscriptionAPI.getMy().catch(() => ({ data: null })),
        subscriptionAPI.getPrices().catch(() => ({ data: { monthly: 10000 } }))
      ]);
      if (subRes && subRes.data) {
        setSubscription(subRes.data);
      }
      if (priceRes && priceRes.data && priceRes.data.monthly) {
        setMonthlyPrice(priceRes.data.monthly);
      }
    } catch (error) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      handleOcrExtract(file);
    }
  };

  const handleOcrExtract = async (file) => {
    setOcrLoading(true);
    setOcrData(null);
    const formData = new FormData();
    formData.append('receipt_image', file);
    try {
      const response = await ocrAPI.extract(formData);
      setOcrData(response.data);
      toast.success('تم استخراج بيانات الإشعار');
    } catch (error) {
      toast.error('فشل في قراءة الإشعار تلقائياً. يمكنك إدخال البيانات يدوياً.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('الرجاء اختيار صورة الإشعار');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('receipt_image', selectedFile);
    if (ocrData) {
      formData.append('ocr_data', JSON.stringify(ocrData));
    }

    try {
      await subscriptionAPI.uploadReceipt(formData);
      toast.success('تم رفع الإشعار بنجاح. سيتم مراجعته وتفعيل الاشتراك.');
      setSelectedFile(null);
      setPreview(null);
      setOcrData(null);
      loadSubscription();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل في رفع الإشعار');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ الرقم');
  };

  if (loading || authLoading) {
    return <div className="text-center p-8">جاري تحميل بيانات الاشتراك...</div>;
  }

  const isSubscriptionActive = user && new Date(user.subscription_end_date) > new Date();
  
  // Custom simple logic instead of date-fns
  let daysRemaining = '';
  if (user?.subscription_end_date) {
    const end = new Date(user.subscription_end_date);
    const today = new Date();
    const diffTime = Math.abs(end - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (end > today) {
       daysRemaining = `بعد ${diffDays} يوم`;
    } else {
       daysRemaining = `منذ ${diffDays} يوم`;
    }
  }

  return (
    <div className="space-y-6 p-4 animate-fade-in pb-8">
      <div className="bg-white rounded-[12px] p-5 border border-[#DEE2E6] card-shadow">
        <h2 className="text-lg font-bold text-[#212529] mb-2">حالة الاشتراك</h2>
        {isSubscriptionActive ? (
          <div className="flex items-center gap-3 text-[#2B8A3E]">
            <CheckCircle size={24} />
            <div>
              <p className="font-bold">الاشتراك مفعل</p>
              <p className="text-sm text-[#6C757D]">ينتهي {daysRemaining} ({formatDate(user.subscription_end_date)})</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle size={24} />
            <div>
              <p className="font-bold">الاشتراك غير مفعل</p>
              <p className="text-sm text-[#6C757D]">
                {user?.subscription_end_date ? `انتهى ${daysRemaining} (${formatDate(user.subscription_end_date)})` : 'لا يوجد اشتراك حالي'}
              </p>
            </div>
          </div>
        )}
      </div>

      {subscription && subscription.status === 'PENDING' && (
        <div className="bg-[#F8F9FA] border border-amber-500/30 p-4 rounded-[12px]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-bold text-[#212529] text-sm">لديك طلب تجديد قيد المراجعة.</p>
              <p className="text-xs text-[#6C757D]">سيتم إشعارك عند تفعيله من قبل الإدارة.</p>
            </div>
          </div>
        </div>
      )}

      {(!subscription || subscription.status !== 'PENDING') && (
        <div className="bg-white rounded-[12px] p-5 border border-[#DEE2E6] card-shadow space-y-4">
          <h2 className="text-lg font-bold text-[#212529]">تجديد الاشتراك</h2>
          
          <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-[12px] p-4 text-center">
            <p className="text-sm text-[#212529] mb-2 font-bold">الرسوم الأساسية: {Number(monthlyPrice).toLocaleString()} ج.س للشهر الواحد</p>
            <p className="text-xs text-[#6C757D] mb-3">يمكنك تحويل مبلغ لعدة أشهر دفعة واحدة (مثال: {(Number(monthlyPrice) * 10).toLocaleString()} تعني 10 أشهر)</p>
            <p className="text-sm text-[#6C757D]">قم بالتحويل إلى حساب بنكك التالي:</p>
            <div className="flex items-center justify-center gap-2 my-2">
              <p className="text-2xl font-mono font-bold text-[#2B8A3E]">{ADMIN_ACCOUNT_NUMBER}</p>
              <button onClick={() => copyToClipboard(ADMIN_ACCOUNT_NUMBER)} className="text-[#6C757D] hover:text-[#212529]">
                <Copy size={20} />
              </button>
            </div>
            <p className="text-sm font-bold text-[#212529] mt-2">بإسم {ADMIN_ACCOUNT_NAME}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6C757D] mb-2">إرفاق إشعار الدفع</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#DEE2E6] border-dashed rounded-[12px] bg-[#F8F9FA]">
              <div className="space-y-1 text-center">
                {preview ? (
                  <img src={preview} alt="Preview" className="mx-auto h-40 rounded-[12px] border border-[#DEE2E6]" />
                ) : (
                  <>
                    <UploadCloud className="mx-auto h-12 w-12 text-[#6C757D]" />
                    <div className="flex text-sm text-[#6C757D] justify-center items-center gap-1">
                      <label htmlFor="file-upload" className="relative cursor-pointer font-bold text-[#2B8A3E] hover:text-[#237032] focus-within:outline-none">
                        <span>اختر ملف</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                      </label>
                      <p className="text-xs">أو قم بسحبه وإفلاته هنا</p>
                    </div>
                    <p className="text-[10px] text-[#6C757D]">PNG, JPG, GIF up to 10MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {ocrLoading && (
            <div className="flex items-center justify-center gap-2 text-[#6C757D]">
              <Loader className="animate-spin" size={20} />
              <span>جاري قراءة بيانات الإشعار...</span>
            </div>
          )}

          {ocrData && (
            <div className="bg-[#F8F9FA] border border-[#DEE2E6] rounded-[12px] p-3 space-y-2 text-sm text-[#212529]">
              <h4 className="font-bold">البيانات المستخرجة (للتأكيد):</h4>
              <p><strong>المبلغ:</strong> {ocrData.amount ? `${ocrData.amount.toLocaleString()} ج.س` : 'لم يتم التعرف عليه'}</p>
              <p><strong>رقم العملية:</strong> {ocrData.reference_number || 'لم يتم التعرف عليه'}</p>
              <p><strong>التاريخ:</strong> {ocrData.date || 'لم يتم التعرف عليه'}</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="w-full py-3.5 bg-[#2B8A3E] hover:bg-[#237032] text-white rounded-[12px] font-bold text-sm disabled:opacity-50 transition-colors"
          >
            {uploading ? 'جاري الرفع...' : 'تأكيد الدفع'}
          </button>
        </div>
      )}
    </div>
  );
}