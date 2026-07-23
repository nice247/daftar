export default function LoadingSpinner({ size = 'md', text = 'جاري التحميل...' }) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className={`${sizes[size]} border-[3px] border-[#DEE2E6] border-t-[#2B8A3E] rounded-full animate-spin`} />
      {text && <p className="text-sm text-[#6C757D]">{text}</p>}
    </div>
  );
}
