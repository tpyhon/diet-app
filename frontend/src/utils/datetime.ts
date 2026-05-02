// frontend/src/utils/datetime.ts
/**
 * 日時ユーティリティ
 * toISOString() はUTCを返すため、JST時刻をそのままISO文字列にする関数を用意する。
 * バックエンドはJSTのnaive datetimeとして保存するため、
 * Zサフィックスなし・JSTオフセットなしの文字列を送る。
 */

/**
 * Date オブジェクトをJSTのローカル時刻文字列として返す。
 * 例: 2026-05-01T21:30:00 （Zなし・オフセットなし）
 * バックエンドのSQLiteにそのままJST時刻として保存される。
 */
export function toJSTISOString(date: Date): string {
  // JSTオフセット +9時間を加算してUTCとして文字列化し、Zを除去する
  const jstOffset = 9 * 60 * 60 * 1000
  const jstDate   = new Date(date.getTime() + jstOffset)
  return jstDate.toISOString().replace('Z', '')
}

/**
 * 現在時刻をJSTのローカル時刻文字列として返す。
 */
export function nowJSTString(): string {
  return toJSTISOString(new Date())
}
