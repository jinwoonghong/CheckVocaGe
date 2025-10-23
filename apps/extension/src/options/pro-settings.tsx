import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ProSettings, Density, Theme } from '@core';
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
        <label style={{ minWidth: 160 }}>최대 하이라이트 수</label>
        <input type="number" min={10} max={400} value={s.maxHighlights ?? 60} onInput={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value, 10);
          setS({ ...s, maxHighlights: isNaN(v) ? 60 : v });
        }} />
      </div>
      <div class="row">
        <label style={{ minWidth: 160 }}>동적 페이지 대응</label>
        <input type="checkbox" checked={s.observeMutations ?? true} onChange={(e) => {
          const v = (e.target as HTMLInputElement).checked;
          setS({ ...s, observeMutations: v });
        }} />
        <small>DOM 변경 감지 후 재적용</small>
      </div>
      <div class="row">
        <label style={{ minWidth: 160 }}>테마</label>
        <select value={s.theme ?? 'gold'} onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value as Theme;
          setS({ ...s, theme: v });
        }}>
          <option value="gold">골드(기본)</option>
          <option value="underline">밑줄</option>
          <option value="blue">블루</option>
          <option value="high-contrast">고대비</option>
        </select>
      </div>
      <div class="row">
        <button onClick={async () => { await saveProSettings({
          proHighlightEnabled: s.proHighlightEnabled,
          proHighlightDensity: s.proHighlightDensity,
          whitelist: s.whitelist,
          blacklist: s.blacklist,
          maxHighlights: s.maxHighlights,
          observeMutations: s.observeMutations,
          theme: s.theme,
        }); }}>저장</button>
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root')!);
