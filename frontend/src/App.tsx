import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import PriceChart from './chart';
//aaaaa
interface TradeData {
  symbol: string;
  price: number;
  timestamp: number;
  is_anomaly: boolean;
  deviation: number;
}

interface RecordStats {
  id: number;
  symbol: string;
  price: number;
  time: string;
  deviation: number;
}

// Tipo para nuestro diccionario de gráficos
type ChartHistory = Record<string, { x: number; y: number }[]>;

function App() {
  const [activeSymbol, setActiveSymbol] = createSignal<string>("BTCUSDT");
  const [status, setStatus] = createSignal<string>("Conectando...");
  
  // ESTADO GLOBAL DE GRÁFICOS (Aquí guardamos todo, aunque no lo mires)
  const [allCharts, setAllCharts] = createSignal<ChartHistory>({
    BTCUSDT: [],
    ETHUSDT: [],
    SOLUSDT: []
  });

  // Estado para mostrar el precio actual (solo visual)
  const [currentPrice, setCurrentPrice] = createSignal<number>(0);
  const [lastUpdate, setLastUpdate] = createSignal<string>("");
  const [isAnomaly, setIsAnomaly] = createSignal<boolean>(false);

  // Listas de Alertas
  const [topRisers, setTopRisers] = createSignal<RecordStats[]>([]);
  const [topFallers, setTopFallers] = createSignal<RecordStats[]>([]);
  const [recentAnomalies, setRecentAnomalies] = createSignal<RecordStats[]>([]);

  // Función para cambiar de moneda
  const changeSymbol = (symbol: string) => {
    setActiveSymbol(symbol);
    // Al cambiar, actualizamos el precio visual inmediatamente con el último dato que tengamos guardado
    const history = allCharts()[symbol];
    if (history && history.length > 0) {
      const lastPoint = history[history.length - 1];
      setCurrentPrice(lastPoint.y);
      setIsAnomaly(false); // Reseteamos la alerta visual del header
    }
  };

  onMount(() => {
    // Detectar si estamos en local o en producción
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Si estamos en localhost usamos el puerto 8000, si no, usamos la variable de entorno (que pondremos luego)
  const wsUrl = import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/ws`
    : `${protocol}//127.0.0.1:8000/ws`;

  const ws = new WebSocket(wsUrl);

    ws.onopen = () => setStatus("Conectado 🟢");

    ws.onmessage = (event) => {
      const data: TradeData = JSON.parse(event.data);
      const timeStr = new Date(data.timestamp).toLocaleTimeString();
      
      // 1. GUARDAR EN EL HISTORIAL (SIEMPRE, para todas las monedas)
      setAllCharts((prev) => {
        const currentHistory = prev[data.symbol] || [];
        const newPoint = { x: data.timestamp, y: data.price };
        
        // Mantenemos 300 puntos por moneda
        const updatedHistory = [...currentHistory, newPoint].slice(-300);
        
        return { ...prev, [data.symbol]: updatedHistory };
      });

      // 2. ACTUALIZAR VISUAL (Solo si es la moneda activa)
      if (data.symbol === activeSymbol()) {
        setCurrentPrice(data.price);
        setIsAnomaly(data.is_anomaly);
        setLastUpdate(timeStr);
      }

      // 3. PROCESAR ALERTAS (Para todas)
      if (data.is_anomaly) {
        const newRecord = { 
          id: Date.now(), 
          symbol: data.symbol, 
          price: data.price, 
          time: timeStr, 
          deviation: data.deviation 
        };

        setRecentAnomalies(prev => [newRecord, ...prev].slice(0, 10));

        if (data.deviation > 0) {
          setTopRisers(prev => {
            const newList = [...prev, newRecord];
            return newList.sort((a, b) => b.deviation - a.deviation).slice(0, 5);
          });
        } else {
          setTopFallers(prev => {
            const newList = [...prev, newRecord];
            return newList.sort((a, b) => a.deviation - b.deviation).slice(0, 5);
          });
        }
      }
    };

    ws.onclose = () => setStatus("Desconectado 🔴");
    onCleanup(() => ws.close());
  });

  return (
    <div style={{ "background-color": "#0F172A", "color": "white", "min-height": "100vh", "width": "100%", "padding": "1rem", "box-sizing": "border-box", "font-family": "system-ui, sans-serif" }}>
      
      <div style={{ "display": "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "1.5rem", "padding": "0 1rem" }}>
        <div>
           <h1 style={{ "margin": "0", "font-size": "1.8rem" }}>MarketPulse AI ⚡</h1>
           <p style={{ "color": "#64748B", "margin": "0", "font-size": "0.9rem" }}>Estado: {status()}</p>
        </div>
        
        {/* SELECTOR */}
        <div style={{ "display": "flex", "gap": "10px", "background": "#1E293B", "padding": "5px", "border-radius": "8px" }}>
          <For each={["BTCUSDT", "ETHUSDT", "SOLUSDT"]}>
            {(sym) => (
              <button 
                onClick={() => changeSymbol(sym)}
                style={{
                  "background": activeSymbol() === sym ? "#3B82F6" : "transparent",
                  "color": activeSymbol() === sym ? "white" : "#94A3B8",
                  "border": "none",
                  "padding": "8px 16px",
                  "border-radius": "6px",
                  "cursor": "pointer",
                  "font-weight": "bold",
                  "transition": "all 0.2s"
                }}
              >
                {sym.replace("USDT", "")}
              </button>
            )}
          </For>
        </div>
      </div>

      <div style={{ "display": "grid", "grid-template-columns": "3fr 1fr", "gap": "1.5rem", "width": "100%" }}>
        
        {/* COLUMNA IZQUIERDA */}
        <div style={{ "display": "flex", "flex-direction": "column", "gap": "20px" }}>
          <div style={{ "background-color": "#1E293B", "padding": "2rem", "border-radius": "1rem", "border": isAnomaly() ? "2px solid #F59E0B" : "2px solid #334155", "box-shadow": "0 10px 15px -3px rgba(0, 0, 0, 0.5)", "height": "100%" }}>
            <div style={{ "display": "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "1rem" }}>
              <h2 style={{ "color": "#94A3B8", "margin": "0", "font-size": "1rem", "letter-spacing": "1px" }}>
                {activeSymbol().replace("USDT", "")} PRICE
              </h2>
              <Show when={isAnomaly()}>
                <span style={{ "background": "#F59E0B", "color": "black", "padding": "4px 12px", "border-radius": "4px", "font-weight": "bold", "font-size": "0.8rem", "animation": "pulse 1s infinite" }}>ANOMALÍA DETECTADA</span>
              </Show>
            </div>
            
            <div style={{ "font-size": "3.5rem", "font-weight": "bold", "font-variant-numeric": "tabular-nums" }}>
              ${currentPrice().toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            
            {/* AQUÍ ESTÁ LA MAGIA: Le pasamos la lista específica desde el objeto global */}
            <PriceChart data={allCharts()[activeSymbol()] || []} />
            
            <div style={{ "text-align": "right", "color": "#64748B", "font-size": "0.8rem" }}>
              Actualizado: {lastUpdate()}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA (Feed Global) */}
        <div style={{ "display": "flex", "flex-direction": "column", "gap": "20px" }}>
          
          <div style={{ "background-color": "#1E293B", "padding": "1.5rem", "border-radius": "1rem", "border": "1px solid #334155" }}>
            <h3 style={{ "margin": "0 0 1rem 0", "color": "#10B981", "display": "flex", "align-items": "center", "gap": "8px", "font-size": "1rem" }}>🚀 Top Subidas</h3>
            <div style={{ "display": "flex", "flex-direction": "column", "gap": "8px" }}>
              <For each={topRisers()} fallback={<span style={{color: "#475569", "font-size": "0.8rem"}}>Esperando datos...</span>}>
                {(item) => (
                  <div style={{ "display": "flex", "justify-content": "space-between", "font-size": "0.8rem", "border-bottom": "1px solid #334155", "padding-bottom": "8px" }}>
                    <div>
                      <div style={{ "font-weight": "bold", "color": "white" }}>{item.symbol.replace("USDT","")} <span style={{color: "#10B981"}}>+${item.deviation.toFixed(2)}</span></div>
                      <div style={{ "color": "#64748B", "font-size": "0.7rem" }}>{item.time}</div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div style={{ "background-color": "#1E293B", "padding": "1.5rem", "border-radius": "1rem", "border": "1px solid #334155" }}>
            <h3 style={{ "margin": "0 0 1rem 0", "color": "#EF4444", "display": "flex", "align-items": "center", "gap": "8px", "font-size": "1rem" }}>🔻 Top Caídas</h3>
            <div style={{ "display": "flex", "flex-direction": "column", "gap": "8px" }}>
              <For each={topFallers()} fallback={<span style={{color: "#475569", "font-size": "0.8rem"}}>Esperando datos...</span>}>
                {(item) => (
                  <div style={{ "display": "flex", "justify-content": "space-between", "font-size": "0.8rem", "border-bottom": "1px solid #334155", "padding-bottom": "8px" }}>
                    <div>
                      <div style={{ "font-weight": "bold", "color": "white" }}>{item.symbol.replace("USDT","")} <span style={{color: "#EF4444"}}>${item.deviation.toFixed(2)}</span></div>
                      <div style={{ "color": "#64748B", "font-size": "0.7rem" }}>{item.time}</div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div style={{ "background-color": "#1E293B", "padding": "1.5rem", "border-radius": "1rem", "border": "1px solid #334155" }}>
            <h3 style={{ "margin": "0 0 1rem 0", "color": "#F59E0B", "display": "flex", "align-items": "center", "gap": "8px", "font-size": "1rem" }}>🕒 Global Feed</h3>
            <div style={{ "display": "flex", "flex-direction": "column", "gap": "8px" }}>
              <For each={recentAnomalies()} fallback={<span style={{color: "#475569", "font-size": "0.8rem"}}>Monitoreando mercado...</span>}>
                {(item) => (
                  <div style={{ "display": "flex", "justify-content": "space-between", "align-items": "center", "font-size": "0.8rem", "border-bottom": "1px solid #334155", "padding-bottom": "8px" }}>
                    <div style={{ "display": "flex", "align-items": "center", "gap": "8px" }}>
                      <span style={{ "width": "6px", "height": "6px", "border-radius": "50%", "background-color": item.deviation > 0 ? "#10B981" : "#EF4444" }}></span>
                      <div style={{ "color": "#E2E8F0", "font-weight": "bold" }}>{item.symbol.replace("USDT", "")}</div>
                    </div>
                    <div style={{ "font-family": "monospace", "color": item.deviation > 0 ? "#10B981" : "#EF4444" }}>
                       {item.deviation > 0 ? "+" : ""}{item.deviation.toFixed(2)}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;