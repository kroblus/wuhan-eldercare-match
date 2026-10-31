import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { UIProvider, ConfirmationHost } from '../ui';
import { brand } from '../evergreen/tokens';
import '../theme.css';
import './public-demo.css';
import App from '../App';
import { initializeDemo, exportDemo, resetDemo } from './store';
for (const [name, value] of Object.entries(brand))
  document.documentElement.style.setProperty('--' + name, value);
const root = ReactDOM.createRoot(document.getElementById('root')!);
// No application effect (including /session) runs before this local store is ready.
function Recovery({ cause }: { cause: unknown }) {
  const [error, setError] = useState('');
  async function backup() {
    try {
      const url = URL.createObjectURL(new Blob([await exportDemo()], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = '快康养-演示数据恢复备份.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <main className="demo-entry">
      <div className="demo-entry-card">
        <h1>浏览器演示存储暂不可用</h1>
        <p>{cause instanceof Error ? cause.message : '无法初始化本地数据。'}</p>
        <p>
          请允许本站使用本地存储，或在普通浏览窗口重试。版本不兼容时先导出备份，再显式重置；网站更新不会静默清空数据。
        </p>
        {error && <p role="alert">{error}</p>}
        <button onClick={() => location.reload()}>重试初始化</button>
        <button onClick={() => void backup()}>导出原始演示备份</button>
        <button
          onClick={async () => {
            if (!window.confirm('已保留备份？此操作会重置本项目演示数据，其他站点不受影响。'))
              return;
            try {
              await resetDemo();
              location.reload();
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          确认后重置演示
        </button>
      </div>
    </main>
  );
}
initializeDemo()
  .then(() =>
    root.render(
      <UIProvider>
        <ConfirmationHost />
        <App />
      </UIProvider>,
    ),
  )
  .catch((e: unknown) => root.render(<Recovery cause={e} />));
