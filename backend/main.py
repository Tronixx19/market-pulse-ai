import asyncio
import json
import time
import numpy as np
from collections import deque
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import websockets

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. URL para escuchar múltiples monedas a la vez (Streams combinados)
# Formato: stream?streams=<symbol1>@trade/<symbol2>@trade/...
SYMBOLS = ["btcusdt", "ethusdt", "solusdt"]
STREAMS = "/".join([f"{s}@trade" for s in SYMBOLS])
BINANCE_URL = f"wss://stream.binance.com:9443/stream?streams={STREAMS}"

# --- CONFIGURACIÓN ---
UPDATE_INTERVAL = 5    
WINDOW_SIZE = 20       
Z_THRESHOLD = 2.0      
MIN_CHANGE_PCT = 0.005 # 2. CAMBIO IMPORTANTE: Usamos % (0.5%) en vez de dólares fijos, porque $5 es mucho para SOL pero nada para BTC.

# Estructuras de datos para CADA moneda
class SymbolState:
    def __init__(self):
        self.history = deque(maxlen=WINDOW_SIZE)
        self.buffer_5s = []
        self.last_send_time = time.time()

# Diccionario global de estados
states = {s.upper(): SymbolState() for s in SYMBOLS}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print(f"Monitor Multi-Moneda Iniciado: {', '.join(SYMBOLS).upper()}")
    
    async with websockets.connect(BINANCE_URL) as binance_ws:
        try:
            while True:
                message = await binance_ws.recv()
                data = json.loads(message)
                
                # Formato de stream combinado: {"stream": "btcusdt@trade", "data": {...}}
                stream_name = data['stream'] # ej: "btcusdt@trade"
                payload = data['data']
                
                # Identificar moneda
                symbol_raw = stream_name.split('@')[0].upper() # "BTCUSDT"
                
                price = float(payload['p'])
                trade_time = payload['T']
                
                # Obtener el estado específico de ESTA moneda
                state = states[symbol_raw]
                state.buffer_5s.append(price)
                
                now = time.time()
                if now - state.last_send_time >= UPDATE_INTERVAL:
                    
                    if len(state.buffer_5s) > 0:
                        avg_price = np.mean(state.buffer_5s)
                        state.history.append(avg_price)
                        
                        anomaly = False
                        deviation = 0.0
                        
                        if len(state.history) == WINDOW_SIZE:
                            window_np = np.array(state.history)
                            mean = np.mean(window_np)
                            std = np.std(window_np)
                            
                            # Cambio porcentual
                            pct_change = abs((avg_price - mean) / mean)
                            
                            if std > 0 and pct_change > MIN_CHANGE_PCT:
                                z_score = (avg_price - mean) / std
                                if abs(z_score) > Z_THRESHOLD:
                                    anomaly = True
                                    deviation = avg_price - mean
                                    print(f"⚠️ {symbol_raw}: ${avg_price:.2f} (Desv: {deviation:.2f})")

                        response = {
                            "symbol": symbol_raw, # Importante: Decirle al front quién soy
                            "price": round(avg_price, 2),
                            "timestamp": trade_time,
                            "is_anomaly": anomaly,
                            "deviation": round(deviation, 2)
                        }
                        await websocket.send_json(response)
                    
                    state.buffer_5s = []
                    state.last_send_time = now
                
        except Exception as e:
            print(f"Error: {e}")
            await websocket.close()