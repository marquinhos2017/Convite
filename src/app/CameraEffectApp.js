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

            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const scale = Math.max(W / vw, H / vh);
            const sw = W / scale;
            const sh = H / scale;
            const sx = (vw - sw) / 2;
            const sy = (vh - sh) / 2;
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);

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
        <div style={{
            position: "relative",
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            background: "#000",
        }}>
            {/* vídeo ocupando a tela toda */}
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
                    transform: "scaleX(-1)", // espelho câmera frontal
                    zIndex: 1,
                }}
            />

            {/* overlay cobrindo toda a câmera */}
            {overlayLoaded && (
                <img
                    src={overlayImg?.src ?? overlayImg}
                    alt="Overlay"
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        pointerEvents: "none",
                        zIndex: 2,
                    }}
                />
            )}


            {/* botões flutuantes */}
            <div style={{
                position: "absolute",
                bottom: 20,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 12,
                zIndex: 3,
            }}>
                <button onClick={captureAndDownload} style={{
                    padding: "12px 20px",
                    borderRadius: 50,
                    background: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    fontSize: 16
                }}>
                    📸 Capturar
                </button>

                {lastBlobUrl && (
                    <button
                        onClick={() => window.open(lastBlobUrl, "_blank")}
                        style={{
                            padding: "12px 20px",
                            borderRadius: 50,
                            background: "#fff",
                            border: "1px solid #ddd",
                            fontSize: 16,
                        }}
                    >
                        📂 Ver última
                    </button>
                )}
            </div>

            {/* status no canto */}
            <div style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 14,
                color: "#fff",
                background: "rgba(0,0,0,0.5)",
                padding: "4px 10px",
                borderRadius: 8,
                zIndex: 3
            }}>
                {overlayLoaded && (
                    <img
                        src={overlayImg?.src ?? overlayImg}
                        alt="Overlay"
                        style={{
                            position: "absolute",
                            inset: 0,            // cobre toda a área
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",  // expande cobrindo a tela
                            pointerEvents: "none",
                            zIndex: 2,
                        }}
                    />
                )}

            </div>

            <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
    );
}
