// src/components/Spinner.tsx

export default function Spinner({ size = 24 }: { size?: number }) {
  const color = "#EFA0A0"; // Il tuo rosa pastello

  return (
    <div style={{ width: size, height: size, position: 'relative', color: color }}>
      <style>
        {`
          @keyframes cleanSpinnerRotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spinner-ring {
            box-sizing: border-box;
            display: block;
            position: absolute;
            width: 100%;
            height: 100%;
            border: ${size * 0.1}px solid currentColor;
            border-radius: 50%;
            animation: cleanSpinnerRotate 1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
            border-color: currentColor transparent transparent transparent;
          }
          .spinner-ring-track {
            box-sizing: border-box;
            display: block;
            position: absolute;
            width: 100%;
            height: 100%;
            border: ${size * 0.1}px solid currentColor;
            border-radius: 50%;
            opacity: 0.15;
          }
        `}
      </style>
      <div className="spinner-ring-track"></div>
      <div className="spinner-ring"></div>
    </div>
  );
}