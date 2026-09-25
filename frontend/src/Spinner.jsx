// src/Spinner.jsx の修正例
export default function Spinner({ size = 20 }) {
    return (
        <div
            className="spinner"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                border: '3px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block'
            }}
        />
    );
}