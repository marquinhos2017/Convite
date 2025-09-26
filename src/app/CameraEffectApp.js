"use client";

import React, { useRef, useEffect, useState } from "react";
import overlayImg from "../../assets/a.png";

export default function CameraEffectApp() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);

    const [status, setStatus] = useState("Aguardando câmera...");
    const [lastBlobUrl, setLastBlobUrl] = useState(null);
    const [overlayLoaded, setOverlayLoaded] = useState(false);

    // Preload do overlay
    useEffect(() => {
        const img = new Image();
        img.src = overlayImg?.src ?? overlayImg;
        img.onload = () => {
            overlayRef.current = img;
            setOverlayLoaded(true);
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        async function startCamera() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setStatus("Este navegador não suporta câmera (use Chrome/Safari com HTTPS).");
                return;
            }

            try {
                setStatus("Solicitando permissão da câmera...");
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: false,
                });

                if (!mounted) return;
                const video = videoRef.current;
                video.srcObject = stream;
                await video.play();
                setStatus("Câmera ativa");
            } catch (err) {
                console.error(err);
                setStatus("Erro ao acessar câmera: " + (err.message || err));
            }
        }

        startCamera();

        return () => {
            mounted = false;
            const video = videoRef.current;
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);



    async function captureAndDownload() {
        setStatus("Gerando foto...");
        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            const W = 1080;
            const H = 1920;
            canvas.width = W;
            canvas.height = H;

            const video = videoRef.current;

            // Desenhar vídeo no canvas (cover)
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const scale = Math.max(W / vw, H / vh);
            const sw = W / scale;
            const sh = H / scale;
            const sx = (vw - sw) / 2;
            const sy = (vh - sh) / 2;
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);

            // Desenhar overlay proporcional ao canvas (mantendo proporção)
            const overlay = overlayRef.current;
            if (overlay) {
                const ow = overlay.width;
                const oh = overlay.height;
                const scaleOverlay = Math.min(W / ow, H / oh);
                const owScaled = ow * scaleOverlay;
                const ohScaled = oh * scaleOverlay;
                const ox = (W - owScaled) / 2;
                const oy = (H - ohScaled) / 2;
                ctx.drawImage(overlay, ox, oy, owScaled, ohScaled);
            }

            // Salvar imagem
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                setLastBlobUrl(url);
                const a = document.createElement("a");
                const ts = new Date().toISOString().replace(/[:.]/g, "-");
                a.href = url;
                a.download = `photo-${ts}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setStatus("Foto salva!");
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            }, "image/png");
        } catch (err) {
            console.error(err);
            setStatus("Erro ao capturar: " + (err.message || err));
        }
    }

    return (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div
                style={{
                    position: "relative",
                    width: 270,
                    height: 480,
                    maxWidth: "100%",
                    overflow: "hidden",
                    borderRadius: 12,
                    background: "#000",
                }}
            >
                {/* vídeo */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        zIndex: 1,
                        transform: "scaleX(-1)",
                    }}
                />

                {/* overlay proporcional */}
                {overlayLoaded && (
                    <img
                        src={overlayImg?.src ?? overlayImg}
                        alt="Overlay"
                        style={{
                            position: "absolute",
                            zIndex: 2,
                            top: "50%",
                            left: "50%",
                            width: "auto",
                            height: "100%",
                            maxWidth: "100%",
                            transform: "translate(-50%, -50%)",
                            pointerEvents: "none",
                            opacity: 1, // força a visibilidade
                        }}
                    />

                )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={captureAndDownload} style={{ padding: "8px 14px", borderRadius: 8, background: "#4f46e5", color: "#fff", border: "none" }}>
                    Capturar e Salvar
                </button>

                <button
                    onClick={() => {
                        if (lastBlobUrl) window.open(lastBlobUrl, "_blank");
                    }}
                    disabled={!lastBlobUrl}
                    style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: lastBlobUrl ? "#fff" : "#f5f5f5",
                        cursor: lastBlobUrl ? "pointer" : "not-allowed",
                    }}
                >
                    Ver última
                </button>
            </div>

            <div style={{ fontSize: 13, color: "#444" }}>{status} {overlayLoaded ? "(overlay carregado)" : "(carregando overlay...)"}</div>

            <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
    );
}
