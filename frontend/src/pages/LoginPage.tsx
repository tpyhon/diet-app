import { useState } from 'react'
import { loginApi, registerApi } from '../api'

type Props = { onLogin: (token: string, user: { username: string; display_name: string }) => void }

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode]         = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [dispName, setDispName] = useState('')
  const [error, setError]       = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      let res
      if (mode === 'login') {
        res = await loginApi(username, password)
      } else {
        res = await registerApi(username, password, dispName)
      }
      const { access_token, username: uname, display_name } = res.data
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('user', JSON.stringify({ username: uname, display_name }))
      onLogin(access_token, { username: uname, display_name })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'エラーが発生しました')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-green-600 text-center mb-6">💪 My Diet App</h1>
        <div className="flex mb-6 rounded-lg overflow-hidden border border-gray-200">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-green-600 text-white' : 'bg-white text-gray-500'}`}
            onClick={() => setMode('login')}
          >ログイン</button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-green-600 text-white' : 'bg-white text-gray-500'}`}
            onClick={() => setMode('register')}
          >新規登録</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="表示名（任意）"
              value={dispName}
              onChange={e => setDispName(e.target.value)}
            />
          )}
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="ユーザー名"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="パスワード"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            {mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </form>
      </div>
    </div>
  )
}
