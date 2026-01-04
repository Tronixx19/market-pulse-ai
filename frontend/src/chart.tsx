import { createEffect, onMount } from "solid-js";
import type { Component } from "solid-js";
import { SolidApexCharts } from "solid-apexcharts";
import type { ApexOptions } from "apexcharts";

interface ChartProps {
  data: { x: number; y: number }[]; // x = tiempo, y = precio
}

const PriceChart: Component<ChartProps> = (props) => {
  
  // Configuración visual del gráfico
  const options: ApexOptions = {
    chart: {
      type: "area", // Área sombreada bajo la línea
      height: 350,
      animations: {
        enabled: true, // Animación suave
        easing: "linear",
        dynamicAnimation: {
          speed: 1000 // Velocidad de actualización
        }
      },
      toolbar: { show: false }, // Ocultar menú de descarga
      zoom: { enabled: false }
    },
    colors: ["#10B981"], // Verde esmeralda (tipo Binance)
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 100]
      }
    },
    dataLabels: { enabled: false },
    xaxis: {
      type: "datetime",
      range: 60000, // Mostrar solo los últimos 60 segundos (ventana deslizante)
      labels: { show: false }, // Ocultar etiquetas de hora para limpieza visual
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      show: true,
      opposite: true, // Eje Y a la derecha (como los traders profesionales)
      labels: {
        style: { colors: "#9CA3AF" },
        formatter: (value) => value.toFixed(2) // 2 decimales
      }
    },
    grid: { show: false }, // Sin cuadrícula de fondo
    theme: { mode: "dark" } // Modo oscuro automático
  };

  return (
    <div style={{ "width": "100%", "min-height": "360px" }}>
      <SolidApexCharts 
        width="100%" 
        type="area" 
        options={options} 
        series={[{ name: "BTC Price", data: props.data }]} 
      />
    </div>
  );
};

export default PriceChart;