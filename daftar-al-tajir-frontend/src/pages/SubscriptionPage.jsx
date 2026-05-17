import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI, ocrAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { UploadCloud, CheckCircle, AlertTriangle, Loader, Copy } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const ADMIN_ACCOUNT_NUMBER = '123456789'; // Replace with actual admin account number
const PLANS = {
  monthly: { name: 'شهري', price: 10000 },
  quarterly: { name: '3 أشهر', price: 25000 },
  semi_annual: { name: '6 أشهر', price: 45000 },
};

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('monthly');

  useEffect(() => {
    if (!authLoading) {
      loadSubscription();
    }
  }, [authLoading]);

  const loadSubscription = async () => {
    try {
      const response = await subscriptionAPI.getMy();
      setSubscription(response.data);
    } catch (error) {
      // It's okay if it fails, means no subscription yet
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
    formData.append('plan', selectedPlan);
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
  const daysRemaining = user?.subscription_end_date
    ? formatDistanceToNow(new Date(user.subscription_end_date), { addSuffix: true, locale: ar })
    : '';

  return (
    <div className="space-y-6 p-4 animate-fade-in">
      <div className="bg-white rounded-xl p-5 card-shadow">
        <h2 className="text-lg font-bold text-gray-800 mb-2">حالة الاشتراك</h2>
        {isSubscriptionActive ? (
          <div className="flex items-center gap-3 text-green-600">
            <CheckCircle size={24} />
            <div>
              <p className="font-bold">الاشتراك مفعل</p>
              <p className="text-sm text-gray-500">ينتهي {daysRemaining}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle size={24} />
            <div>
              <p className="font-bold">الاشتراك غير مفعل</p>
              <p className="text-sm text-gray-500">
                {user?.subscription_end_date ? `انتهى ${daysRemaining}` : 'لا يوجد اشتراك حالي'}
              </p>
            </div>
          </div>
        )}
      </div>

      {subscription && subscription.status === 'PENDING' && (
        <div className="bg-yellow-50 border-r-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex">
            <div className="py-1"><AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" /></div>
            <div>
              <p className="font-bold">لديك طلب تجديد قيد المراجعة.</p>
              <p className="text-sm">سيتم إشعارك عند تفعيله من قبل الإدارة.</p>
            </div>
          </div>
        </div>
      )}

      {(!subscription || subscription.status !== 'PENDING') && (
        <div className="bg-white rounded-xl p-5 card-shadow space-y-4">
          <h2 className="text-lg font-bold text-gray-800">تجديد الاشتراك</h2>
          
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center">
            <p className="text-sm text-primary-800">قم بتحويل مبلغ الاشتراك إلى حساب بنكك التالي:</p>
            <div className="flex items-center justify-center gap-2 my-2">
              <p className="text-2xl font-mono font-bold text-primary-900">{ADMIN_ACCOUNT_NUMBER}</p>
              <button onClick={() => copyToClipboard(ADMIN_ACCOUNT_NUMBER)} className="text-primary-600 hover:text-primary-800">
                <Copy size={20} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">اختر الباقة</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PLANS).map(([key, { name, price }]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPlan(key)}
                  className={`p-2 border rounded-lg text-center ${selectedPlan === key ? 'bg-primary-100 border-primary-500' : 'bg-gray-50'}`}
                >
                  <p className="font-bold text-sm">{name}</p>
                  <p className="text-xs">{price.toLocaleString()} ج.س</p>
                </button>
              ))}
            </div>
            <p className="text-center text-lg font-bold mt-4 text-primary-700">
              المبلغ المطلوب: {PLANS[selectedPlan].price.toLocaleString()} ج.س
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">إرفاق إشعار الدفع</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {preview ? (
                  <img src={preview} alt="Preview" className="mx-auto h-40 rounded-md" />
                ) : (
                  <>
                    <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none">
                        <span>اختر ملف</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                      </label>
                      <p className="pl-1">أو قم بسحبه وإفلاته هنا</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {ocrLoading && (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader className="animate-spin" size={20} />
              <span>جاري قراءة بيانات الإشعار...</span>
            </div>
          )}

          {ocrData && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
              <h4 className="font-bold">البيانات المستخرجة (للتأكيد):</h4>
              <p><strong>المبلغ:</strong> {ocrData.amount || 'لم يتم التعرف عليه'}</p>
              <p><strong>رقم العملية:</strong> {ocrData.transaction_id || 'لم يتم التعرف عليه'}</p>
              <p><strong>التاريخ:</strong> {ocrData.date || 'لم يتم التعرف عليه'}</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            {uploading ? 'جاري الرفع...' : 'تأكيد الدفع'}
          </button>
        </div>
      )}
    </div>
  );
}