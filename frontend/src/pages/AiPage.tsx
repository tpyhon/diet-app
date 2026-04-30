import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAiAdvice } from '../api'
import { Bot, RefreshCw, Loader2, TrendingDown, Footprints, Dumbbell, Flame } from 'lucide-react'

// マークダウン風テキストを簡易レンダリング
function AdviceText({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {text.split('\n').filter(Boolean).map((line, i) => {
        // ■ で始まる行はセクションヘッダー
        if (line.startsWith('■')) {
          return (
            <div key={i} className="flex items-center gap-2 mt-4 first:mt-0">
              <div className="w-1 h-5 bg-green-500 rounded-full" />
              <p className="font-bold text-gray-800 text-sm">{line}</p>
            </div>
          )
        }
        // ・ や - で始まる行はリスト
        if (line.startsWith('・') || line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <p key={i} className="text-sm text-gray-600 pl-4 flex gap-2">
              <span className="text-green-500 shrink-0">›</span>
              <span>{line.replace(/^[・\-•]\s*/, '')}</span>
            </p>
          )
        }
        return <p key={i} className="text-sm text-gray-600 leading-relaxed">{line}</p>
      })}
    </div>
  )
}

// データサマリーカード
function SummaryChip({
  icon, label, value
}: {
  icon: React.ReactNode; label: string; value: string
}) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2">
      <div className="text-gray-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-700">{value}</p>
      </div>
    </div>
  )
}

export default function AiPage() {
  const [enabled, setEnabled] = useState(false)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['aiAdvice'],
    queryFn: () => fetchAiAdvice().then(r => r.data),
    enabled,               // 手動で取得
    staleTime: 1000 * 60 * 10,  // 10分キャッシュ
  })

  const handleFetch = () => {
    if (!enabled) {
      setEnabled(true)
    } else {
      refetch()
    }
  }

  const summary = data?.summary

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Bot className="text-purple-500" size={22} />
          AIアドバイス
        </h2>
        <button
          onClick={handleFetch}
          disabled={isLoading || isFetching}
          className="flex items-center gap-1 bg-purple-500 text-white px-4 py-2
                     rounded-xl text-sm font-semibold hover:bg-purple-600
                     disabled:opacity-50 transition-colors"
        >
          {(isLoading || isFetching)
            ? <><Loader2 size={15} className="animate-spin" />分析中...</>
            : <><RefreshCw size={15} />レポート生成</>
          }
        </button>
      </div>

      {/* 初期状態 */}
      {!enabled && !data && (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
            <Bot size={32} className="text-purple-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Gemma AIがあなたを分析します</p>
            <p className="text-sm text-gray-400">
              過去7日間の食事・運動・体重データを元に<br />
              パーソナライズされたアドバイスを生成します
            </p>
          </div>
          <button
            onClick={handleFetch}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600
                       text-white rounded-xl font-semibold hover:from-purple-600
                       hover:to-purple-700 transition-all shadow-sm"
          >
            🤖 レポートを生成する
          </button>
          <p className="text-xs text-gray-300">※ Gemma 4 26B による生成（数秒かかります）</p>
        </div>
      )}

      {/* ローディング */}
      {(isLoading || isFetching) && (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-3">
          <Loader2 size={36} className="animate-spin text-purple-400 mx-auto" />
          <p className="text-sm text-gray-500">Gemma AIがデータを分析中...</p>
          <p className="text-xs text-gray-300">しばらくお待ちください</p>
        </div>
      )}

      {/* 結果表示 */}
      {data && !isFetching && (
        <>
          {/* データサマリー */}
          {summary && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                分析データ（過去7日間）
              </p>
              <div className="grid grid-cols-2 gap-2">
                <SummaryChip
                  icon={<Flame size={14} />}
                  label="1日平均摂取"
                  value={`${summary.avg_daily_calories} kcal`}
                />
                <SummaryChip
                  icon={<Footprints size={14} />}
                  label="ウォーキング"
                  value={`${summary.walk_km} km / ${summary.walk_count}回`}
                />
                <SummaryChip
                  icon={<Dumbbell size={14} />}
                  label="筋トレ回数"
                  value={`${summary.training_count} 回`}
                />
                <SummaryChip
                  icon={<TrendingDown size={14} />}
                  label="体重変化"
                  value={
                    summary.weight_start && summary.weight_end
                      ? `${summary.weight_start}→${summary.weight_end} kg`
                      : 'データなし'
                  }
                />
              </div>
            </div>
          )}

          {/* AIアドバイス本文 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
                <Bot size={15} className="text-purple-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Gemma 4 からのアドバイス</p>
            </div>
            <AdviceText text={data.advice} />
          </div>

          {/* 再生成ボタン */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="w-full py-3 border-2 border-purple-200 text-purple-500 rounded-xl
                       text-sm font-semibold hover:bg-purple-50 transition-colors
                       flex items-center justify-center gap-2"
          >
            <RefreshCw size={15} />
            アドバイスを再生成する
          </button>
        </>
      )}

    </div>
  )
}
