import { useEffect, useRef, useState, useCallback } from 'react';
import { createScene, type AppState } from './scene';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);
  const [state, setState] = useState<AppState>({
    sensor: { temp: null, humid: null, gas: null, feed: null },
    device: { roofWindow: true, sideWindow: true, conveyor: false, lights: false },
    connection: { status: 'connecting' },
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = createScene(containerRef.current, (newState) => {
      setState({ ...newState });
    });
    sceneRef.current = scene;
    setTimeout(() => {
      setLoading(false);
      showToast('Kandang peternakan siap');
    }, 600);
    return () => scene.dispose();
  }, [showToast]);

  const handleCommand = (device: string) => {
    if (!sceneRef.current) return;
    const current = state.device[device as keyof typeof state.device];
    sceneRef.current.sendCommand(device as any, !current);
  };

  const handleView = (view: string) => {
    if (!sceneRef.current) return;
    sceneRef.current.setView(view);
  };

  const formatVal = (v: number | null, decimals: number, unit: string) =>
    v == null ? '--' : v.toFixed(decimals) + unit;

  return (
    <>
      {/* Loading screen */}
      <div
        id="load"
        style={{
          opacity: loading ? 1 : 0,
          pointerEvents: loading ? 'auto' : 'none',
          transition: 'opacity 0.5s ease',
        }}
      >
        Memuat kandang…
      </div>

      {/* Three.js container */}
      <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />

      {/* Header */}
      <div id="hdr">
        <h1>
          <span
            id="conn"
            style={{
              background: state.connection.status === 'connected' ? '#10b981' : '#f59e0b',
            }}
          />
          Commercial Poultry Coop
        </h1>
        <div className="sub">Smart Farming IoT · 2.4m × 0.8m</div>
      </div>

      {/* Camera buttons */}
      <div id="cam">
        <button onClick={() => handleView('iso')} title="Isometrik">◩</button>
        <button onClick={() => handleView('front')} title="Depan">▣</button>
        <button onClick={() => handleView('inside')} title="Dalam">◉</button>
        <button onClick={() => handleView('top')} title="Atas">⊞</button>
      </div>

      {/* Sensor panel */}
      <div className="panel" id="sp">
        <div className="ph">Sensor</div>
        <div className="g">
          <div className="card" style={{ borderColor: '#f59e0b' }}>
            <div className="l">Suhu</div>
            <div className="v" style={{ color: '#f59e0b' }}>
              {formatVal(state.sensor.temp, 1, '°C')}
            </div>
          </div>
          <div className="card" style={{ borderColor: '#06b6d4' }}>
            <div className="l">Lembap</div>
            <div className="v" style={{ color: '#06b6d4' }}>
              {formatVal(state.sensor.humid, 0, '%')}
            </div>
          </div>
          <div className="card" style={{ borderColor: '#ef4444' }}>
            <div className="l">Gas NH₃</div>
            <div className="v" style={{ color: '#ef4444' }}>
              {formatVal(state.sensor.gas, 0, ' ppm')}
            </div>
          </div>
          <div className="card" style={{ borderColor: '#10b981' }}>
            <div className="l">Pakan</div>
            <div className="v" style={{ color: '#10b981' }}>
              {formatVal(state.sensor.feed, 0, '%')}
            </div>
          </div>
        </div>
      </div>

      {/* Control panel */}
      <div className="panel" id="cp">
        <div className="ph">Kontrol</div>
        <div className="g">
          {(['roofWindow', 'sideWindow', 'conveyor', 'lights'] as const).map((d) => (
            <button
              key={d}
              className={`btn ${state.device[d] ? 'on' : ''}`}
              onClick={() => handleCommand(d)}
            >
              <i>
                {d === 'roofWindow' && '🪟'}
                {d === 'sideWindow' && '🚪'}
                {d === 'conveyor' && '⚙️'}
                {d === 'lights' && '💡'}
              </i>
              <span>
                {d === 'roofWindow' && 'Jendela Atap'}
                {d === 'sideWindow' && 'Jendela Depan'}
                {d === 'conveyor' && 'Conveyor'}
                {d === 'lights' && 'Lampu'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      <div id="toast" className={toast ? 's' : ''}>
        {toast}
      </div>
    </>
  );
}
