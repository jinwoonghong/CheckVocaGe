import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ProSettings, Density } from '@core';
import { loadProSettings, saveProSettings } from '../pro/settings';

function App() {
  const [s, setS] = useState<ProSettings | null>(null);
  // no-op placeholder for future filtering

  useEffect(() => { loadProSettings().then(setS); }, []);
  if (!s) return <div>Loading...</div>;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>WebVoca Pro Settings</h2>
      <div class="row">
        <label style={{ minWidth: 160 }}>하이라이트 활성화</label>
        <input type="checkbox" checked={s.proHighlightEnabled} onChange={async (e) => {
          const v = (e.target as HTMLInputElement).checked;
          const next = { ...s, proHighlightEnabled: v };
          setS(next); await saveProSettings({ proHighlightEnabled: v });
        }} />
      </div>
      <div class="row">
        <label style={{ minWidth: 160 }}>밀도</label>
        <select value={s.proHighlightDensity} onChange={async (e) => {
          const v = (e.target as HTMLSelectElement).value as Density;
          const next = { ...s, proHighlightDensity: v };
          setS(next); await saveProSettings({ proHighlightDensity: v });
        }}>
          <option value="low">낮음</option>
          <option value="medium">보통</option>
          <option value="high">높음</option>
        </select>
      </div>
      <div class="row" style={{ alignItems: 'flex-start' }}>
        <label style={{ minWidth: 160 }}>도메인 허용(화이트리스트)</label>
        <div style={{ flex: 1 }}>
          <textarea rows={4} style={{ width: '100%' }} value={(s.whitelist || []).join('\n')} onInput={(e) => {
            const arr = (e.target as HTMLTextAreaElement).value.split(/\n+/).map(x => x.trim()).filter(Boolean);
            setS({ ...s, whitelist: arr });
          }} />
          <small>예: example.com, *.example.com</small>
        </div>
      </div>
      <div class="row" style={{ alignItems: 'flex-start' }}>
        <label style={{ minWidth: 160 }}>도메인 차단(블랙리스트)</label>
        <div style={{ flex: 1 }}>
          <textarea rows={4} style={{ width: '100%' }} value={(s.blacklist || []).join('\n')} onInput={(e) => {
            const arr = (e.target as HTMLTextAreaElement).value.split(/\n+/).map(x => x.trim()).filter(Boolean);
            setS({ ...s, blacklist: arr });
          }} />
        </div>
      </div>
      <div class="row">
        <button onClick={async () => { await saveProSettings({ whitelist: s.whitelist, blacklist: s.blacklist }); }}>저장</button>
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root')!);
