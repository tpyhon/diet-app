import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { X, Camera } from 'lucide-react';

interface Props {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const startScan = async () => {
      try {
        if (!videoRef.current) return;

        await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              onDetected(result.getText());
            }
            if (err && !(err instanceof NotFoundException)) {
              console.error('Scan error:', err);
            }
          }
        );
      } catch (e) {
        setError('カメラへのアクセスができませんでした。ブラウザの権限設定を確認してください。');
        console.error(e);
      }
    };

    startScan();

    return () => {
      // BrowserMultiFormatReader のクリーンアップ
      BrowserMultiFormatReader.releaseAllStreams();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-green-500" />
            <span className="font-semibold text-gray-700">バーコードをスキャン</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* カメラ映像 */}
        <div className="relative bg-black">
          {error ? (
            <div className="h-64 flex items-center justify-center p-6 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-64 object-cover"
              />
              {/* スキャンライン */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-0.5 bg-green-400 opacity-80 animate-scan" />
              </div>
              {/* スキャン枠 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-32 border-2 border-green-400 rounded-lg opacity-60" />
              </div>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 text-center">
          <p className="text-sm text-gray-500">
            商品のバーコードをカメラに向けてください
          </p>
          <button
            onClick={onClose}
            className="mt-3 text-sm text-red-400 hover:text-red-600 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
